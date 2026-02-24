/**
 * Test Workflows — Unit testing workflow definitions with mock outputs
 *
 * Demonstrates how to use the Conductor test APIs to verify workflow
 * behavior without running actual workers. Useful for CI/CD pipelines.
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/test-workflows.ts
 */
import {
  OrkesClients,
  ConductorWorkflow,
  simpleTask,
  switchTask,
} from "../src/sdk";

async function main() {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();

  // ── Define a workflow to test ─────────────────────────────────────
  const wf = new ConductorWorkflow(workflowClient, "test_order_workflow")
    .description("Order workflow used for testing")
    .add(
      simpleTask("validate_ref", "validate_order", {
        orderId: "${workflow.input.orderId}",
      })
    )
    .add(
      switchTask(
        "route_ref",
        "${validate_ref.output.tier}",
        {
          premium: [
            simpleTask("premium_ref", "premium_handler", {
              orderId: "${validate_ref.output.orderId}",
            }),
          ],
          standard: [
            simpleTask("standard_ref", "standard_handler", {
              orderId: "${validate_ref.output.orderId}",
            }),
          ],
        }
      )
    )
    .outputParameters({
      orderId: "${validate_ref.output.orderId}",
      tier: "${validate_ref.output.tier}",
    });

  await wf.register(true);
  console.log("Registered test workflow:", wf.getName());

  // ── Test 1: Premium path ──────────────────────────────────────────
  console.log("\n--- Test 1: Premium tier ---");
  const premiumRun = await workflowClient.testWorkflow({
    name: wf.getName(),
    version: wf.getVersion(),
    workflowDef: wf.toWorkflowDef(),
    input: { orderId: "ORD-001" },
    taskRefToMockOutput: {
      validate_ref: [
        {
          status: "COMPLETED",
          output: { orderId: "ORD-001", tier: "premium", valid: true },
        },
      ],
      premium_ref: [
        {
          status: "COMPLETED",
          output: { handled: true, priority: "high" },
        },
      ],
    },
  });
  console.log("Status:", premiumRun.status);
  console.log("Output:", JSON.stringify(premiumRun.output, null, 2));
  console.log(
    "Premium path taken:",
    premiumRun.output?.tier === "premium" ? "PASS" : "FAIL"
  );

  // ── Test 2: Standard path ─────────────────────────────────────────
  console.log("\n--- Test 2: Standard tier ---");
  const standardRun = await workflowClient.testWorkflow({
    name: wf.getName(),
    version: wf.getVersion(),
    workflowDef: wf.toWorkflowDef(),
    input: { orderId: "ORD-002" },
    taskRefToMockOutput: {
      validate_ref: [
        {
          status: "COMPLETED",
          output: { orderId: "ORD-002", tier: "standard", valid: true },
        },
      ],
      standard_ref: [
        {
          status: "COMPLETED",
          output: { handled: true, priority: "normal" },
        },
      ],
    },
  });
  console.log("Status:", standardRun.status);
  console.log("Output:", JSON.stringify(standardRun.output, null, 2));
  console.log(
    "Standard path taken:",
    standardRun.output?.tier === "standard" ? "PASS" : "FAIL"
  );

  // ── Test 3: Failed validation ─────────────────────────────────────
  console.log("\n--- Test 3: Validation failure ---");
  const failedRun = await workflowClient.testWorkflow({
    name: wf.getName(),
    version: wf.getVersion(),
    workflowDef: wf.toWorkflowDef(),
    input: { orderId: "" },
    taskRefToMockOutput: {
      validate_ref: [
        {
          status: "FAILED",
          output: { error: "Invalid order ID" },
        },
      ],
    },
  });
  console.log("Status:", failedRun.status);
  console.log(
    "Workflow failed as expected:",
    failedRun.status === "FAILED" ? "PASS" : "FAIL"
  );

  console.log("\nAll tests completed.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
