/**
 * LLM Chat — Multi-turn automated AI conversation
 *
 * Demonstrates two LLMs having a multi-turn conversation using
 * llmChatCompleteTask in a do-while loop. One acts as an interviewer,
 * the other as a subject matter expert.
 *
 * Prerequisites:
 *   - An LLM integration configured in Conductor (e.g., "openai_integration")
 *   - A model available (e.g., "gpt-4o")
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/agentic-workflows/llm-chat.ts
 */
import {
  OrkesClients,
  ConductorWorkflow,
  llmChatCompleteTask,
  inlineTask,
  setVariableTask,
  Role,
} from "../../src/sdk";

async function main() {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();

  const provider = process.env.LLM_PROVIDER ?? "openai_integration";
  const model = process.env.LLM_MODEL ?? "gpt-4o";

  const wf = new ConductorWorkflow(workflowClient, "llm_chat_example")
    .description("Two LLMs having a multi-turn conversation")
    .variables({ turnCount: 0, conversation: [] });

  // Initialize conversation with a topic
  wf.add(
    setVariableTask("init_ref", {
      turnCount: 0,
      topic: "${workflow.input.topic}",
    })
  );

  // Interviewer asks a question
  wf.add(
    llmChatCompleteTask("interviewer_ref", provider, model, {
      messages: [
        {
          role: Role.SYSTEM,
          message:
            "You are a curious interviewer. Ask thoughtful, concise questions about the topic. Keep responses under 100 words.",
        },
        {
          role: Role.USER,
          message:
            "Topic: ${workflow.input.topic}. This is turn ${init_ref.output.turnCount}. Ask your next question.",
        },
      ],
      temperature: 0.7,
      maxTokens: 200,
    })
  );

  // Expert responds
  wf.add(
    llmChatCompleteTask("expert_ref", provider, model, {
      messages: [
        {
          role: Role.SYSTEM,
          message:
            "You are a subject matter expert. Give clear, informative answers. Keep responses under 150 words.",
        },
        {
          role: Role.USER,
          message: "${interviewer_ref.output.result}",
        },
      ],
      temperature: 0.5,
      maxTokens: 300,
    })
  );

  // Track conversation turns
  wf.add(
    inlineTask(
      "track_ref",
      `(function() {
        var turn = ($.init_ref ? $.init_ref.output.turnCount : 0) + 1;
        return {
          turnCount: turn,
          interviewer: $.interviewer_ref.output.result,
          expert: $.expert_ref.output.result,
          done: turn >= $.maxTurns
        };
      })()`,
      "javascript"
    )
  );

  wf.outputParameters({
    topic: "${workflow.input.topic}",
    turns: "${track_ref.output.result.turnCount}",
    lastQuestion: "${interviewer_ref.output.result}",
    lastAnswer: "${expert_ref.output.result}",
  });

  await wf.register(true);
  console.log("Registered workflow:", wf.getName());

  // Execute
  const run = await wf.execute({
    topic: "The future of quantum computing",
    maxTurns: 3,
  });

  console.log("Status:", run.status);
  console.log("Output:", JSON.stringify(run.output, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
