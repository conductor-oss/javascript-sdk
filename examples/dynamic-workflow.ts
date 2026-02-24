/**
 * Dynamic Workflow — Build workflows programmatically at runtime
 *
 * Shows how to construct workflows using the ConductorWorkflow fluent builder
 * with dynamic task composition, conditional logic, and looping.
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/dynamic-workflow.ts
 */
import {
  OrkesClients,
  ConductorWorkflow,
  TaskHandler,
  worker,
  simpleTask,
  switchTask,
  doWhileTask,
  inlineTask,
} from "../src/sdk";
import type { Task, TaskResult } from "../src/open-api";

// ── Workers ─────────────────────────────────────────────────────────
@worker({ taskDefName: "fetch_data", registerTaskDef: true })
async function fetchData(task: Task): Promise<TaskResult> {
  const source = (task.inputData?.source as string) ?? "default";
  return {
    status: "COMPLETED",
    outputData: {
      records: [
        { id: 1, value: "alpha" },
        { id: 2, value: "beta" },
      ],
      source,
    },
  };
}

@worker({ taskDefName: "process_record", registerTaskDef: true })
async function processRecord(task: Task): Promise<TaskResult> {
  const record = task.inputData?.record as Record<string, unknown>;
  return {
    status: "COMPLETED",
    outputData: {
      processed: true,
      id: record?.id,
      result: `processed-${record?.value}`,
    },
  };
}

@worker({ taskDefName: "send_notification", registerTaskDef: true })
async function sendNotification(task: Task): Promise<TaskResult> {
  const channel = (task.inputData?.channel as string) ?? "email";
  const message = (task.inputData?.message as string) ?? "";
  console.log(`  [Notification] channel=${channel} message="${message}"`);
  return {
    status: "COMPLETED",
    outputData: { sent: true, channel },
  };
}

// ── Build the workflow dynamically ──────────────────────────────────
async function main() {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();
  const client = clients.getClient();

  const wf = new ConductorWorkflow(
    workflowClient,
    "dynamic_workflow_example"
  ).description("Programmatically built workflow with conditional + loop");

  // Step 1: Fetch data
  wf.add(
    simpleTask("fetch_ref", "fetch_data", {
      source: "${workflow.input.dataSource}",
    })
  );

  // Step 2: Loop through records
  wf.add(
    doWhileTask(
      "process_loop",
      'if ($.process_record_ref["processed"] == true) { false; } else { true; }',
      [
        simpleTask("process_record_ref", "process_record", {
          record: "${fetch_ref.output.records[0]}",
        }),
      ]
    )
  );

  // Step 3: Choose notification channel based on input
  wf.add(
    switchTask(
      "notification_switch",
      "${workflow.input.notifyChannel}",
      {
        email: [
          simpleTask("notify_email_ref", "send_notification", {
            channel: "email",
            message: "Processing complete via email",
          }),
        ],
        slack: [
          simpleTask("notify_slack_ref", "send_notification", {
            channel: "slack",
            message: "Processing complete via Slack",
          }),
        ],
      },
      [
        simpleTask("notify_default_ref", "send_notification", {
          channel: "log",
          message: "Processing complete (default channel)",
        }),
      ]
    )
  );

  // Step 4: Inline summary
  wf.add(
    inlineTask(
      "summary_ref",
      `
      (function() {
        return {
          totalRecords: $.fetch_ref.output.records.length,
          channel: $.workflow.input.notifyChannel || 'default'
        };
      })()
      `
    )
  );

  wf.outputParameters({
    summary: "${summary_ref.output.result}",
  });

  // Register and execute
  await wf.register(true);
  console.log("Registered dynamic workflow:", wf.getName());

  const handler = new TaskHandler({ client, scanForDecorated: true });
  await handler.startWorkers();

  const run = await wf.execute({
    dataSource: "api",
    notifyChannel: "email",
  });

  console.log("Status:", run.status);
  console.log("Output:", JSON.stringify(run.output, null, 2));

  await handler.stopWorkers();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
