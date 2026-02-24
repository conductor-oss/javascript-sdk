/**
 * Worker Configuration — Environment variable hierarchy and per-worker settings
 *
 * Shows how worker configuration is resolved:
 *   1. Decorator options (highest priority)
 *   2. Environment variables (per-worker and global)
 *   3. SDK defaults (lowest priority)
 *
 * Environment variables:
 *   CONDUCTOR_WORKER_POLL_INTERVAL     — Global poll interval (ms)
 *   CONDUCTOR_WORKER_CONCURRENCY       — Global concurrency
 *   CONDUCTOR_WORKER_DOMAIN            — Global domain
 *   CONDUCTOR_WORKER_<TASK>_POLL_INTERVAL — Per-task poll interval
 *   CONDUCTOR_WORKER_<TASK>_CONCURRENCY   — Per-task concurrency
 *   CONDUCTOR_WORKER_<TASK>_DOMAIN        — Per-task domain
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 \
 *   CONDUCTOR_WORKER_POLL_INTERVAL=500 \
 *   CONDUCTOR_WORKER_CONCURRENCY=3 \
 *     npx ts-node examples/worker-configuration.ts
 */
import {
  OrkesClients,
  ConductorWorkflow,
  TaskHandler,
  worker,
  simpleTask,
  getRegisteredWorkers,
} from "../src/sdk";
import type { Task } from "../src/open-api";

// ── Worker with defaults (uses env vars or SDK defaults) ────────────
const defaultWorker = worker({
  taskDefName: "config_default_worker",
  registerTaskDef: true,
})(
  async (task: Task) => {
    return {
      status: "COMPLETED",
      outputData: { worker: "default", input: task.inputData },
    };
  }
);

// ── Worker with explicit concurrency ────────────────────────────────
const highConcurrencyWorker = worker({
  taskDefName: "config_high_concurrency",
  registerTaskDef: true,
  concurrency: 10,
  pollInterval: 200,
})(
  async (task: Task) => {
    return {
      status: "COMPLETED",
      outputData: { worker: "high_concurrency", input: task.inputData },
    };
  }
);

// ── Worker with domain isolation ────────────────────────────────────
const domainWorker = worker({
  taskDefName: "config_domain_worker",
  registerTaskDef: true,
  domain: "staging",
  concurrency: 2,
  pollInterval: 1000,
})(
  async (task: Task) => {
    return {
      status: "COMPLETED",
      outputData: { worker: "domain", domain: "staging", input: task.inputData },
    };
  }
);

// ── Worker with custom poll timeout ─────────────────────────────────
const longPollWorker = worker({
  taskDefName: "config_long_poll",
  registerTaskDef: true,
  pollTimeout: 5000,
  concurrency: 1,
})(
  async (task: Task) => {
    return {
      status: "COMPLETED",
      outputData: { worker: "long_poll", input: task.inputData },
    };
  }
);

async function main() {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();
  const client = clients.getClient();

  // Print registered worker configurations
  console.log("Registered workers:");
  for (const w of getRegisteredWorkers()) {
    console.log(`  ${w.taskDefName}:`);
    console.log(`    concurrency: ${w.concurrency ?? "default"}`);
    console.log(`    pollInterval: ${w.pollInterval ?? "default"}ms`);
    console.log(`    domain: ${w.domain ?? "none"}`);
    console.log(`    pollTimeout: ${w.pollTimeout ?? "default"}ms`);
  }

  // Build workflow using the default worker
  const wf = new ConductorWorkflow(workflowClient, "config_demo_workflow")
    .description("Demonstrates worker configuration options")
    .add(
      simpleTask("step_ref", "config_default_worker", {
        message: "${workflow.input.message}",
      })
    )
    .outputParameters({ result: "${step_ref.output.worker}" });

  await wf.register(true);

  // Start workers and execute
  const handler = new TaskHandler({ client, scanForDecorated: true });
  await handler.startWorkers();

  const run = await wf.execute({ message: "testing config" });
  console.log("\nWorkflow status:", run.status);
  console.log("Output:", JSON.stringify(run.output, null, 2));

  await handler.stopWorkers();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
