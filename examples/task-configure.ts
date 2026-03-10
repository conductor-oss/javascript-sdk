/**
 * Task Configure — Programmatic task definition management
 *
 * Demonstrates registering task definitions with MetadataClient:
 *   - Retry policies (FIXED, EXPONENTIAL_BACKOFF, LINEAR_BACKOFF)
 *   - Timeout configuration
 *   - Rate limiting
 *   - Concurrency limits
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/task-configure.ts
 */
import { OrkesClients } from "../src/sdk";

async function main() {
  const clients = await OrkesClients.from();
  const metadataClient = clients.getMetadataClient();

  // ── 1. Simple task definition ─────────────────────────────────────
  await metadataClient.registerTask({
    name: "cfg_simple_task",
    description: "A simple task with defaults",
    retryCount: 3,
    retryLogic: "FIXED",
    retryDelaySeconds: 10,
    timeoutSeconds: 60,
    responseTimeoutSeconds: 30,
  });
  console.log("1. Registered simple task definition: cfg_simple_task");

  // ── 2. Task with exponential backoff ──────────────────────────────
  await metadataClient.registerTask({
    name: "cfg_backoff_task",
    description: "Task with exponential backoff retry",
    retryCount: 5,
    retryLogic: "EXPONENTIAL_BACKOFF",
    retryDelaySeconds: 5,
    timeoutSeconds: 300,
    responseTimeoutSeconds: 120,
  });
  console.log("2. Registered backoff task: cfg_backoff_task");

  // ── 3. Task with rate limiting ────────────────────────────────────
  await metadataClient.registerTask({
    name: "cfg_rate_limited_task",
    description: "Task with rate limiting",
    retryCount: 3,
    retryLogic: "FIXED",
    retryDelaySeconds: 10,
    timeoutSeconds: 120,
    responseTimeoutSeconds: 60,
    rateLimitPerFrequency: 10,
    rateLimitFrequencyInSeconds: 60,
  });
  console.log("3. Registered rate-limited task: cfg_rate_limited_task");

  // ── 4. Task with concurrency limit ────────────────────────────────
  await metadataClient.registerTask({
    name: "cfg_concurrent_task",
    description: "Task with concurrency execution limit",
    retryCount: 2,
    retryLogic: "FIXED",
    retryDelaySeconds: 5,
    timeoutSeconds: 180,
    responseTimeoutSeconds: 60,
    concurrentExecLimit: 5,
  });
  console.log("4. Registered concurrent-limited task: cfg_concurrent_task");

  // ── 5. Long-running task with callback ────────────────────────────
  await metadataClient.registerTask({
    name: "cfg_long_running_task",
    description: "Long-running task that uses callbacks",
    retryCount: 1,
    retryLogic: "FIXED",
    retryDelaySeconds: 30,
    timeoutSeconds: 3600,
    responseTimeoutSeconds: 600,
    pollTimeoutSeconds: 60,
  });
  console.log("5. Registered long-running task: cfg_long_running_task");

  // ── 6. Batch register multiple tasks ──────────────────────────────
  await metadataClient.registerTasks([
    {
      name: "cfg_batch_task_1",
      description: "Batch task 1",
      retryCount: 3,
      timeoutSeconds: 60,
      responseTimeoutSeconds: 30,
    },
    {
      name: "cfg_batch_task_2",
      description: "Batch task 2",
      retryCount: 3,
      timeoutSeconds: 60,
      responseTimeoutSeconds: 30,
    },
    {
      name: "cfg_batch_task_3",
      description: "Batch task 3",
      retryCount: 3,
      timeoutSeconds: 60,
      responseTimeoutSeconds: 30,
    },
  ]);
  console.log("6. Batch registered 3 tasks");

  // ── 7. Retrieve and display a task definition ─────────────────────
  const taskDef = await metadataClient.getTask("cfg_backoff_task");
  console.log("\n7. Retrieved task definition:");
  console.log(JSON.stringify(taskDef, null, 2));

  // ── 8. Update a task definition ───────────────────────────────────
  await metadataClient.updateTask({
    ...taskDef,
    retryCount: 10,
    description: "Updated: more retries",
  });
  console.log("\n8. Updated cfg_backoff_task retryCount to 10");

  // ── 9. Clean up ───────────────────────────────────────────────────
  const tasksToClean = [
    "cfg_simple_task",
    "cfg_backoff_task",
    "cfg_rate_limited_task",
    "cfg_concurrent_task",
    "cfg_long_running_task",
    "cfg_batch_task_1",
    "cfg_batch_task_2",
    "cfg_batch_task_3",
  ];
  for (const name of tasksToClean) {
    await metadataClient.unregisterTask(name);
  }
  console.log("9. Cleaned up all task definitions");

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
