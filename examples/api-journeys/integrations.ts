/**
 * Integrations API Journey — Full lifecycle of integration management
 *
 * Demonstrates all IntegrationClient APIs:
 *   - Provider CRUD (save, get, list, delete)
 *   - Integration API CRUD (save, get, list, delete)
 *   - Query integrations (all, by category, available APIs, definitions)
 *   - Prompt association (associate, get, list)
 *   - Tag management (provider tags, integration tags)
 *
 * Note: This example uses mock integration data. In production,
 * you would configure actual LLM providers, vector DBs, etc.
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/api-journeys/integrations.ts
 */
import { OrkesClients } from "../../src/sdk";

async function main() {
  const clients = await OrkesClients.from();
  const integrations = clients.getIntegrationClient();

  const providerName = "journey_example_provider";
  const integrationName = "journey_example_model";

  try {
    // ── 1. Provider Management ──────────────────────────────────────
    console.log("=== Provider Management ===\n");

    // Save (create) a provider
    await integrations.saveIntegrationProvider(providerName, {
      category: "AI_MODEL",
      type: "openai",
      description: "Example OpenAI integration for API journey",
      configuration: {
        api_key: "sk-example-key",
      },
      enabled: true,
    });
    console.log("1. Saved integration provider:", providerName);

    // Get provider
    const provider = await integrations.getIntegrationProvider(providerName);
    console.log("2. Provider:", JSON.stringify({
      name: provider.name,
      category: provider.category,
      enabled: provider.enabled,
    }));

    // List all providers
    const allProviders = await integrations.getIntegrationProviders();
    console.log("3. Total providers:", allProviders.length);

    // Get provider definitions
    const defs = await integrations.getIntegrationProviderDefs();
    console.log("4. Provider definitions:", defs.length);

    // ── 2. Integration API Management ───────────────────────────────
    console.log("\n=== Integration API Management ===\n");

    // Save an integration API (model)
    await integrations.saveIntegrationApi(providerName, integrationName, {
      description: "GPT-4o model configuration",
      configuration: {
        model: "gpt-4o",
      },
      enabled: true,
    });
    console.log("5. Saved integration API:", integrationName);

    // Get integration API
    const api = await integrations.getIntegrationApi(
      providerName,
      integrationName
    );
    console.log("6. Integration API:", JSON.stringify({
      name: api.name,
      enabled: api.enabled,
    }));

    // List APIs for provider
    const apis = await integrations.getIntegrationApis(providerName);
    console.log("7. APIs for provider:", apis.length);

    // Get available APIs
    const available = await integrations.getIntegrationAvailableApis(
      providerName
    );
    console.log("8. Available APIs:", available);

    // ── 3. Query Integrations ───────────────────────────────────────
    console.log("\n=== Query Integrations ===\n");

    // Get all integrations
    const allIntegrations = await integrations.getIntegrations();
    console.log("9. Total integrations:", allIntegrations.length);

    // Filter by category
    const aiIntegrations = await integrations.getIntegrations(
      "AI_MODEL",
      true
    );
    console.log("10. Active AI integrations:", aiIntegrations.length);

    // Get providers and integrations
    const providersAndIntegrations =
      await integrations.getProvidersAndIntegrations();
    console.log(
      "11. Providers and integrations:",
      providersAndIntegrations.length
    );

    // ── 4. Tag Management ───────────────────────────────────────────
    console.log("\n=== Tag Management ===\n");

    // Provider tags
    await integrations.setProviderTags(providerName, [
      { key: "team", value: "ml" },
      { key: "env", value: "staging" },
    ]);
    console.log("12. Set provider tags");

    const providerTags = await integrations.getProviderTags(providerName);
    console.log("13. Provider tags:", JSON.stringify(providerTags));

    await integrations.deleteProviderTags(providerName, [
      { key: "env", value: "staging" },
    ]);
    console.log("14. Deleted provider tag");

    // Integration tags
    await integrations.setIntegrationTags(providerName, integrationName, [
      { key: "model", value: "gpt-4o" },
      { key: "capability", value: "chat" },
    ]);
    console.log("15. Set integration tags");

    const integrationTags = await integrations.getIntegrationTags(
      providerName,
      integrationName
    );
    console.log("16. Integration tags:", JSON.stringify(integrationTags));

    await integrations.deleteIntegrationTags(providerName, integrationName, [
      { key: "capability", value: "chat" },
    ]);
    console.log("17. Deleted integration tag");

    // ── 5. Prompt Association ───────────────────────────────────────
    console.log("\n=== Prompt Association ===\n");

    // Associate a prompt (requires an existing prompt)
    try {
      const promptClient = clients.getPromptClient();
      await promptClient.savePrompt(
        "journey_assoc_prompt",
        "Prompt for integration association",
        "Hello, {{name}}!",
        [`${providerName}:${integrationName}`]
      );

      await integrations.associatePromptWithIntegration(
        providerName,
        integrationName,
        "journey_assoc_prompt"
      );
      console.log("18. Associated prompt with integration");

      const prompts = await integrations.getPromptsWithIntegration(
        providerName,
        integrationName
      );
      console.log("19. Associated prompts:", prompts.length);

      await promptClient.deletePrompt("journey_assoc_prompt");
      console.log("20. Cleaned up prompt");
    } catch (err) {
      console.log(
        "18-20. Prompt association skipped:",
        (err as Error).message
      );
    }

    // ── 6. Cleanup ──────────────────────────────────────────────────
    console.log("\n=== Cleanup ===\n");

    await integrations.deleteIntegrationApi(providerName, integrationName);
    console.log("21. Deleted integration API");

    await integrations.deleteIntegrationProvider(providerName);
    console.log("22. Deleted provider");
  } catch (err) {
    console.error("Error:", err);

    // Best-effort cleanup
    try {
      await integrations.deleteIntegrationApi(providerName, integrationName);
    } catch { /* ignore */ }
    try {
      await integrations.deleteIntegrationProvider(providerName);
    } catch { /* ignore */ }
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
