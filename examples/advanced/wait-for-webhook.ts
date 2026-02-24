/**
 * Wait for Webhook — Webhook-driven workflow pauses
 *
 * Demonstrates waitForWebhookTask for:
 *   - Pausing a workflow until an external webhook signal arrives
 *   - Matching webhooks to workflows using correlation
 *   - Processing webhook payloads after resumption
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/advanced/wait-for-webhook.ts
 */
import {
  OrkesClients,
  ConductorWorkflow,
  TaskHandler,
  worker,
  simpleTask,
  waitForWebhookTask,
} from "../../src/sdk";
import type { Task, TaskResult } from "../../src/open-api";

const processWebhookPayload = worker({ taskDefName: "wh_process_payload", registerTaskDef: true })(
  async (task: Task) => {
    const payload = task.inputData?.webhookPayload as Record<string, unknown>;
    return {
      status: "COMPLETED",
      outputData: {
        processed: true,
        paymentId: payload?.paymentId,
        status: payload?.status,
        amount: payload?.amount,
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

  // ── Build webhook-driven workflow ─────────────────────────────────
  const wf = new ConductorWorkflow(
    workflowClient,
    "wait_for_webhook_example"
  )
    .description("Pauses until external webhook signal arrives")
    .timeoutSeconds(3600);

  // Step 1: Initiate something (e.g., payment)
  wf.add(
    simpleTask("initiate_ref", "wh_process_payload", {
      webhookPayload: { action: "initiate", orderId: "${workflow.input.orderId}" },
    })
  );

  // Step 2: Wait for webhook (e.g., payment confirmation)
  wf.add(
    waitForWebhookTask("webhook_wait_ref", {
      matches: {
        "orderId": "${workflow.input.orderId}",
      },
    })
  );

  // Step 3: Process the webhook payload
  wf.add(
    simpleTask("process_ref", "wh_process_payload", {
      webhookPayload: "${webhook_wait_ref.output}",
    })
  );

  wf.outputParameters({
    orderId: "${workflow.input.orderId}",
    initiated: "${initiate_ref.output.processed}",
    webhookData: "${webhook_wait_ref.output}",
    finalResult: "${process_ref.output}",
  });

  await wf.register(true);
  console.log("Registered workflow:", wf.getName());

  const handler = new TaskHandler({ client, scanForDecorated: true });
  await handler.startWorkers();

  // ── Start workflow — it will pause at webhook wait ────────────────
  const workflowId = await wf.startWorkflow({ orderId: "ORD-webhook-123" });
  console.log("Started workflow:", workflowId);
  console.log("Workflow will pause waiting for webhook...");

  // Wait for it to reach the webhook task
  await sleep(3000);

  const status = await workflowClient.getWorkflow(workflowId, true);
  console.log("Current status:", status.status);

  // Find the waiting webhook task
  const webhookTask = status.tasks?.find(
    (t) =>
      t.taskReferenceName === "webhook_wait_ref" &&
      t.status === "IN_PROGRESS"
  );

  if (webhookTask?.taskId) {
    console.log("\nSimulating webhook callback...");

    // Simulate external webhook completing the task
    await taskClient.updateTaskResult(
      workflowId,
      "webhook_wait_ref",
      "COMPLETED",
      {
        paymentId: "PAY-456",
        status: "confirmed",
        amount: 99.99,
        provider: "stripe",
        timestamp: new Date().toISOString(),
      }
    );
    console.log("Webhook signal sent. Workflow continuing...");

    // Wait for completion
    await sleep(3000);

    const finalStatus = await workflowClient.getWorkflow(workflowId, true);
    console.log("\nFinal status:", finalStatus.status);
    console.log("Output:", JSON.stringify(finalStatus.output, null, 2));
  } else {
    console.log("Webhook task not found in expected state.");
  }

  await handler.stopWorkers();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
