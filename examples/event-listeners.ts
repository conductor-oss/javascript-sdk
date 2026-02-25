/**
 * Event Listeners — Custom lifecycle hooks for worker execution
 *
 * Demonstrates the TaskRunnerEventsListener interface for:
 *   - Poll lifecycle (started, completed, failure)
 *   - Task execution lifecycle (started, completed, failure)
 *   - Task update failures (critical)
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/event-listeners.ts
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
  PollStarted,
  PollCompleted,
  PollFailure,
  TaskExecutionStarted,
  TaskExecutionCompleted,
  TaskExecutionFailure,
  TaskUpdateFailure,
} from "../src/sdk";
import type { Task } from "../src/open-api";

// ── Custom event listener ───────────────────────────────────────────
class ExecutionLogger implements TaskRunnerEventsListener {
  private pollCount = 0;
  private executionCount = 0;
  private errorCount = 0;

  onPollStarted(event: PollStarted): void {
    this.pollCount++;
    console.log(
      `  [POLL START] task=${event.taskType} worker=${event.workerId} count=${event.pollCount}`
    );
  }

  onPollCompleted(event: PollCompleted): void {
    console.log(
      `  [POLL DONE]  task=${event.taskType} duration=${event.durationMs}ms received=${event.tasksReceived}`
    );
  }

  onPollFailure(event: PollFailure): void {
    this.errorCount++;
    console.log(
      `  [POLL FAIL]  task=${event.taskType} error=${event.cause.message}`
    );
  }

  onTaskExecutionStarted(event: TaskExecutionStarted): void {
    console.log(
      `  [EXEC START] task=${event.taskType} id=${event.taskId} workflow=${event.workflowInstanceId}`
    );
  }

  onTaskExecutionCompleted(event: TaskExecutionCompleted): void {
    this.executionCount++;
    console.log(
      `  [EXEC DONE]  task=${event.taskType} id=${event.taskId} duration=${event.durationMs}ms`
    );
  }

  onTaskExecutionFailure(event: TaskExecutionFailure): void {
    this.errorCount++;
    console.log(
      `  [EXEC FAIL]  task=${event.taskType} id=${event.taskId} error=${event.cause.message}`
    );
  }

  onTaskUpdateFailure(event: TaskUpdateFailure): void {
    this.errorCount++;
    console.log(
      `  [UPDATE FAIL] task=${event.taskType} id=${event.taskId} retries=${event.retryCount} error=${event.cause.message}`
    );
  }

  printSummary(): void {
    console.log("\n--- Listener Summary ---");
    console.log(`  Total polls: ${this.pollCount}`);
    console.log(`  Tasks executed: ${this.executionCount}`);
    console.log(`  Errors: ${this.errorCount}`);
  }
}

// ── Timing listener (measures execution time) ───────────────────────
class TimingListener implements TaskRunnerEventsListener {
  private timings: { task: string; ms: number }[] = [];

  onTaskExecutionCompleted(event: TaskExecutionCompleted): void {
    this.timings.push({ task: event.taskType, ms: event.durationMs });
  }

  printTimings(): void {
    console.log("\n--- Execution Timings ---");
    for (const t of this.timings) {
      console.log(`  ${t.task}: ${t.ms}ms`);
    }
    if (this.timings.length > 0) {
      const avg =
        this.timings.reduce((sum, t) => sum + t.ms, 0) / this.timings.length;
      console.log(`  Average: ${avg.toFixed(1)}ms`);
    }
  }
}

// ── Workers ─────────────────────────────────────────────────────────
const _fastTask = worker({ taskDefName: "evt_fast_task", registerTaskDef: true })(
  async (_task: Task) => {
    return {
      status: "COMPLETED",
      outputData: { fast: true },
    };
  }
);

const _slowTask = worker({ taskDefName: "evt_slow_task", registerTaskDef: true })(
  async (_task: Task) => {
    // Simulate work
    await new Promise((resolve) => setTimeout(resolve, 100));
    return {
      status: "COMPLETED",
      outputData: { slow: true },
    };
  }
);

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();
  const client = clients.getClient();

  // Create listeners
  const logger = new ExecutionLogger();
  const timer = new TimingListener();

  const wf = new ConductorWorkflow(workflowClient, "event_listeners_example")
    .description("Demonstrates event listener hooks")
    .add(simpleTask("fast_ref", "evt_fast_task", {}))
    .add(simpleTask("slow_ref", "evt_slow_task", {}))
    .outputParameters({
      fast: "${fast_ref.output.fast}",
      slow: "${slow_ref.output.slow}",
    });

  await wf.register(true);

  // Pass listeners to TaskHandler
  const handler = new TaskHandler({
    client,
    scanForDecorated: true,
    eventListeners: [logger, timer],
  });
  await handler.startWorkers();

  console.log("Executing workflow with event listeners...\n");
  const run = await wf.execute({});
  console.log("\nWorkflow status:", run.status);

  // Print listener summaries
  logger.printSummary();
  timer.printTimings();

  await handler.stopWorkers();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
