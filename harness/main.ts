import {
  OrkesClients,
  ConductorWorkflow,
  TaskHandler,
  simpleTask,
  MetricsCollector,
} from "../src/sdk";
import { MetadataResource } from "../src/open-api/generated";
import type { ConductorWorker } from "../src/sdk/clients/worker/types";
import { SimulatedTaskWorker } from "./simulatedTaskWorker";
import { WorkflowGovernor } from "./workflowGovernor";

const WORKFLOW_NAME = "js_simulated_tasks_workflow";

const SIMULATED_WORKERS: {
  taskName: string;
  codename: string;
  sleepSeconds: number;
}[] = [
  { taskName: "js_worker_0", codename: "quickpulse", sleepSeconds: 1 },
  { taskName: "js_worker_1", codename: "whisperlink", sleepSeconds: 2 },
  { taskName: "js_worker_2", codename: "shadowfetch", sleepSeconds: 3 },
  { taskName: "js_worker_3", codename: "ironforge", sleepSeconds: 4 },
  { taskName: "js_worker_4", codename: "deepcrawl", sleepSeconds: 5 },
];

function envIntOrDefault(key: string, defaultVal: number): number {
  const s = process.env[key];
  if (!s) return defaultVal;
  const v = parseInt(s, 10);
  return isNaN(v) ? defaultVal : v;
}

async function registerMetadata(
  client: Awaited<ReturnType<typeof OrkesClients.prototype.getClient>>,
  workflowClient: ReturnType<typeof OrkesClients.prototype.getWorkflowClient>,
): Promise<void> {
  const taskDefs = SIMULATED_WORKERS.map((def) => ({
    name: def.taskName,
    description: `JS SDK harness simulated task (${def.codename}, default delay ${def.sleepSeconds}s)`,
    retryCount: 1,
    timeoutSeconds: 300,
    responseTimeoutSeconds: 300,
    totalTimeoutSeconds: 0,
  }));

  await MetadataResource.registerTaskDef({
    client,
    body: taskDefs,
  });

  const wf = new ConductorWorkflow(workflowClient, WORKFLOW_NAME)
    .version(1)
    .description("JS SDK harness simulated task workflow")
    .ownerEmail("js-sdk-harness@conductor.io");

  for (const def of SIMULATED_WORKERS) {
    wf.add(simpleTask(def.codename, def.taskName, {}));
  }

  await wf.register(true);

  console.log(
    `Registered workflow ${WORKFLOW_NAME} with ${SIMULATED_WORKERS.length} tasks`,
  );
}

async function main(): Promise<void> {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();
  const client = clients.getClient();

  await registerMetadata(client, workflowClient);

  const workflowsPerSec = envIntOrDefault("HARNESS_WORKFLOWS_PER_SEC", 2);
  const batchSize = envIntOrDefault("HARNESS_BATCH_SIZE", 20);
  const pollIntervalMs = envIntOrDefault("HARNESS_POLL_INTERVAL_MS", 100);

  const workers: ConductorWorker[] = SIMULATED_WORKERS.map((def) => {
    const sim = new SimulatedTaskWorker(
      def.taskName,
      def.codename,
      def.sleepSeconds,
      batchSize,
      pollIntervalMs,
    );
    return {
      taskDefName: sim.taskName,
      execute: sim.execute.bind(sim),
      concurrency: sim.batchSize,
      pollInterval: sim.pollInterval,
    };
  });

  const metricsPort = envIntOrDefault("HARNESS_METRICS_PORT", 9991);
  const metricsCollector = new MetricsCollector({ httpPort: metricsPort });
  console.log(`Prometheus metrics server started on port ${metricsPort}`);

  const handler = new TaskHandler({
    client,
    workers,
    scanForDecorated: false,
    eventListeners: [metricsCollector],
  });
  await handler.startWorkers();

  const governor = new WorkflowGovernor(
    workflowClient,
    WORKFLOW_NAME,
    workflowsPerSec,
  );
  governor.start();

  const shutdown = async () => {
    console.log("Shutting down...");
    governor.stop();
    await handler.stopWorkers();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
