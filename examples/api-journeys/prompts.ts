/**
 * Prompts API Journey — Full lifecycle of prompt template management
 *
 * Demonstrates all PromptClient APIs:
 *   - Save, get, update, delete prompts
 *   - Tag management for prompts
 *   - Test prompts against LLMs
 *   - List all prompts
 *
 * Prerequisites:
 *   - An LLM integration configured in Conductor (for testPrompt)
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/api-journeys/prompts.ts
 */
import { OrkesClients } from "../../src/sdk";

async function main() {
  const clients = await OrkesClients.from();
  const prompts = clients.getPromptClient();

  const promptName = "journey_example_prompt";
  const provider = process.env.LLM_PROVIDER ?? "openai_integration";
  const model = process.env.LLM_MODEL ?? "gpt-4o";

  try {
    // ── 1. Save a prompt template ───────────────────────────────────
    await prompts.savePrompt(
      promptName,
      "Example prompt for API journey",
      "You are a helpful assistant. The user wants to know about {{topic}}. Respond concisely.",
      [`${provider}:${model}`]
    );
    console.log("1. Saved prompt:", promptName);

    // ── 2. Get the prompt ───────────────────────────────────────────
    const prompt = await prompts.getPrompt(promptName);
    console.log("2. Retrieved prompt:", JSON.stringify(prompt, null, 2));

    // ── 3. Update the prompt ────────────────────────────────────────
    await prompts.updatePrompt(
      promptName,
      "Updated example prompt",
      "You are a concise expert. Explain {{topic}} in {{style}} style. Keep it under 100 words.",
      [`${provider}:${model}`]
    );
    console.log("3. Updated prompt template");

    // ── 4. List all prompts ─────────────────────────────────────────
    const allPrompts = await prompts.getPrompts();
    console.log("4. Total prompts:", allPrompts.length);

    // ── 5. Tag management ───────────────────────────────────────────
    await prompts.setPromptTags(promptName, [
      { key: "category", value: "example" },
      { key: "version", value: "v2" },
    ]);
    console.log("5. Set prompt tags");

    const tags = await prompts.getPromptTags(promptName);
    console.log("6. Prompt tags:", JSON.stringify(tags));

    await prompts.deletePromptTags(promptName, [
      { key: "version", value: "v2" },
    ]);
    console.log("7. Deleted prompt tag");

    // ── 6. Test the prompt ──────────────────────────────────────────
    console.log("\n8. Testing prompt against LLM...");
    try {
      const result = await prompts.testPrompt({
        prompt: "You are a concise expert. Explain {{topic}} in {{style}} style. Keep it under 100 words.",
        promptVariables: {
          topic: "TypeScript generics",
          style: "beginner-friendly",
        },
        llmProvider: provider,
        model,
      });
      console.log("   Result:", result);
    } catch (err) {
      console.log(
        "   (Skipped — requires LLM integration. Error:",
        (err as Error).message,
        ")"
      );
    }

    // ── 7. Cleanup ──────────────────────────────────────────────────
    await prompts.deletePrompt(promptName);
    console.log("9. Deleted prompt");
  } catch (err) {
    console.error("Error:", err);

    // Best-effort cleanup
    try { await prompts.deletePrompt(promptName); } catch { /* ignore */ }
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
