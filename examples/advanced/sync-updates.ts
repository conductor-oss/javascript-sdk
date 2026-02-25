/**
 * Sync Updates — Update workflow state and variables at runtime
 *
 * Demonstrates updating a running workflow's variables and task outputs
 * from outside the workflow, useful for:
 *   - External system integration
 *   - Manual interventions
 *   - Dynamic workflow behavior changes
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/advanced/sync-updates.ts
 */
import {
  OrkesClients,
  ConductorWorkflow,
  TaskHandler,
  worker,
  simpleTask,
  waitTaskDuration,
} from "../../src/sdk";
import type { Task } from "../../src/open-api";

const _checkVars = worker({ taskDefName: "su_check_vars", registerTaskDef: true })(
  async (task: Task) => {
    return {
      status: "COMPLETED",
      outputData: {
        receivedInput: task.inputData,
        timestamp: new Date().toISOString(),
      },
    };
  }
);

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();
  const taskClient = clients.getTaskClient();
  const client = clients.getClient();

  // Build workflow with a WAIT task that we can update externally
  const wf = new ConductorWorkflow(workflowClient, "sync_updates_example")
    .description("Demonstrates runtime state updates")
    .timeoutSeconds(300)
    .variables({ externalData: null, updateCount: 0 })
    .add(simpleTask("pre_ref", "su_check_vars", { step: "before_wait" }))
    .add(waitTaskDuration("wait_ref", "120s")) // Long wait for external update
    .add(
      simpleTask("post_ref", "su_check_vars", {
        step: "after_wait",
        externalData: "${wait_ref.output.externalData}",
      })
    )
    .outputParameters({
      preStep: "${pre_ref.output}",
      waitOutput: "${wait_ref.output}",
      postStep: "${post_ref.output}",
    });

  await wf.register(true);
  console.log("Registered workflow:", wf.getName());

  const handler = new TaskHandler({ client, scanForDecorated: true });
  await handler.startWorkers();

  // Start workflow (async — it will pause at WAIT)
  const workflowId = await wf.startWorkflow({ note: "sync update demo" });
  console.log("Started workflow:", workflowId);

  // Wait for it to reach the WAIT task
  await sleep(3000);

  // ── 1. Check current state ────────────────────────────────────────
  const status1 = await workflowClient.getWorkflow(workflowId, true);
  console.log("\n1. Current status:", status1.status);
  console.log("   Variables:", JSON.stringify(status1.variables));

  // ── 2. Update variables on the running workflow ───────────────────
  try {
    await workflowClient.updateVariables(workflowId, {
      externalData: { source: "external_api", value: 42 },
      updateCount: 1,
    });
    console.log("2. Updated workflow variables");
  } catch (err) {
    console.log("2. updateVariables not available:", (err as Error).message);
  }

  // ── 3. Complete the WAIT task with external data ──────────────────
  const currentStatus = await workflowClient.getWorkflow(workflowId, true);
  const waitingTask = currentStatus.tasks?.find(
    (t) =>
      t.taskReferenceName === "wait_ref" && t.status === "IN_PROGRESS"
  );

  if (waitingTask?.taskId) {
    await taskClient.updateTaskResult(
      workflowId,
      "wait_ref",
      "COMPLETED",
      {
        externalData: { message: "Data from external system", value: 42 },
        updatedBy: "sync-updates-example",
      }
    );
    console.log("3. Completed WAIT task with external data");
  }

  // Wait for workflow to complete
  await sleep(3000);

  // ── 4. Verify final state ─────────────────────────────────────────
  const finalStatus = await workflowClient.getWorkflow(workflowId, true);
  console.log("\n4. Final status:", finalStatus.status);
  console.log("   Output:", JSON.stringify(finalStatus.output, null, 2));

  await handler.stopWorkers();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
