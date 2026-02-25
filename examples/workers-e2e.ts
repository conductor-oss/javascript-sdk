/**
 * Workers End-to-End — Multiple workers chained in a single workflow
 *
 * Defines 3 workers, builds a workflow that chains them, executes it,
 * and verifies all workers contributed to the output.
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/workers-e2e.ts
 */
import {
  OrkesClients,
  ConductorWorkflow,
  TaskHandler,
  worker,
  simpleTask,
  NonRetryableException,
} from "../src/sdk";
import type { Task } from "../src/open-api";

// ── Worker 1: Validate input ────────────────────────────────────────
// Demonstrates NonRetryableException for permanent failures (no retry).
const _validate = worker({ taskDefName: "e2e_validate", registerTaskDef: true })(
  async (task: Task) => {
    const orderId = task.inputData?.orderId as string;
    if (!orderId) {
      // NonRetryableException → FAILED_WITH_TERMINAL_ERROR (won't retry)
      throw new NonRetryableException("Missing orderId — cannot process");
    }
    return {
      status: "COMPLETED",
      outputData: { orderId, valid: true },
    };
  }
);

// ── Worker 2: Process order ─────────────────────────────────────────
const _processOrder = worker({ taskDefName: "e2e_process", registerTaskDef: true })(
  async (task: Task) => {
    const orderId = task.inputData?.orderId as string;
    // Simulate processing
    const total = Math.round(Math.random() * 10000) / 100;
    return {
      status: "COMPLETED",
      outputData: { orderId, total, processed: true },
    };
  }
);

// ── Worker 3: Send confirmation ─────────────────────────────────────
const _confirm = worker({ taskDefName: "e2e_confirm", registerTaskDef: true })(
  async (task: Task) => {
    const orderId = task.inputData?.orderId as string;
    const total = task.inputData?.total as number;
    return {
      status: "COMPLETED",
      outputData: {
        orderId,
        total,
        confirmation: `Order ${orderId} confirmed for $${total}`,
      },
    };
  }
);

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();
  const client = clients.getClient();

  const wf = new ConductorWorkflow(workflowClient, "e2e_order_workflow")
    .description("End-to-end order processing with 3 chained workers")
    .add(
      simpleTask("validate_ref", "e2e_validate", {
        orderId: "${workflow.input.orderId}",
      })
    )
    .add(
      simpleTask("process_ref", "e2e_process", {
        orderId: "${validate_ref.output.orderId}",
      })
    )
    .add(
      simpleTask("confirm_ref", "e2e_confirm", {
        orderId: "${process_ref.output.orderId}",
        total: "${process_ref.output.total}",
      })
    )
    .outputParameters({
      valid: "${validate_ref.output.valid}",
      processed: "${process_ref.output.processed}",
      confirmation: "${confirm_ref.output.confirmation}",
    });

  await wf.register(true);
  console.log("Registered workflow:", wf.getName());

  const handler = new TaskHandler({ client, scanForDecorated: true });
  await handler.startWorkers();

  // Execute
  const run = await wf.execute({ orderId: "ORD-12345" });
  console.log("Status:", run.status);
  console.log("Output:", JSON.stringify(run.output, null, 2));

  // Verify all workers executed
  const output = run.output as Record<string, unknown>;
  console.log("\nVerification:");
  console.log("  Validated:", output?.valid === true ? "PASS" : "FAIL");
  console.log("  Processed:", output?.processed === true ? "PASS" : "FAIL");
  console.log("  Confirmed:", output?.confirmation ? "PASS" : "FAIL");

  await handler.stopWorkers();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
