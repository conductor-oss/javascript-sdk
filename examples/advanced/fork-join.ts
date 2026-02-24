/**
 * Fork/Join — Parallel task execution with join synchronization
 *
 * Demonstrates:
 *   - ConductorWorkflow.fork() for parallel branches with auto-join
 *   - Multiple independent tasks running concurrently
 *   - Aggregating results after join
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/advanced/fork-join.ts
 */
import {
  OrkesClients,
  ConductorWorkflow,
  TaskHandler,
  worker,
  simpleTask,
  inlineTask,
} from "../../src/sdk";
import type { Task, TaskResult } from "../../src/open-api";

// ── Workers for parallel branches ───────────────────────────────────
const fetchUser = worker({ taskDefName: "fj_fetch_user", registerTaskDef: true })(
  async (task: Task) => {
    const userId = task.inputData?.userId as string;
    return {
      status: "COMPLETED",
      outputData: { userId, name: "Jane Doe", email: "jane@example.com" },
    };
  }
);

const fetchOrders = worker({ taskDefName: "fj_fetch_orders", registerTaskDef: true })(
  async (task: Task) => {
    const userId = task.inputData?.userId as string;
    // Simulate fetching orders
    await new Promise((resolve) => setTimeout(resolve, 50));
    return {
      status: "COMPLETED",
      outputData: {
        userId,
        orders: [
          { id: "ORD-1", total: 99.99 },
          { id: "ORD-2", total: 149.50 },
        ],
      },
    };
  }
);

const fetchPreferences = worker({ taskDefName: "fj_fetch_preferences", registerTaskDef: true })(
  async (task: Task) => {
    const userId = task.inputData?.userId as string;
    return {
      status: "COMPLETED",
      outputData: {
        userId,
        preferences: { theme: "dark", notifications: true, language: "en" },
      },
    };
  }
);

async function main() {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();
  const client = clients.getClient();

  // ── Approach 1: Using ConductorWorkflow.fork() ─────────────────────
  const wf1 = new ConductorWorkflow(
    workflowClient,
    "fork_join_helper_example"
  ).description("Parallel fetch using fork with 3 branches");

  wf1.fork([
    [
      simpleTask("user_ref", "fj_fetch_user", {
        userId: "${workflow.input.userId}",
      }),
    ],
    [
      simpleTask("orders_ref", "fj_fetch_orders", {
        userId: "${workflow.input.userId}",
      }),
    ],
    [
      simpleTask("prefs_ref", "fj_fetch_preferences", {
        userId: "${workflow.input.userId}",
      }),
    ],
  ]);

  // Aggregate results
  wf1.add(
    inlineTask(
      "aggregate_ref",
      `(function() {
        return {
          user: $.user_ref.output,
          orderCount: $.orders_ref.output.orders.length,
          theme: $.prefs_ref.output.preferences.theme
        };
      })()`,
      "javascript"
    )
  );

  wf1.outputParameters({
    user: "${user_ref.output}",
    orders: "${orders_ref.output.orders}",
    preferences: "${prefs_ref.output.preferences}",
    summary: "${aggregate_ref.output.result}",
  });

  await wf1.register(true);
  console.log("Registered workflow 1:", wf1.getName());

  // ── Approach 2: Using ConductorWorkflow.fork() ────────────────────
  const wf2 = new ConductorWorkflow(
    workflowClient,
    "fork_join_fluent_example"
  )
    .description("Parallel fetch using fluent fork API")
    .fork([
      [
        simpleTask("user_ref2", "fj_fetch_user", {
          userId: "${workflow.input.userId}",
        }),
      ],
      [
        simpleTask("orders_ref2", "fj_fetch_orders", {
          userId: "${workflow.input.userId}",
        }),
      ],
    ])
    .outputParameters({
      user: "${user_ref2.output}",
      orders: "${orders_ref2.output.orders}",
    });

  await wf2.register(true);
  console.log("Registered workflow 2:", wf2.getName());

  // Execute
  const handler = new TaskHandler({ client, scanForDecorated: true });
  await handler.startWorkers();

  console.log("\n--- Executing fork/join with helper ---");
  const run1 = await wf1.execute({ userId: "user-123" });
  console.log("Status:", run1.status);
  console.log("Output:", JSON.stringify(run1.output, null, 2));

  console.log("\n--- Executing fork/join with fluent API ---");
  const run2 = await wf2.execute({ userId: "user-456" });
  console.log("Status:", run2.status);
  console.log("Output:", JSON.stringify(run2.output, null, 2));

  await handler.stopWorkers();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
