/**
 * Sub-Workflows — Workflow composition and nesting
 *
 * Demonstrates:
 *   - subWorkflowTask() for referencing registered workflows
 *   - ConductorWorkflow.toSubWorkflowTask() for inline composition
 *   - Nested workflows passing data between parent and child
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/advanced/sub-workflows.ts
 */
import {
  OrkesClients,
  ConductorWorkflow,
  TaskHandler,
  worker,
  simpleTask,
  subWorkflowTask,
} from "../../src/sdk";
import type { Task } from "../../src/open-api";

// ── Workers ─────────────────────────────────────────────────────────
const _validateOrder = worker({ taskDefName: "sw_validate", registerTaskDef: true })(
  async (task: Task) => {
    const orderId = task.inputData?.orderId as string;
    return {
      status: "COMPLETED",
      outputData: { orderId, valid: true, validatedAt: new Date().toISOString() },
    };
  }
);

const _chargePayment = worker({ taskDefName: "sw_charge", registerTaskDef: true })(
  async (task: Task) => {
    const orderId = task.inputData?.orderId as string;
    const amount = (task.inputData?.amount as number) ?? 0;
    return {
      status: "COMPLETED",
      outputData: {
        orderId,
        amount,
        charged: true,
        transactionId: `TXN-${Date.now()}`,
      },
    };
  }
);

const _shipOrder = worker({ taskDefName: "sw_ship", registerTaskDef: true })(
  async (task: Task) => {
    const orderId = task.inputData?.orderId as string;
    return {
      status: "COMPLETED",
      outputData: {
        orderId,
        shipped: true,
        trackingNumber: `TRACK-${Date.now()}`,
      },
    };
  }
);

const _notifyCustomer = worker({ taskDefName: "sw_notify", registerTaskDef: true })(
  async (task: Task) => {
    const orderId = task.inputData?.orderId as string;
    const tracking = task.inputData?.trackingNumber as string;
    return {
      status: "COMPLETED",
      outputData: {
        orderId,
        notified: true,
        message: `Order ${orderId} shipped. Tracking: ${tracking}`,
      },
    };
  }
);

async function main() {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();
  const client = clients.getClient();

  // ── 1. Define sub-workflows ───────────────────────────────────────

  // Payment sub-workflow (registered)
  const paymentWf = new ConductorWorkflow(workflowClient, "sw_payment_flow")
    .description("Handles payment processing")
    .add(
      simpleTask("charge_ref", "sw_charge", {
        orderId: "${workflow.input.orderId}",
        amount: "${workflow.input.amount}",
      })
    )
    .outputParameters({
      transactionId: "${charge_ref.output.transactionId}",
      charged: "${charge_ref.output.charged}",
    });

  await paymentWf.register(true);
  console.log("Registered sub-workflow: sw_payment_flow");

  // Shipping sub-workflow (will be used inline)
  const shippingWf = new ConductorWorkflow(workflowClient, "sw_shipping_flow")
    .description("Handles shipping")
    .add(
      simpleTask("ship_ref", "sw_ship", {
        orderId: "${workflow.input.orderId}",
      })
    )
    .add(
      simpleTask("notify_ref", "sw_notify", {
        orderId: "${workflow.input.orderId}",
        trackingNumber: "${ship_ref.output.trackingNumber}",
      })
    )
    .outputParameters({
      trackingNumber: "${ship_ref.output.trackingNumber}",
      notification: "${notify_ref.output.message}",
    });

  // ── 2. Define parent workflow ─────────────────────────────────────
  const mainWf = new ConductorWorkflow(workflowClient, "sub_workflows_example")
    .description("Parent workflow composing sub-workflows");

  // Validate order
  mainWf.add(
    simpleTask("validate_ref", "sw_validate", {
      orderId: "${workflow.input.orderId}",
    })
  );

  // Sub-workflow 1: Payment (reference by name — pre-registered)
  mainWf.add(subWorkflowTask("payment_sub_ref", "sw_payment_flow", 1));

  // Sub-workflow 2: Shipping (inline — embedded in parent)
  mainWf.add(shippingWf.toSubWorkflowTask("shipping_sub_ref"));

  mainWf.outputParameters({
    orderId: "${workflow.input.orderId}",
    validated: "${validate_ref.output.valid}",
    transactionId: "${payment_sub_ref.output.transactionId}",
    trackingNumber: "${shipping_sub_ref.output.trackingNumber}",
    notification: "${shipping_sub_ref.output.notification}",
  });

  await mainWf.register(true);
  console.log("Registered parent workflow:", mainWf.getName());

  // ── 3. Execute ────────────────────────────────────────────────────
  const handler = new TaskHandler({ client, scanForDecorated: true });
  await handler.startWorkers();

  const run = await mainWf.execute({
    orderId: "ORD-SUB-001",
    amount: 249.99,
  });

  console.log("\nStatus:", run.status);
  console.log("Output:", JSON.stringify(run.output, null, 2));

  await handler.stopWorkers();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
