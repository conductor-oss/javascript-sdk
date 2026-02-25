/**
 * Express Worker Service — HTTP server + Conductor workers in one process
 *
 * Demonstrates running an Express.js HTTP server alongside Conductor
 * task workers. The HTTP server exposes endpoints to trigger workflows
 * and check worker health.
 *
 * Prerequisites:
 *   npm install express @types/express
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/express-worker-service.ts
 *
 * Then:
 *   curl http://localhost:3000/health
 *   curl -X POST http://localhost:3000/execute -H 'Content-Type: application/json' -d '{"name":"World"}'
 */
import {
  OrkesClients,
  ConductorWorkflow,
  TaskHandler,
  worker,
  simpleTask,
} from "../src/sdk";
import type { Task } from "../src/open-api";
import type { WorkflowExecutor } from "../src/sdk/clients/workflow";

// ── Workers ─────────────────────────────────────────────────────────
const _greetWorker = worker({ taskDefName: "svc_greet", registerTaskDef: true })(
  async (task: Task) => {
    const name = (task.inputData?.name as string) ?? "World";
    return {
      status: "COMPLETED",
      outputData: { greeting: `Hello, ${name}!`, timestamp: new Date().toISOString() },
    };
  }
);

const _processWorker = worker({ taskDefName: "svc_process", registerTaskDef: true })(
  async (task: Task) => {
    const data = task.inputData?.data as string;
    return {
      status: "COMPLETED",
      outputData: { processed: true, length: data?.length ?? 0 },
    };
  }
);

// ── Express server setup ────────────────────────────────────────────
async function createExpressApp(
  workflowClient: WorkflowExecutor,
  wf: ConductorWorkflow
) {
  // Dynamic import so Express is only required when running this example
  const express = (await import("express")).default;
  const app = express();
  app.use(express.json());

  // Health endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "UP", workers: ["svc_greet", "svc_process"] });
  });

  // Execute workflow endpoint
  app.post("/execute", async (req, res) => {
    try {
      const run = await wf.execute(req.body);
      res.json({
        workflowId: run.workflowId,
        status: run.status,
        output: run.output,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });

  // Start workflow async (returns workflow ID)
  app.post("/start", async (req, res) => {
    try {
      const workflowId = await wf.startWorkflow(req.body);
      res.json({ workflowId });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });

  // Get workflow status
  app.get("/workflow/:id", async (req, res) => {
    try {
      const status = await workflowClient.getWorkflow(req.params.id, true);
      res.json({
        workflowId: status.workflowId,
        status: status.status,
        output: status.output,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });

  return app;
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();
  const client = clients.getClient();

  // Register workflow
  const wf = new ConductorWorkflow(workflowClient, "express_service_workflow")
    .description("Workflow triggered by Express HTTP endpoints")
    .add(
      simpleTask("greet_ref", "svc_greet", {
        name: "${workflow.input.name}",
      })
    )
    .add(
      simpleTask("process_ref", "svc_process", {
        data: "${greet_ref.output.greeting}",
      })
    )
    .outputParameters({
      greeting: "${greet_ref.output.greeting}",
      processed: "${process_ref.output.processed}",
    });

  await wf.register(true);

  // Start workers
  const handler = new TaskHandler({ client, scanForDecorated: true });
  await handler.startWorkers();

  // Start Express server
  const app = await createExpressApp(workflowClient, wf);
  const PORT = process.env.PORT ?? 3000;

  const server = app.listen(PORT, () => {
    console.log(`Express server running on http://localhost:${PORT}`);
    console.log(`Workers polling for tasks...`);
    console.log(`\nEndpoints:`);
    console.log(`  GET  /health        — Health check`);
    console.log(`  POST /execute       — Execute workflow (sync)`);
    console.log(`  POST /start         — Start workflow (async)`);
    console.log(`  GET  /workflow/:id  — Get workflow status`);
    console.log(`\nExample:`);
    console.log(
      `  curl -X POST http://localhost:${PORT}/execute -H 'Content-Type: application/json' -d '{"name":"Conductor"}'`
    );
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\nShutting down...");
    server.close();
    await handler.stopWorkers();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
