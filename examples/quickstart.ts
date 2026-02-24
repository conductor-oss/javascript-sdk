/**
 * Quickstart — 60-second introduction to Conductor + TypeScript
 *
 * Demonstrates the minimal steps to define a worker, build a workflow,
 * register it, execute it, and print the result.
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/quickstart.ts
 *
 * Environment variables:
 *   CONDUCTOR_SERVER_URL  — Conductor server URL (required)
 *   CONDUCTOR_AUTH_KEY    — Auth key (optional, for Orkes Cloud)
 *   CONDUCTOR_AUTH_SECRET — Auth secret (optional, for Orkes Cloud)
 */
import {
  OrkesClients,
  ConductorWorkflow,
  TaskHandler,
  worker,
  simpleTask,
} from "../src/sdk";
import type { Task, TaskResult } from "../src/open-api";

// ── 1. Define a worker ──────────────────────────────────────────────
@worker({ taskDefName: "greet", registerTaskDef: true })
async function greet(task: Task): Promise<TaskResult> {
  const name = (task.inputData?.name as string) ?? "World";
  return {
    status: "COMPLETED",
    outputData: { greeting: `Hello, ${name}!` },
  };
}

// ── 2. Main ─────────────────────────────────────────────────────────
async function main() {
  // Connect to Conductor (reads CONDUCTOR_SERVER_URL / AUTH env vars)
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();
  const client = clients.getClient();

  // Build a simple workflow
  const wf = new ConductorWorkflow(workflowClient, "quickstart_workflow")
    .description("A minimal quickstart workflow")
    .add(
      simpleTask("greet_ref", "greet", {
        name: "${workflow.input.name}",
      })
    )
    .outputParameters({
      greeting: "${greet_ref.output.greeting}",
    });

  // Register the workflow
  await wf.register(true);
  console.log("Registered workflow:", wf.getName());

  // Start polling for tasks
  const handler = new TaskHandler({ client, scanForDecorated: true });
  await handler.startWorkers();

  // Execute the workflow synchronously
  const run = await wf.execute({ name: "Conductor" });
  console.log("Workflow status:", run.status);
  console.log("Output:", run.output);

  // Cleanup
  await handler.stopWorkers();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
