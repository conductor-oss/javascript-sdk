/**
 * lease-ext-test-worker.ts
 *
 * A simple worker named "lease_ext_test" that demonstrates lease extension.
 *
 * The worker simulates a 40-second task. With leaseExtendEnabled=true the
 * LeaseTracker sends heartbeats every 8s (80% of responseTimeoutSeconds=10s)
 * so the server lease never expires.
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080/api \
 *   npx ts-node --project tsconfig.json -e "require('./src/examples/lease-ext-test-worker.ts')"
 *
 *   Or via tsx (if available):
 *   CONDUCTOR_SERVER_URL=http://localhost:8080/api npx tsx src/examples/lease-ext-test-worker.ts
 */

import {
  orkesConductorClient,
  MetadataClient,
} from "../sdk";
import { TaskRunner } from "../sdk/clients/worker/TaskRunner";
import { DefaultLogger } from "../sdk/helpers/logger";
import type { Task, TaskResult } from "../open-api";

const TASK_DEF_NAME      = "lease_ext_test";
const RESPONSE_TIMEOUT_S = 10;   // server lease expires after 10s without update
const TASK_DURATION_MS   = 120_000; // worker "works" for 2 mins (12× the lease window)

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const logger = new DefaultLogger();

  // ── Connect ────────────────────────────────────────────────────────────────
  logger.info(`Connecting to Conductor at ${process.env.CONDUCTOR_SERVER_URL ?? "http://localhost:8080/api"}...`);
  const client = await orkesConductorClient();

  // ── Register task definition ───────────────────────────────────────────────
  const meta = new MetadataClient(client);
  await meta.registerTask({
    name:                   TASK_DEF_NAME,
    retryCount:             0,
    timeoutSeconds:         120,
    responseTimeoutSeconds: RESPONSE_TIMEOUT_S,
    timeoutPolicy:          "TIME_OUT_WF",
    retryLogic:             "FIXED",
    retryDelaySeconds:      0,
    pollTimeoutSeconds:     3600,
    ownerEmail:             "sdk-demo@example.com",
  });
  logger.info(`Task definition '${TASK_DEF_NAME}' registered (responseTimeoutSeconds=${RESPONSE_TIMEOUT_S}s)`);

  // ── Worker execute function ────────────────────────────────────────────────
  async function execute(task: Task): Promise<Omit<TaskResult, "workflowInstanceId" | "taskId">> {
    const start = Date.now();
    logger.info(`[${TASK_DEF_NAME}] Starting task ${task.taskId} (will run ${TASK_DURATION_MS / 1000}s)`);
    logger.info(`[${TASK_DEF_NAME}] Heartbeat will fire at ${RESPONSE_TIMEOUT_S * 0.8}s intervals — lease stays alive`);

    // Simulate long-running work
    await sleep(TASK_DURATION_MS);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    logger.info(`[${TASK_DEF_NAME}] Task ${task.taskId} finished after ${elapsed}s`);

    return {
      status: "COMPLETED",
      outputData: {
        taskId:       task.taskId,
        workflowId:   task.workflowInstanceId,
        durationSecs: elapsed,
        message:      `Completed after ${elapsed}s with lease extension keeping server lease alive`,
      },
    };
  }

  // ── Task runner ─────────────────────────────────────────────────────────────
  const runner = new TaskRunner({
    worker: {
      taskDefName:        TASK_DEF_NAME,
      execute,
      leaseExtendEnabled: false,  // ← no heartbeat — lease will expire at responseTimeoutSeconds
      concurrency:        1,
      pollInterval:       200,
    },
    client,
    options: {
      workerID:    `lease-ext-test-worker-${process.pid}`,
      domain:      undefined,
      pollInterval: 200,
    },
    logger,
  });

  // ── Start ───────────────────────────────────────────────────────────────────
  runner.startPolling();

  logger.info(`\n${"─".repeat(60)}`);
  logger.info(`  Worker '${TASK_DEF_NAME}' is polling — waiting for tasks`);
  logger.info(`  responseTimeoutSeconds : ${RESPONSE_TIMEOUT_S}s`);
  logger.info(`  Heartbeat interval     : ${RESPONSE_TIMEOUT_S * 0.8}s`);
  logger.info(`  Task execution time    : ${TASK_DURATION_MS / 1000}s`);
  logger.info(`  leaseExtendEnabled     : ${runner.worker.leaseExtendEnabled ?? false}`);
  logger.info(`${"─".repeat(60)}`);
  logger.info(`  Start a workflow from the UI or API using task type: ${TASK_DEF_NAME}`);
  logger.info(`  Press Ctrl+C to stop.\n`);

  // ── Graceful shutdown ───────────────────────────────────────────────────────
  process.on("SIGINT", async () => {
    logger.info("\nShutting down...");
    await runner.stopPolling();
    process.exit(0);
  });
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
