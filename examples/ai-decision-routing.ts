/**
 * Route a request with one synchronous, decision-backed SWITCH and inline branches.
 * The server evaluates the decision; no JavaScript worker is needed.
 *
 * CONDUCTOR_SERVER_URL=http://localhost:8081/api CONDUCTOR_DECISION_PROVIDER=openrouter \
 *   npx tsx examples/ai-decision-routing.ts [--request "Product crashes on startup"]
 */
import { parseArgs } from "node:util";
import { setTimeout } from "node:timers/promises";
import { ConductorWorkflow, OrkesClients, inlineTask, switchTask } from "../src/sdk";
import type { WorkflowExecutor } from "../src/sdk";

export function createWorkflow(executor: WorkflowExecutor, model = "jev-1.13", provider?: string) {
  const billing = inlineTask("handle_billing", '({team: "billing", nextAction: "review_invoice", message: "Check invoice line items and payment records.", request: $.request})');
  billing.inputParameters.request = "${workflow.input.request}";
  const technical = inlineTask("handle_technical", '({team: "technical", nextAction: "collect_diagnostics", message: "Collect error logs and steps to reproduce.", request: $.request})');
  technical.inputParameters.request = "${workflow.input.request}";

  const decision = switchTask("route_request", "route", { billing: [billing], technical: [technical] });
  decision.evaluatorType = "decision";
  decision.expression = "route";
  decision.inputParameters = {
    model,
    ...(provider !== undefined && { provider }),
    state: "${workflow.input.request}",
    questions: {
      route: {
        type: "choice",
        instructions: "Choose the team best suited to handle this request.",
        choices: {
          billing: "Payments, invoices, refunds, or subscriptions.",
          technical: "Errors, outages, or product troubleshooting.",
        },
      },
    },
  };
  const result = inlineTask("selected_result", "$.billing || $.technical");
  result.inputParameters.billing = "${handle_billing.output.result}";
  result.inputParameters.technical = "${handle_technical.output.result}";
  return new ConductorWorkflow(executor, "ai_decision_routing_javascript", 1)
    .add([decision, result])
    .outputParameters({
      selectedCase: "${route_request.output.selectedCase}",
      answers: "${route_request.output.answers}",
      usage: "${route_request.output.usage}",
      cost: "${route_request.output.usage.cost}",
      latencyMs: "${route_request.output.latencyMs}",
      result: "${selected_result.output.result}",
    });
}

async function main() {
  const { values } = parseArgs({ options: {
    request: { type: "string", default: "I was charged twice on my latest invoice." },
    model: { type: "string", default: "jev-1.13" },
    provider: { type: "string", default: process.env.CONDUCTOR_DECISION_PROVIDER },
  } });
  const clients = await OrkesClients.from();
  const executor = clients.getWorkflowClient();
  const workflow = createWorkflow(executor, values.model, values.provider);
  await workflow.register(true);
  const id = await workflow.startWorkflow({ request: values.request });
  console.log("Workflow:", id);
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const run = await executor.getWorkflow(id, false);
    if (["COMPLETED", "FAILED", "TIMED_OUT", "TERMINATED"].includes(run.status ?? "")) {
      if (run.status !== "COMPLETED") throw new Error(`${run.status}: ${run.reasonForIncompletion}`);
      console.log(JSON.stringify(run.output, null, 2));
      return;
    }
    await setTimeout(1000);
  }
  throw new Error(`Timed out waiting for workflow ${id}`);
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
