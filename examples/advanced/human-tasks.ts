/**
 * Human Tasks — End-to-end human-in-the-loop workflow
 *
 * Demonstrates:
 *   - humanTask builder — adding a human task to a workflow
 *   - HumanExecutor — search, claim, update, complete human tasks
 *   - Workflow that pauses for human input, then continues
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/advanced/human-tasks.ts
 */
import {
  OrkesClients,
  ConductorWorkflow,
  humanTask,
  simpleTask,
  worker,
  TaskHandler,
} from "../../src/sdk";
import type { Task } from "../../src/open-api";

// Worker that processes the approved data after human review
const _processApproval = worker({
  taskDefName: "human_example_process_approval",
  pollInterval: 100,
})(async (task: Task) => {
  const approved = task.inputData?.approved;
  const reviewNotes = task.inputData?.reviewNotes;
  console.log(
    `  Processing approval: approved=${approved}, notes="${reviewNotes}"`
  );
  return {
    status: "COMPLETED" as const,
    outputData: {
      processed: true,
      decision: approved ? "APPROVED" : "REJECTED",
      reviewNotes,
    },
  };
});

async function main() {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();
  const humanExecutor = clients.getHumanClient();
  const client = clients.getClient();

  const workflowName = `human_tasks_example_${Date.now()}`;
  const humanTaskRef = "review_task";

  // ── 1. Define workflow with a human task ───────────────────────────
  console.log("=== 1. Register Workflow with Human Task ===\n");

  const wf = new ConductorWorkflow(workflowClient, workflowName)
    .description("Workflow with human review step")
    .add(
      humanTask(humanTaskRef, {
        displayName: "Review Order",
        assignee: {
          userType: "EXTERNAL_USER",
          user: "reviewer@example.com",
        },
        assignmentCompletionStrategy: "LEAVE_OPEN",
      })
    )
    .add(
      simpleTask("process_step", "human_example_process_approval", {
        approved: "${review_task.output.output.approved}",
        reviewNotes: "${review_task.output.output.reviewNotes}",
      })
    )
    .outputParameters({
      decision: "${process_step.output.decision}",
      reviewNotes: "${process_step.output.reviewNotes}",
    });

  await wf.register(true);
  console.log(`  Registered workflow: ${workflowName}\n`);

  // ── 2. Start workers ──────────────────────────────────────────────
  const handler = new TaskHandler({ client, scanForDecorated: true });
  await handler.startWorkers();

  // ── 3. Start the workflow ─────────────────────────────────────────
  console.log("=== 2. Start Workflow ===\n");

  const workflowId = await workflowClient.startWorkflow({
    name: workflowName,
    version: 1,
    input: { orderId: "ORD-12345", amount: 500 },
  });
  console.log(`  Workflow started: ${workflowId}\n`);

  // ── 4. Search for the pending human task ──────────────────────────
  console.log("=== 3. Search for Pending Human Tasks ===\n");

  // Poll until the human task appears (may be PENDING or ASSIGNED depending on server config)
  const pendingTasks = await humanExecutor.pollSearch(
    {
      states: ["PENDING", "ASSIGNED"],
      taskRefNames: [humanTaskRef],
    },
    { pollInterval: 1000, maxPollTimes: 30 }
  );

  if (pendingTasks.length === 0) {
    console.log("  No pending human tasks found. Exiting.");
    await handler.stopWorkers();
    process.exit(1);
  }

  const humanTaskEntry = pendingTasks[0];
  const humanTaskId = humanTaskEntry.taskId!;
  console.log(`  Found human task: ${humanTaskId}`);
  console.log(`  State: ${humanTaskEntry.state}`);
  console.log(`  Display name: ${humanTaskEntry.humanTaskDef?.displayName}\n`);

  // ── 5. Get task details ───────────────────────────────────────────
  console.log("=== 4. Get Task Details ===\n");

  const taskDetail = await humanExecutor.getTaskById(humanTaskId);
  console.log(`  Task ID: ${taskDetail.taskId}`);
  console.log(`  Workflow ID: ${taskDetail.workflowId}\n`);

  // ── 6. Claim the task ─────────────────────────────────────────────
  console.log("=== 5. Claim Task ===\n");

  const claimed = await humanExecutor.claimTaskAsExternalUser(
    humanTaskId,
    "reviewer@example.com",
    { overrideAssignment: true }
  );
  console.log(`  Claimed task, state: ${claimed.state}\n`);

  // ── 7. Update task output (partial) ───────────────────────────────
  console.log("=== 6. Update Task Output ===\n");

  await humanExecutor.updateTaskOutput(humanTaskId, {
    output: { reviewNotes: "Looks good, amount within limits" },
  });
  console.log("  Updated task output with review notes\n");

  // ── 8. Complete the human task ────────────────────────────────────
  console.log("=== 7. Complete Human Task ===\n");

  await humanExecutor.completeTask(humanTaskId, {
    output: { approved: true, reviewNotes: "Approved - within policy limits" },
  });
  console.log("  Completed human task with approval\n");

  // ── 9. Wait for workflow completion ───────────────────────────────
  console.log("=== 8. Wait for Workflow Completion ===\n");

  let status = "RUNNING";
  for (let i = 0; i < 30; i++) {
    const execution = await workflowClient.getExecution(workflowId);
    status = execution.status ?? "RUNNING";
    if (status !== "RUNNING") break;
    await new Promise((r) => setTimeout(r, 1000));
  }

  const result = await workflowClient.getExecution(workflowId);
  console.log(`  Workflow status: ${result.status}`);
  console.log(`  Output: ${JSON.stringify(result.output, null, 2)}\n`);

  // ── Cleanup ───────────────────────────────────────────────────────
  await handler.stopWorkers();
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
