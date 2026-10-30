/**
 * Route to billing or technical chat agents using a decision ToolDef selector.
 * No JavaScript worker or parent chat model is needed.
 *
 * CONDUCTOR_SERVER_URL=http://localhost:8081/api CONDUCTOR_DECISION_PROVIDER=openrouter \
 *   npx tsx examples/agents/decision-router.ts [--run]
 * Without --run, prints the server-compiled plan without inference.
 */
import { Agent, AgentRuntime } from "@io-orkes/conductor-javascript/agents";
import type { ToolDef } from "@io-orkes/conductor-javascript/agents";

export function supportRouter() {
  const model = process.env.CONDUCTOR_AGENT_LLM_MODEL ?? "openai/gpt-4o-mini";
  const selector: ToolDef = {
    name: "support_selector",
    description: "Choose the support agent that should handle the request.",
    toolType: "decision",
    inputSchema: { type: "object", properties: {} },
    config: {
      model: "jev-1.13",
      ...(process.env.CONDUCTOR_DECISION_PROVIDER !== undefined && { provider: process.env.CONDUCTOR_DECISION_PROVIDER }),
      questions: {
        agent: {
          type: "choice",
          instructions: "Choose the right support team.",
          choices: { billing_javascript: "Payments and invoices", technical_javascript: "Product errors and troubleshooting" },
        },
      },
    },
  };
  return new Agent({
    name: "decision_support_router_javascript",
    strategy: "router",
    router: selector,
    agents: [
      new Agent({ name: "billing_javascript", model, instructions: "Help the customer with billing and invoice questions." }),
      new Agent({ name: "technical_javascript", model, instructions: "Help the customer troubleshoot product issues." }),
    ],
    maxTurns: 1,
    synthesize: false,
  });
}

async function main() {
  const runtime = new AgentRuntime();
  try {
    const agent = supportRouter();
    if (!process.argv.includes("--run")) {
      console.log(JSON.stringify(await runtime.plan(agent), null, 2));
      return;
    }
    await runtime.deploy(agent);
    const handle = await runtime.start(agent, "The customer reports a duplicate charge on the latest invoice.", { timeoutSeconds: 120 });
    console.log("Execution:", handle.executionId);
    const result = await handle.wait();
    if (!result.isSuccess) throw new Error(`${result.status}: ${result.error}`);
    console.log(JSON.stringify(result.output, null, 2));
  } finally {
    await runtime.shutdown();
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
