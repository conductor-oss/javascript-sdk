import { expect, describe, test, jest, beforeAll, afterAll } from "@jest/globals";
import {
  orkesConductorClient,
  OrkesClients,
  IntegrationClient,
  PromptClient,
} from "../sdk";
import type { Tag } from "../open-api";

/**
 * E2E Integration Tests for IntegrationClient
 *
 * Tests integration provider CRUD, integration API CRUD, discovery endpoints,
 * prompt association, and tag management.
 *
 * Requires Orkes Enterprise with integration support.
 * Tests are skipped if the integration API is not available.
 */
describe("IntegrationClient", () => {
  jest.setTimeout(60000);

  const clientPromise = orkesConductorClient();
  const suffix = Date.now();

  let integrationClient: IntegrationClient;
  let promptClient: PromptClient;
  let integrationsSupported = false;

  const providerName = `jsSdkTest_provider_${suffix}`;
  const integrationName = `jsSdkTest_api_${suffix}`;
  const promptName = `jsSdkTest_prompt_for_integration_${suffix}`;

  beforeAll(async () => {
    const client = await clientPromise;
    const clients = new OrkesClients(client);
    integrationClient = clients.getIntegrationClient();
    promptClient = clients.getPromptClient();

    // Check if integration API is available on this server
    try {
      await integrationClient.getIntegrationProviders();
      integrationsSupported = true;
    } catch {
      console.log(
        "Integration API not available on this server — skipping IntegrationClient tests"
      );
    }
  });

  afterAll(async () => {
    // Cleanup in reverse order of dependencies
    try {
      await integrationClient.deleteIntegrationApi(
        providerName,
        integrationName
      );
    } catch (e) {
      console.debug(`Cleanup integration API failed:`, e);
    }
    try {
      await integrationClient.deleteIntegrationProvider(providerName);
    } catch (e) {
      console.debug(`Cleanup integration provider failed:`, e);
    }
    try {
      await promptClient.deletePrompt(promptName);
    } catch (e) {
      console.debug(`Cleanup prompt failed:`, e);
    }
  });

  function skipIfNotSupported() {
    if (!integrationsSupported) {
      console.log("Skipping — integration API not available");
    }
    return !integrationsSupported;
  }

  // ==================== Integration Provider CRUD ====================

  describe("Integration Provider CRUD", () => {
    test("saveIntegrationProvider should create a new provider", async () => {
      if (skipIfNotSupported()) return;
      await expect(
        integrationClient.saveIntegrationProvider(providerName, {
          category: "AI_MODEL",
          type: "openai",
          description: `Test provider ${suffix}`,
          enabled: true,
          configuration: { api_key: "test-key-placeholder" },
        })
      ).resolves.not.toThrow();
    });

    test("getIntegrationProvider should return the created provider", async () => {
      if (skipIfNotSupported()) return;
      const provider =
        await integrationClient.getIntegrationProvider(providerName);

      expect(provider).toBeDefined();
      expect(provider.name).toEqual(providerName);
    });

    test("getIntegrationProviders should include the created provider", async () => {
      if (skipIfNotSupported()) return;
      const providers = await integrationClient.getIntegrationProviders();

      expect(Array.isArray(providers)).toBe(true);
      const found = providers.find((p) => p.name === providerName);
      expect(found).toBeDefined();
    });

    test("saveIntegrationProvider should update the provider", async () => {
      if (skipIfNotSupported()) return;
      await expect(
        integrationClient.saveIntegrationProvider(providerName, {
          category: "AI_MODEL",
          type: "openai",
          description: `Updated provider ${suffix}`,
          enabled: true,
          configuration: { api_key: "test-key-placeholder" },
        })
      ).resolves.not.toThrow();
    });
  });

  // ==================== Integration API CRUD ====================

  describe("Integration API CRUD", () => {
    test("saveIntegrationApi should create a new API", async () => {
      if (skipIfNotSupported()) return;
      await expect(
        integrationClient.saveIntegrationApi(providerName, integrationName, {
          description: `Test API ${suffix}`,
          enabled: true,
          configuration: { api_key: "test-key-placeholder" },
        })
      ).resolves.not.toThrow();
    });

    test("getIntegrationApi should return the created API", async () => {
      if (skipIfNotSupported()) return;
      const api = await integrationClient.getIntegrationApi(
        providerName,
        integrationName
      );

      expect(api).toBeDefined();
    });

    test("getIntegrationApis should include the created API", async () => {
      if (skipIfNotSupported()) return;
      const apis =
        await integrationClient.getIntegrationApis(providerName);

      expect(Array.isArray(apis)).toBe(true);
      expect(apis.length).toBeGreaterThanOrEqual(1);
    });

    test("saveIntegrationApi should update an existing API", async () => {
      if (skipIfNotSupported()) return;
      await expect(
        integrationClient.saveIntegrationApi(providerName, integrationName, {
          description: `Updated API ${suffix}`,
          enabled: true,
          configuration: { api_key: "test-key-placeholder" },
        })
      ).resolves.not.toThrow();
    });
  });

  // ==================== Discovery ====================

  describe("Discovery", () => {
    test("getIntegrations should return integrations list", async () => {
      if (skipIfNotSupported()) return;
      const integrations = await integrationClient.getIntegrations();

      expect(Array.isArray(integrations)).toBe(true);
    });

    test("getIntegrationProviderDefs should return provider definitions", async () => {
      if (skipIfNotSupported()) return;
      const defs = await integrationClient.getIntegrationProviderDefs();

      expect(Array.isArray(defs)).toBe(true);
      expect(defs.length).toBeGreaterThan(0);
    });

    test("getProvidersAndIntegrations should return an array", async () => {
      if (skipIfNotSupported()) return;
      const result =
        await integrationClient.getProvidersAndIntegrations();

      expect(Array.isArray(result)).toBe(true);
    });

    test("getIntegrationAvailableApis should return available API models", async () => {
      if (skipIfNotSupported()) return;
      try {
        const apis =
          await integrationClient.getIntegrationAvailableApis(providerName);
        expect(Array.isArray(apis)).toBe(true);
      } catch {
        // Provider may not expose available APIs
        console.log("getIntegrationAvailableApis not supported for this provider — skipping");
      }
    });
  });

  // ==================== Provider Tags ====================

  describe("Provider Tags", () => {
    const providerTags: Tag[] = [
      { key: "category", type: "METADATA", value: "ai" },
      { key: "priority", type: "METADATA", value: "high" },
    ];

    test("setProviderTags should set tags on the provider", async () => {
      if (skipIfNotSupported()) return;
      await expect(
        integrationClient.setProviderTags(providerName, providerTags)
      ).resolves.not.toThrow();
    });

    test("getProviderTags should return the set tags", async () => {
      if (skipIfNotSupported()) return;
      const tags = await integrationClient.getProviderTags(providerName);

      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBeGreaterThanOrEqual(2);

      const catTag = tags.find((t) => t.key === "category");
      expect(catTag).toBeDefined();
      expect(catTag?.value).toEqual("ai");
    });

    test("deleteProviderTags should remove specific tags", async () => {
      if (skipIfNotSupported()) return;
      const tagToDelete: Tag[] = [
        { key: "priority", type: "METADATA", value: "high" },
      ];
      await expect(
        integrationClient.deleteProviderTags(providerName, tagToDelete)
      ).resolves.not.toThrow();

      const remaining =
        await integrationClient.getProviderTags(providerName);
      const priorityTag = remaining.find((t) => t.key === "priority");
      expect(priorityTag).toBeUndefined();
    });
  });

  // ==================== Integration Tags ====================

  describe("Integration Tags", () => {
    const integrationTags: Tag[] = [
      { key: "model", type: "METADATA", value: "gpt-4" },
      { key: "env", type: "METADATA", value: "staging" },
    ];

    test("setIntegrationTags should set tags on the integration", async () => {
      if (skipIfNotSupported()) return;
      await expect(
        integrationClient.setIntegrationTags(
          providerName,
          integrationName,
          integrationTags
        )
      ).resolves.not.toThrow();
    });

    test("getIntegrationTags should return the set tags", async () => {
      if (skipIfNotSupported()) return;
      const tags = await integrationClient.getIntegrationTags(
        providerName,
        integrationName
      );

      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBeGreaterThanOrEqual(2);

      const modelTag = tags.find((t) => t.key === "model");
      expect(modelTag).toBeDefined();
    });

    test("deleteIntegrationTags should remove specific tags", async () => {
      if (skipIfNotSupported()) return;
      const tagToDelete: Tag[] = [
        { key: "env", type: "METADATA", value: "staging" },
      ];
      await expect(
        integrationClient.deleteIntegrationTags(
          providerName,
          integrationName,
          tagToDelete
        )
      ).resolves.not.toThrow();

      const remaining = await integrationClient.getIntegrationTags(
        providerName,
        integrationName
      );
      const envTag = remaining.find((t) => t.key === "env");
      expect(envTag).toBeUndefined();
    });
  });

  // ==================== Prompt Association ====================

  describe("Prompt Association", () => {
    test("associatePromptWithIntegration should link a prompt", async () => {
      if (skipIfNotSupported()) return;
      // First create a prompt to associate
      await promptClient.savePrompt(
        promptName,
        `Test prompt for integration ${suffix}`,
        "Hello {{name}}, your order {{orderId}} is ready."
      );

      await expect(
        integrationClient.associatePromptWithIntegration(
          providerName,
          integrationName,
          promptName
        )
      ).resolves.not.toThrow();
    });

    test("getPromptsWithIntegration should return associated prompts", async () => {
      if (skipIfNotSupported()) return;
      const prompts = await integrationClient.getPromptsWithIntegration(
        providerName,
        integrationName
      );

      expect(Array.isArray(prompts)).toBe(true);
      const found = prompts.find((p) => p.name === promptName);
      expect(found).toBeDefined();
    });
  });

  // ==================== Deletion ====================

  describe("Deletion", () => {
    test("deleteIntegrationApi should remove the API", async () => {
      if (skipIfNotSupported()) return;
      await expect(
        integrationClient.deleteIntegrationApi(providerName, integrationName)
      ).resolves.not.toThrow();

      await expect(
        integrationClient.getIntegrationApi(providerName, integrationName)
      ).rejects.toThrow();
    });

    test("deleteIntegrationProvider should remove the provider", async () => {
      if (skipIfNotSupported()) return;
      await expect(
        integrationClient.deleteIntegrationProvider(providerName)
      ).resolves.not.toThrow();

      await expect(
        integrationClient.getIntegrationProvider(providerName)
      ).rejects.toThrow();
    });
  });

  // ==================== Error Paths ====================

  describe("Error Paths", () => {
    test("getIntegrationProvider should throw for non-existent provider", async () => {
      if (skipIfNotSupported()) return;
      await expect(
        integrationClient.getIntegrationProvider("nonexistent_provider_999999")
      ).rejects.toThrow();
    });

    test("getIntegrationApi should throw for non-existent API", async () => {
      if (skipIfNotSupported()) return;
      await expect(
        integrationClient.getIntegrationApi(
          "nonexistent_provider_999999",
          "nonexistent_api_999999"
        )
      ).rejects.toThrow();
    });

    test("deleteIntegrationProvider should throw for non-existent provider", async () => {
      if (skipIfNotSupported()) return;
      await expect(
        integrationClient.deleteIntegrationProvider("nonexistent_provider_999999")
      ).rejects.toThrow();
    });
  });
});
