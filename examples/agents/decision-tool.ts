/**
 * Use a branchless decision SWITCH as a tool inside a normal chat agent.
 * The server executes both inference calls; no JavaScript worker is needed.
 *
 * CONDUCTOR_SERVER_URL=http://localhost:8081/api CONDUCTOR_DECISION_PROVIDER=openrouter \
 *   npx tsx examples/agents/decision-tool.ts
 */
import { Agent, AgentRuntime } from "@io-orkes/conductor-javascript/agents";
import type { ToolDef } from "@io-orkes/conductor-javascript/agents";

export const classifyRequest: ToolDef = {
  name: "classify_request",
  description: "Classify the customer request before answering.",
  toolType: "decision",
  inputSchema: {
    type: "object",
    properties: { state: { type: "string" } },
    required: ["state"],
  },
  config: {
    model: "jev-1.13",
    ...(process.env.CONDUCTOR_DECISION_PROVIDER !== undefined && { provider: process.env.CONDUCTOR_DECISION_PROVIDER }),
    questions: {
      department: {
        type: "choice",
        instructions: "Choose the correct support department.",
        choices: { billing: "Payments and invoices", technical: "Product errors and troubleshooting" },
      },
    },
  },
};

export const supportAgent = new Agent({
  name: "decision_tool_support_javascript",
  model: process.env.CONDUCTOR_AGENT_LLM_MODEL ?? "openai/gpt-4o-mini",
  instructions: "Call classify_request before answering the customer.",
  tools: [classifyRequest],
});

async function main() {
  const runtime = new AgentRuntime();
  try {
    const result = await runtime.run(supportAgent, "I was charged twice on my latest invoice.", { timeoutSeconds: 120 });
    if (!result.isSuccess) throw new Error(`${result.status}: ${result.error}`);
    console.log("Execution:", result.executionId);
    console.log(JSON.stringify(result.output, null, 2));
  } finally {
    await runtime.shutdown();
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
