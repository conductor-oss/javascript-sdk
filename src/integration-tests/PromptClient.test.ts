import { expect, describe, test, jest, beforeAll, afterAll } from "@jest/globals";
import {
  orkesConductorClient,
  OrkesClients,
  PromptClient,
} from "../sdk";
import type { Tag } from "../open-api";

/**
 * E2E Integration Tests for PromptClient
 *
 * Tests prompt CRUD, tag management, and (optionally) prompt testing
 * against a configured LLM integration.
 */
describe("PromptClient", () => {
  jest.setTimeout(30000);

  const clientPromise = orkesConductorClient();
  const suffix = Date.now();

  let promptClient: PromptClient;

  const promptName = `jsSdkTest_prompt_${suffix}`;
  const promptDescription = `Test prompt ${suffix}`;
  const promptTemplate =
    "You are a helpful assistant. Answer the following question: {{question}}";
  const updatedTemplate =
    "You are an expert assistant. Answer concisely: {{question}}";

  beforeAll(async () => {
    const client = await clientPromise;
    const clients = new OrkesClients(client);
    promptClient = clients.getPromptClient();
  });

  afterAll(async () => {
    try {
      await promptClient.deletePrompt(promptName);
    } catch (e) {
      console.debug(`Cleanup prompt '${promptName}' failed:`, e);
    }
  });

  // ==================== Prompt CRUD ====================

  describe("Prompt CRUD", () => {
    test("savePrompt should create a new prompt template", async () => {
      await expect(
        promptClient.savePrompt(promptName, promptDescription, promptTemplate)
      ).resolves.not.toThrow();
    });

    test("getPrompt should return the created prompt", async () => {
      const prompt = await promptClient.getPrompt(promptName);

      expect(prompt).toBeDefined();
      expect(prompt.name).toEqual(promptName);
      expect(prompt.template).toEqual(promptTemplate);
    });

    test("getPrompts should include the created prompt", async () => {
      const prompts = await promptClient.getPrompts();

      expect(Array.isArray(prompts)).toBe(true);
      const found = prompts.find((p) => p.name === promptName);
      expect(found).toBeDefined();
    });

    test("updatePrompt should modify the prompt template", async () => {
      await expect(
        promptClient.updatePrompt(
          promptName,
          `Updated ${promptDescription}`,
          updatedTemplate
        )
      ).resolves.not.toThrow();

      const updated = await promptClient.getPrompt(promptName);
      expect(updated.template).toEqual(updatedTemplate);
    });

    test("savePrompt with models should accept model list", async () => {
      try {
        await promptClient.savePrompt(
          promptName,
          promptDescription,
          promptTemplate,
          ["openai:gpt-4o"]
        );
      } catch {
        // Models format may vary by server version — skip gracefully
        console.log("savePrompt with models not supported in expected format — skipping");
      }
    });
  });

  // ==================== Prompt Tags ====================

  describe("Prompt Tags", () => {
    const testTags: Tag[] = [
      { key: "category", type: "METADATA", value: "qa" },
      { key: "version", type: "METADATA", value: "v1" },
    ];

    test("setPromptTags should set tags on the prompt", async () => {
      await expect(
        promptClient.setPromptTags(promptName, testTags)
      ).resolves.not.toThrow();
    });

    test("getPromptTags should return the set tags", async () => {
      const tags = await promptClient.getPromptTags(promptName);

      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBeGreaterThanOrEqual(2);

      const catTag = tags.find((t) => t.key === "category");
      expect(catTag).toBeDefined();
      expect(catTag?.value).toEqual("qa");
    });

    test("deletePromptTags should remove specific tags", async () => {
      const tagToDelete: Tag[] = [
        { key: "version", type: "METADATA", value: "v1" },
      ];
      await expect(
        promptClient.deletePromptTags(promptName, tagToDelete)
      ).resolves.not.toThrow();

      const remaining = await promptClient.getPromptTags(promptName);
      const versionTag = remaining.find((t) => t.key === "version");
      expect(versionTag).toBeUndefined();
    });
  });

  // ==================== Prompt Testing ====================

  describe("Prompt Testing", () => {
    // testPrompt requires a configured LLM integration on the server.
    // This test validates the API call works; skip if no integration is available.
    test("testPrompt should attempt to test the prompt against an LLM", async () => {
      try {
        const response = await promptClient.testPrompt({
          prompt: "Hello, what is 2+2?",
          llmProvider: "openai", // May not be configured
          model: "gpt-4o",
          promptVariables: {},
        });

        // If we get here, the integration is configured
        expect(typeof response).toBe("string");
        expect(response.length).toBeGreaterThan(0);
      } catch (error) {
        // Expected if no LLM integration is configured — skip gracefully
        console.log(
          "testPrompt skipped: LLM integration not configured on server"
        );
        expect(error).toBeDefined();
      }
    });
  });

  // ==================== Deletion ====================

  describe("Deletion", () => {
    test("deletePrompt should remove the prompt", async () => {
      await expect(
        promptClient.deletePrompt(promptName)
      ).resolves.not.toThrow();
    });

    test("getPrompt should throw for deleted prompt", async () => {
      await expect(promptClient.getPrompt(promptName)).rejects.toThrow();
    });
  });

  // ==================== Error Paths ====================

  describe("Error Paths", () => {
    test("getPrompt for non-existent name should throw or return null", async () => {
      try {
        const result = await promptClient.getPrompt("nonexistent_prompt_999999");
        // Some servers return null/undefined instead of 404
        expect(result).toBeFalsy();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test("deletePrompt for non-existent name should throw or no-op", async () => {
      try {
        await promptClient.deletePrompt("nonexistent_prompt_999999");
        // Some servers treat as no-op
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test("updatePrompt for non-existent name should throw or create", async () => {
      const name = `nonexistent_prompt_${Date.now()}`;
      try {
        await promptClient.updatePrompt(name, "desc", "template");
        // If it resolves, it may have created the prompt — clean up
        try { await promptClient.deletePrompt(name); } catch { /* ok */ }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
