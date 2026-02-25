/**
 * Metrics — Prometheus metrics collection and HTTP exposition
 *
 * Demonstrates MetricsCollector + MetricsServer:
 *   - Auto-starts HTTP server on port 9090
 *   - Collects poll, execution, and error metrics
 *   - Exposes /metrics (Prometheus text format) and /health endpoints
 *   - Supports optional prom-client integration
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/metrics.ts
 *
 * Then visit:
 *   http://localhost:9090/metrics  — Prometheus metrics
 *   http://localhost:9090/health   — Health check
 */
import {
  OrkesClients,
  ConductorWorkflow,
  TaskHandler,
  worker,
  simpleTask,
  MetricsCollector,
  MetricsServer,
} from "../src/sdk";
import type { Task } from "../src/open-api";

const _metricsTask = worker({ taskDefName: "metrics_task", registerTaskDef: true })(
  async (_task: Task) => {
    // Simulate variable processing time
    const delay = Math.random() * 50;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return {
      status: "COMPLETED",
      outputData: { processed: true, durationMs: delay },
    };
  }
);

async function main() {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();
  const client = clients.getClient();

  // Create metrics collector (no httpPort — avoids dynamic import issue with ts-node)
  const metrics = new MetricsCollector({
    prefix: "conductor_worker",
  });

  // Start the HTTP server manually
  const server = new MetricsServer(metrics, 9090);
  await server.start();

  console.log("Metrics server started on http://localhost:9090");
  console.log("  GET /metrics — Prometheus text format");
  console.log("  GET /health  — Health check");

  // Register workflow
  const wf = new ConductorWorkflow(workflowClient, "metrics_example")
    .description("Workflow for metrics collection demo")
    .add(simpleTask("m1_ref", "metrics_task", { step: 1 }))
    .add(simpleTask("m2_ref", "metrics_task", { step: 2 }))
    .add(simpleTask("m3_ref", "metrics_task", { step: 3 }))
    .outputParameters({ done: true });

  await wf.register(true);

  // Start workers with metrics listener
  const handler = new TaskHandler({
    client,
    scanForDecorated: true,
    eventListeners: [metrics],
  });
  await handler.startWorkers();

  // Execute workflow multiple times
  console.log("\nExecuting workflow 3 times...");
  for (let i = 0; i < 3; i++) {
    const run = await wf.execute({ iteration: i });
    console.log(`  Run ${i + 1}: ${run.status}`);
  }

  // Print metrics snapshot
  console.log("\n--- Metrics Snapshot ---");
  const snapshot = metrics.getMetrics();
  console.log("Poll totals:");
  for (const [task, count] of snapshot.pollTotal) {
    console.log(`  ${task}: ${count}`);
  }
  console.log("Execution totals:");
  for (const [task, count] of snapshot.taskExecutionTotal) {
    console.log(`  ${task}: ${count}`);
  }

  // Print Prometheus text format
  console.log("\n--- Prometheus Text Format ---");
  console.log(metrics.toPrometheusText());

  await handler.stopWorkers();
  await server.stop();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
