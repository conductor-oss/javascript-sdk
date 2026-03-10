/**
 * Performance Test — Measure task processing pipeline latency and throughput
 *
 * Runs N workflows through a no-op worker and collects timing for every phase:
 *   - Poll latency (server → SDK)
 *   - Execute latency (worker function)
 *   - Update latency (SDK → server, the V2 endpoint)
 *   - End-to-end per-task latency
 *   - Throughput (tasks/sec)
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/perf-test.ts
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 PERF_WORKFLOWS=100 npx ts-node examples/perf-test.ts
 */
import {
  OrkesClients,
  ConductorWorkflow,
  TaskHandler,
  worker,
  simpleTask,
} from "../src/sdk";
import type {
  TaskRunnerEventsListener,
  PollCompleted,
  TaskExecutionStarted,
  TaskExecutionCompleted,
  TaskUpdateCompleted,
} from "../src/sdk/clients/worker/events";
import type { Task } from "../src/open-api";

// ── Configuration ────────────────────────────────────────────────
const WORKFLOW_COUNT = parseInt(process.env.PERF_WORKFLOWS ?? "20", 10);
const CONCURRENCY = parseInt(process.env.PERF_CONCURRENCY ?? "5", 10);
const BATCH_SIZE = parseInt(process.env.PERF_BATCH_SIZE ?? "5", 10);

// ── No-op worker (near-zero execution time) ──────────────────────
const _perfTask = worker({
  taskDefName: "perf_noop_task",
  registerTaskDef: true,
  concurrency: CONCURRENCY,
})(async (_task: Task) => ({
  status: "COMPLETED" as const,
  outputData: { ts: Date.now() },
}));

// ── Timing collector ─────────────────────────────────────────────
class PerfCollector implements TaskRunnerEventsListener {
  pollDurations: number[] = [];
  executeDurations: number[] = [];
  updateDurations: number[] = [];
  // Track per-task e2e: execution start → update complete
  private execStartTimes = new Map<string, number>();
  e2eDurations: number[] = [];
  errors = 0;

  onPollCompleted(event: PollCompleted): void {
    this.pollDurations.push(event.durationMs);
  }

  onTaskExecutionStarted(event: TaskExecutionStarted): void {
    this.execStartTimes.set(event.taskId, Date.now());
  }

  onTaskExecutionCompleted(event: TaskExecutionCompleted): void {
    this.executeDurations.push(event.durationMs);
  }

  onTaskUpdateCompleted(event: TaskUpdateCompleted): void {
    this.updateDurations.push(event.durationMs);
    const start = this.execStartTimes.get(event.taskId);
    if (start !== undefined) {
      this.e2eDurations.push(Date.now() - start);
      this.execStartTimes.delete(event.taskId);
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
}

function fmt(n: number): string {
  return n.toFixed(1).padStart(8);
}

function printStats(label: string, values: number[]): void {
  if (values.length === 0) {
    console.log(`  ${label.padEnd(22)} (no data)`);
    return;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const p50 = percentile(sorted, 0.5);
  const p95 = percentile(sorted, 0.95);
  const p99 = percentile(sorted, 0.99);
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  console.log(
    `  ${label.padEnd(22)} p50=${fmt(p50)}ms  p95=${fmt(p95)}ms  p99=${fmt(p99)}ms  avg=${fmt(avg)}ms  n=${sorted.length}`
  );
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();
  const client = clients.getClient();

  // Register workflow
  const wf = new ConductorWorkflow(workflowClient, "perf_test_workflow")
    .description("Performance test — single no-op task")
    .add(simpleTask("perf_ref", "perf_noop_task", {}))
    .outputParameters({ ts: "${perf_ref.output.ts}" });

  await wf.register(true);

  // Set up collector
  const collector = new PerfCollector();

  // Start workers
  const handler = new TaskHandler({
    client,
    scanForDecorated: true,
    eventListeners: [collector],
  });
  await handler.startWorkers();

  // Execute workflows in batches to avoid overwhelming the server
  console.log(
    `\nRunning ${WORKFLOW_COUNT} workflows (batch=${BATCH_SIZE}, worker concurrency=${CONCURRENCY})...\n`
  );
  const wallStart = Date.now();

  const results: (Awaited<ReturnType<typeof wf.execute>> | null)[] = [];
  for (let i = 0; i < WORKFLOW_COUNT; i += BATCH_SIZE) {
    const batch = Array.from(
      { length: Math.min(BATCH_SIZE, WORKFLOW_COUNT - i) },
      (_, j) =>
        wf.execute({ iteration: i + j }).catch((err) => {
          collector.errors++;
          console.error(`  Workflow ${i + j} failed:`, err.message);
          return null;
        })
    );
    results.push(...(await Promise.all(batch)));
  }
  const wallTimeMs = Date.now() - wallStart;

  const completed = results.filter((r) => r?.status === "COMPLETED").length;
  const failed = WORKFLOW_COUNT - completed;

  // Print results
  console.log(
    `--- Performance Test Results (${WORKFLOW_COUNT} workflows, batch=${BATCH_SIZE}, concurrency=${CONCURRENCY}) ---\n`
  );
  printStats("Poll latency", collector.pollDurations);
  printStats("Execute latency", collector.executeDurations);
  printStats("Update latency", collector.updateDurations);
  printStats("E2E task latency", collector.e2eDurations);

  const tasksCompleted = collector.updateDurations.length;
  const throughput =
    wallTimeMs > 0 ? (tasksCompleted / wallTimeMs) * 1000 : 0;
  console.log(`\n  Throughput:            ${throughput.toFixed(1)} tasks/sec`);
  console.log(`  Wall time:            ${(wallTimeMs / 1000).toFixed(2)}s`);
  console.log(`  Workflows completed:  ${completed}/${WORKFLOW_COUNT}`);
  if (failed > 0) console.log(`  Workflows failed:     ${failed}`);
  if (collector.errors > 0)
    console.log(`  Errors:               ${collector.errors}`);

  await handler.stopWorkers();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
