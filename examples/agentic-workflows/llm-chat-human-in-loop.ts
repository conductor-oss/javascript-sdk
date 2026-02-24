/**
 * LLM Chat with Human-in-the-Loop — Interactive chat with WAIT pauses
 *
 * Demonstrates an LLM chat where the workflow pauses (WAIT task) for
 * human input between turns. The user updates the waiting task to continue.
 *
 * Prerequisites:
 *   - An LLM integration configured in Conductor
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/agentic-workflows/llm-chat-human-in-loop.ts
 */
import {
  OrkesClients,
  ConductorWorkflow,
  llmChatCompleteTask,
  waitTaskDuration,
  Role,
} from "../../src/sdk";

async function main() {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();
  const taskClient = clients.getTaskClient();

  const provider = process.env.LLM_PROVIDER ?? "openai_integration";
  const model = process.env.LLM_MODEL ?? "gpt-4o";

  // ── Define workflow with WAIT for human input ─────────────────────
  const wf = new ConductorWorkflow(
    workflowClient,
    "llm_chat_human_in_loop"
  )
    .description("Interactive LLM chat with human-in-the-loop WAIT tasks")
    .timeoutSeconds(3600);

  // Initial LLM greeting
  wf.add(
    llmChatCompleteTask("greeting_ref", provider, model, {
      messages: [
        {
          role: Role.SYSTEM,
          message:
            "You are a helpful assistant. Greet the user and ask how you can help them today. Be concise.",
        },
        {
          role: Role.USER,
          message: "Topic: ${workflow.input.topic}",
        },
      ],
      temperature: 0.7,
      maxTokens: 200,
    })
  );

  // Wait for human response (external signal)
  wf.add(waitTaskDuration("human_input_ref", "300s"));

  // LLM responds to human input
  wf.add(
    llmChatCompleteTask("response_ref", provider, model, {
      messages: [
        {
          role: Role.SYSTEM,
          message: "You are a helpful assistant. Respond to the user's message concisely.",
        },
        {
          role: Role.ASSISTANT,
          message: "${greeting_ref.output.result}",
        },
        {
          role: Role.USER,
          message: "${human_input_ref.output.userMessage}",
        },
      ],
      temperature: 0.7,
      maxTokens: 300,
    })
  );

  wf.outputParameters({
    greeting: "${greeting_ref.output.result}",
    userMessage: "${human_input_ref.output.userMessage}",
    response: "${response_ref.output.result}",
  });

  await wf.register(true);
  console.log("Registered workflow:", wf.getName());

  // ── Start workflow (async — it will pause at WAIT) ────────────────
  const workflowId = await wf.startWorkflow({
    topic: "TypeScript best practices",
  });
  console.log("Started workflow:", workflowId);
  console.log("Workflow will pause at WAIT task for human input...");

  // Wait for workflow to reach the WAIT task
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Check status
  const status = await workflowClient.getWorkflow(workflowId, true);
  console.log("Current status:", status.status);

  // Find the waiting task
  const waitingTask = status.tasks?.find(
    (t) => t.taskDefName === "WAIT" && t.status === "IN_PROGRESS"
  );

  if (waitingTask?.taskId) {
    console.log("\nSimulating human input...");

    // Update the WAIT task with human input
    await taskClient.updateTaskResult(
      workflowId,
      "human_input_ref",
      "COMPLETED",
      { userMessage: "Tell me about async/await patterns in TypeScript" }
    );

    console.log("Human input provided. Workflow continuing...");

    // Wait for completion
    await new Promise((resolve) => setTimeout(resolve, 10000));

    const finalStatus = await workflowClient.getWorkflow(workflowId, true);
    console.log("\nFinal status:", finalStatus.status);
    console.log("Output:", JSON.stringify(finalStatus.output, null, 2));
  } else {
    console.log("WAIT task not found. Workflow may have completed or failed.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
