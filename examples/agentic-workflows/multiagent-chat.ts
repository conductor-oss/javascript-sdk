/**
 * Multi-Agent Chat — Multiple LLM agents debate a topic
 *
 * Demonstrates a multi-agent architecture where:
 *   - An "optimist" agent argues for a position
 *   - A "skeptic" agent argues against
 *   - A "moderator" summarizes and decides the winner
 *
 * Uses switchTask to route between agents and doWhileTask for rounds.
 *
 * Prerequisites:
 *   - An LLM integration configured in Conductor
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/agentic-workflows/multiagent-chat.ts
 */
import {
  OrkesClients,
  ConductorWorkflow,
  llmChatCompleteTask,
  setVariableTask,
  Role,
} from "../../src/sdk";

async function main() {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();

  const provider = process.env.LLM_PROVIDER ?? "openai_integration";
  const model = process.env.LLM_MODEL ?? "gpt-4o";

  const wf = new ConductorWorkflow(workflowClient, "multiagent_chat_example")
    .description("Multi-agent debate: optimist vs skeptic with moderator");

  // Initialize
  wf.add(
    setVariableTask("init_ref", {
      round: 0,
      topic: "${workflow.input.topic}",
    })
  );

  // Round 1: Optimist opens
  wf.add(
    llmChatCompleteTask("optimist_ref", provider, model, {
      messages: [
        {
          role: Role.SYSTEM,
          message:
            "You are an optimistic debater. Present a compelling positive argument for the topic. Be concise (under 150 words).",
        },
        {
          role: Role.USER,
          message: "Topic: ${workflow.input.topic}. Make your opening argument.",
        },
      ],
      temperature: 0.7,
      maxTokens: 300,
    })
  );

  // Round 1: Skeptic responds
  wf.add(
    llmChatCompleteTask("skeptic_ref", provider, model, {
      messages: [
        {
          role: Role.SYSTEM,
          message:
            "You are a skeptical debater. Counter the optimist's argument with evidence-based concerns. Be concise (under 150 words).",
        },
        {
          role: Role.USER,
          message:
            'Topic: ${workflow.input.topic}. The optimist argued: "${optimist_ref.output.result}". Counter this argument.',
        },
      ],
      temperature: 0.7,
      maxTokens: 300,
    })
  );

  // Round 2: Optimist rebuts
  wf.add(
    llmChatCompleteTask("optimist_rebuttal_ref", provider, model, {
      messages: [
        {
          role: Role.SYSTEM,
          message:
            "You are an optimistic debater. Address the skeptic's concerns and strengthen your position. Be concise (under 150 words).",
        },
        {
          role: Role.USER,
          message:
            'Your opening: "${optimist_ref.output.result}". Skeptic countered: "${skeptic_ref.output.result}". Provide your rebuttal.',
        },
      ],
      temperature: 0.7,
      maxTokens: 300,
    })
  );

  // Round 2: Skeptic rebuts
  wf.add(
    llmChatCompleteTask("skeptic_rebuttal_ref", provider, model, {
      messages: [
        {
          role: Role.SYSTEM,
          message:
            "You are a skeptical debater. Give your final counter-argument. Be concise (under 150 words).",
        },
        {
          role: Role.USER,
          message:
            'Your counter: "${skeptic_ref.output.result}". Optimist rebutted: "${optimist_rebuttal_ref.output.result}". Final response.',
        },
      ],
      temperature: 0.7,
      maxTokens: 300,
    })
  );

  // Moderator judges
  wf.add(
    llmChatCompleteTask("moderator_ref", provider, model, {
      messages: [
        {
          role: Role.SYSTEM,
          message:
            "You are an impartial debate moderator. Summarize both sides, declare a winner with reasoning, and provide a balanced conclusion. Keep it under 200 words.",
        },
        {
          role: Role.USER,
          message: `Topic: \${workflow.input.topic}

Optimist's opening: "\${optimist_ref.output.result}"
Skeptic's counter: "\${skeptic_ref.output.result}"
Optimist's rebuttal: "\${optimist_rebuttal_ref.output.result}"
Skeptic's rebuttal: "\${skeptic_rebuttal_ref.output.result}"

Please judge this debate.`,
        },
      ],
      temperature: 0.3,
      maxTokens: 400,
    })
  );

  wf.outputParameters({
    topic: "${workflow.input.topic}",
    optimistOpening: "${optimist_ref.output.result}",
    skepticCounter: "${skeptic_ref.output.result}",
    optimistRebuttal: "${optimist_rebuttal_ref.output.result}",
    skepticRebuttal: "${skeptic_rebuttal_ref.output.result}",
    moderatorVerdict: "${moderator_ref.output.result}",
  });

  await wf.register(true);
  console.log("Registered workflow:", wf.getName());

  const run = await wf.execute({
    topic:
      process.argv[2] ?? "Should AI be used to make hiring decisions?",
  });

  console.log("Status:", run.status);
  const output = run.output as Record<string, string>;
  console.log("\n=== DEBATE ===");
  console.log(`Topic: ${output?.topic}`);
  console.log(`\n[Optimist] ${output?.optimistOpening}`);
  console.log(`\n[Skeptic] ${output?.skepticCounter}`);
  console.log(`\n[Optimist Rebuttal] ${output?.optimistRebuttal}`);
  console.log(`\n[Skeptic Rebuttal] ${output?.skepticRebuttal}`);
  console.log(`\n[MODERATOR VERDICT] ${output?.moderatorVerdict}`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
