/**
 * Hello World — Minimal complete workflow lifecycle
 *
 * Demonstrates the bare minimum to:
 *   1. Register a task definition
 *   2. Register a workflow definition
 *   3. Start a workflow
 *   4. Poll and execute a task
 *   5. Wait for completion and print the result
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/helloworld.ts
 */
import {
  OrkesClients,
  ConductorWorkflow,
  TaskHandler,
  worker,
  simpleTask,
} from "../src/sdk";
import type { Task } from "../src/open-api";

// ── Worker ──────────────────────────────────────────────────────────
const _helloTask = worker({ taskDefName: "hello_task", registerTaskDef: true })(
  async (task: Task) => {
    const name = (task.inputData?.name as string) ?? "World";
    return {
      status: "COMPLETED",
      outputData: { message: `Hello, ${name}!` },
    };
  }
);

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();
  const client = clients.getClient();

  // Define & register workflow
  const wf = new ConductorWorkflow(workflowClient, "hello_world")
    .add(
      simpleTask("hello_ref", "hello_task", {
        name: "${workflow.input.name}",
      })
    )
    .outputParameters({
      message: "${hello_ref.output.message}",
    });

  await wf.register(true);
  console.log("Workflow registered.");

  // Start workers
  const handler = new TaskHandler({ client, scanForDecorated: true });
  await handler.startWorkers();

  // Execute and wait for result
  const run = await wf.execute({ name: "TypeScript" });
  console.log("Status:", run.status);
  console.log("Output:", JSON.stringify(run.output, null, 2));

  await handler.stopWorkers();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
