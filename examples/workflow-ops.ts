/**
 * Workflow Operations — Lifecycle management of running workflows
 *
 * Demonstrates: start, getStatus, pause, resume, terminate, restart,
 * retry, search, and delete.
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/workflow-ops.ts
 */
import {
  OrkesClients,
  ConductorWorkflow,
  TaskHandler,
  worker,
  simpleTask,
  waitTaskDuration,
} from "../src/sdk";
import type { Task, TaskResult } from "../src/open-api";

@worker({ taskDefName: "ops_step", registerTaskDef: true })
async function opsStep(task: Task): Promise<TaskResult> {
  return {
    status: "COMPLETED",
    outputData: { step: task.inputData?.step, done: true },
  };
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();
  const client = clients.getClient();

  // Register a workflow with a wait task so we can manipulate it
  const wf = new ConductorWorkflow(workflowClient, "workflow_ops_example")
    .description("Workflow for demonstrating lifecycle operations")
    .timeoutSeconds(300)
    .add(simpleTask("step1_ref", "ops_step", { step: 1 }))
    .add(waitTaskDuration("wait_ref", "60s")) // Long wait so we can operate on it
    .add(simpleTask("step2_ref", "ops_step", { step: 2 }))
    .outputParameters({
      result: "${step2_ref.output.done}",
    });

  await wf.register(true);
  console.log("Registered workflow:", wf.getName());

  const handler = new TaskHandler({ client, scanForDecorated: true });
  await handler.startWorkers();

  // ── Start workflow (async) ────────────────────────────────────────
  const workflowId = await wf.startWorkflow({ note: "ops demo" });
  console.log("\n1. Started workflow:", workflowId);

  await sleep(2000);

  // ── Get status ────────────────────────────────────────────────────
  const status = await workflowClient.getWorkflow(workflowId, true);
  console.log("2. Current status:", status.status);

  // ── Pause ─────────────────────────────────────────────────────────
  await workflowClient.pause(workflowId);
  const afterPause = await workflowClient.getWorkflow(workflowId, true);
  console.log("3. After pause:", afterPause.status);

  // ── Resume ────────────────────────────────────────────────────────
  await workflowClient.resume(workflowId);
  const afterResume = await workflowClient.getWorkflow(workflowId, true);
  console.log("4. After resume:", afterResume.status);

  // ── Terminate ─────────────────────────────────────────────────────
  await workflowClient.terminate(workflowId, "Terminated by ops example");
  const afterTerminate = await workflowClient.getWorkflow(workflowId, true);
  console.log("5. After terminate:", afterTerminate.status);

  // ── Restart ───────────────────────────────────────────────────────
  await workflowClient.restart(workflowId, true);
  await sleep(1000);
  const afterRestart = await workflowClient.getWorkflow(workflowId, true);
  console.log("6. After restart:", afterRestart.status);

  // ── Terminate again to test retry ─────────────────────────────────
  await workflowClient.terminate(workflowId, "Terminate for retry test");
  await sleep(500);

  // ── Retry ─────────────────────────────────────────────────────────
  await workflowClient.retry(workflowId, false);
  await sleep(1000);
  const afterRetry = await workflowClient.getWorkflow(workflowId, true);
  console.log("7. After retry:", afterRetry.status);

  // ── Search ────────────────────────────────────────────────────────
  const searchResult = await workflowClient.search(
    0,
    5,
    `workflowType = 'workflow_ops_example'`,
    "*"
  );
  console.log("8. Search found", searchResult.totalHits, "workflow(s)");

  // ── Final cleanup — terminate and delete ──────────────────────────
  await workflowClient.terminate(workflowId, "Final cleanup");
  console.log("9. Terminated workflow for cleanup");

  await handler.stopWorkers();
  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
