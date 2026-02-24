/**
 * HTTP Poll — Polling an external endpoint with backoff
 *
 * Demonstrates httpPollTask for:
 *   - Polling an HTTP endpoint until a condition is met
 *   - Configurable polling intervals and strategies
 *   - Termination conditions
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/advanced/http-poll.ts
 */
import {
  OrkesClients,
  ConductorWorkflow,
  httpPollTask,
  simpleTask,
  worker,
  TaskHandler,
} from "../../src/sdk";
import type { Task, TaskResult } from "../../src/open-api";

const processResult = worker({ taskDefName: "hp_process_result", registerTaskDef: true })(
  async (task: Task) => {
    const pollResult = task.inputData?.pollResult;
    return {
      status: "COMPLETED",
      outputData: { processed: true, data: pollResult },
    };
  }
);

async function main() {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();
  const client = clients.getClient();

  // ── Workflow with HTTP poll task ──────────────────────────────────
  const wf = new ConductorWorkflow(workflowClient, "http_poll_example")
    .description("Demonstrates HTTP polling with backoff");

  // Poll a public API endpoint
  wf.add(
    httpPollTask("poll_ref", {
      http_request: {
        uri: "${workflow.input.pollUrl}",
        method: "GET",
        connectionTimeOut: 5000,
        readTimeOut: 5000,
      },
      pollingInterval: 2, // seconds between polls
      pollingStrategy: "FIXED",
      terminationCondition:
        '(function(){ return $.output.statusCode === 200; })()',
    })
  );

  // Process the poll result
  wf.add(
    simpleTask("process_ref", "hp_process_result", {
      pollResult: "${poll_ref.output.body}",
    })
  );

  wf.outputParameters({
    pollStatus: "${poll_ref.output.statusCode}",
    result: "${process_ref.output}",
  });

  await wf.register(true);
  console.log("Registered workflow:", wf.getName());

  // ── Workflow with linear backoff ──────────────────────────────────
  const wf2 = new ConductorWorkflow(
    workflowClient,
    "http_poll_backoff_example"
  )
    .description("HTTP polling with linear backoff strategy");

  wf2.add(
    httpPollTask("poll_backoff_ref", {
      http_request: {
        uri: "${workflow.input.pollUrl}",
        method: "GET",
      },
      pollingInterval: 1,
      pollingStrategy: "LINEAR_BACKOFF",
      terminationCondition:
        '(function(){ return $.output.body && $.output.body.status === "ready"; })()',
    })
  );

  wf2.outputParameters({
    result: "${poll_backoff_ref.output.body}",
  });

  await wf2.register(true);
  console.log("Registered workflow:", wf2.getName());

  // Execute with a public API
  const handler = new TaskHandler({ client, scanForDecorated: true });
  await handler.startWorkers();

  console.log("\nExecuting fixed-interval poll...");
  const run = await wf.execute({
    pollUrl: "https://jsonplaceholder.typicode.com/posts/1",
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
