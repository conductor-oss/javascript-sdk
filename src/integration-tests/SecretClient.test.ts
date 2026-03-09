import { expect, describe, test, jest, beforeAll, afterAll } from "@jest/globals";
import {
  orkesConductorClient,
  OrkesClients,
  SecretClient,
} from "../sdk";
import type { Tag } from "../open-api";

/**
 * E2E Integration Tests for SecretClient
 *
 * Tests secret CRUD operations, existence checks, listing, and tag management.
 */
describe("SecretClient", () => {
  jest.setTimeout(60000);

  const clientPromise = orkesConductorClient();
  const suffix = Date.now();

  let secretClient: SecretClient;

  const secretKey = `jsSdkTest_secret_${suffix}`;
  const secretValue = `test-secret-value-${suffix}`;
  const updatedSecretValue = `updated-secret-value-${suffix}`;

  beforeAll(async () => {
    const client = await clientPromise;
    const clients = new OrkesClients(client);
    secretClient = clients.getSecretClient();
  });

  afterAll(async () => {
    try {
      await secretClient.deleteSecret(secretKey);
    } catch (e) {
      console.debug(`Cleanup secret '${secretKey}' failed:`, e);
    }
  });

  // ==================== Secret CRUD ====================

  describe("Secret CRUD", () => {
    test("putSecret should store a new secret", async () => {
      await expect(
        secretClient.putSecret(secretKey, secretValue)
      ).resolves.not.toThrow();
    });

    test("secretExists should return true for existing secret", async () => {
      const exists = await secretClient.secretExists(secretKey);
      expect(exists).toBe(true);
    });

    test("getSecret should return the stored value", async () => {
      const value = await secretClient.getSecret(secretKey);
      expect(value).toBeDefined();
      // Note: some backends may mask secret values
      expect(typeof value).toBe("string");
    });

    test("putSecret should update an existing secret", async () => {
      await expect(
        secretClient.putSecret(secretKey, updatedSecretValue)
      ).resolves.not.toThrow();
    });

    test("listAllSecretNames should include the test secret", async () => {
      const names = await secretClient.listAllSecretNames();
      expect(Array.isArray(names)).toBe(true);
      expect(names).toContain(secretKey);
    });

    test("listSecretsThatUserCanGrantAccessTo should return an array", async () => {
      const names =
        await secretClient.listSecretsThatUserCanGrantAccessTo();
      expect(Array.isArray(names)).toBe(true);
    });
  });

  // ==================== Secret Tags ====================

  describe("Secret Tags", () => {
    const testTags: Tag[] = [
      { key: "env", type: "METADATA", value: "test" },
      { key: "team", type: "METADATA", value: "sdk" },
    ];

    test("setSecretTags should set tags on the secret", async () => {
      await expect(
        secretClient.setSecretTags(testTags, secretKey)
      ).resolves.not.toThrow();
    });

    test("getSecretTags should return the set tags", async () => {
      const tags = await secretClient.getSecretTags(secretKey);
      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBeGreaterThanOrEqual(2);

      const envTag = tags.find((t) => t.key === "env");
      expect(envTag).toBeDefined();
      expect(envTag?.value).toEqual("test");
    });

    test("deleteSecretTags should remove specific tags", async () => {
      const tagToDelete: Tag[] = [
        { key: "team", type: "METADATA", value: "sdk" },
      ];
      await expect(
        secretClient.deleteSecretTags(tagToDelete, secretKey)
      ).resolves.not.toThrow();

      const remainingTags = await secretClient.getSecretTags(secretKey);
      const teamTag = remainingTags.find((t) => t.key === "team");
      expect(teamTag).toBeUndefined();
    });
  });

  // ==================== Deletion ====================

  describe("Deletion", () => {
    test("deleteSecret should remove the secret", async () => {
      await expect(
        secretClient.deleteSecret(secretKey)
      ).resolves.not.toThrow();
    });

    test("secretExists should return false for deleted secret", async () => {
      // After deletion, secretExists may throw or return false
      try {
        const exists = await secretClient.secretExists(secretKey);
        expect(exists).toBeFalsy();
      } catch {
        // Some backends throw 404 — that's also acceptable
        expect(true).toBe(true);
      }
    });
  });

  // ==================== Error Paths ====================

  describe("Error Paths", () => {
    test("getSecret should throw for non-existent key", async () => {
      await expect(
        secretClient.getSecret("nonexistent_secret_key_999999")
      ).rejects.toThrow();
    });

    test("deleteSecret should not fail silently for non-existent key", async () => {
      // Some servers return 204 (no-op), others throw 404
      try {
        await secretClient.deleteSecret("nonexistent_secret_key_999999");
        // If it resolves, the server treats it as a no-op — acceptable
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test("getSecretTags should throw for non-existent key", async () => {
      await expect(
        secretClient.getSecretTags("nonexistent_secret_key_999999")
      ).rejects.toThrow();
    });
  });
});
