import { expect, describe, test, jest, beforeAll, afterAll } from "@jest/globals";
import {
  orkesConductorClient,
  OrkesClients,
  SchemaClient,
} from "../sdk";
import { describeForOrkesV5 } from "./utils/customJestDescribe";

/**
 * E2E Integration Tests for SchemaClient
 *
 * Tests schema registration, retrieval (by name, by name+version), listing,
 * version creation, and deletion. Gated to v5: GET /api/schema/{name} is not
 * supported on older backends (returns "Method 'GET' is not supported").
 */
describeForOrkesV5("SchemaClient", () => {
  jest.setTimeout(60000);

  const clientPromise = orkesConductorClient();
  const suffix = Date.now();

  let schemaClient: SchemaClient;

  const schemaName = `jsSdkTest_schema_${suffix}`;
  const schemaData = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["name"],
  };

  beforeAll(async () => {
    const client = await clientPromise;
    const clients = new OrkesClients(client);
    schemaClient = clients.getSchemaClient();
  });

  afterAll(async () => {
    try {
      await schemaClient.deleteSchemaByName(schemaName);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("No schema found") && !msg.includes("not found")) {
        console.debug(`Cleanup schema '${schemaName}' failed:`, e);
      }
    }
  });

  // ==================== Schema CRUD ====================

  describe("Schema CRUD", () => {
    test("registerSchema should create a new schema", async () => {
      await expect(
        schemaClient.registerSchema([
          {
            name: schemaName,
            version: 1,
            type: "JSON",
            data: schemaData,
          },
        ])
      ).resolves.not.toThrow();
    });

    test("getSchema should return schema by name and version", async () => {
      const schema = await schemaClient.getSchema(schemaName, 1);

      expect(schema).toBeDefined();
      expect(schema.name).toEqual(schemaName);
      expect(schema.version).toEqual(1);
    });

    test("getSchemaByName should return latest version", async () => {
      const schema = await schemaClient.getSchemaByName(schemaName);

      expect(schema).toBeDefined();
      expect(schema.name).toEqual(schemaName);
    });

    test("getAllSchemas should include the test schema", async () => {
      const schemas = await schemaClient.getAllSchemas();

      expect(Array.isArray(schemas)).toBe(true);
      const found = schemas.find((s) => s.name === schemaName);
      expect(found).toBeDefined();
    });

    test("registerSchema with newVersion should create version 2", async () => {
      const updatedSchemaData = {
        ...schemaData,
        properties: {
          ...schemaData.properties,
          email: { type: "string" },
        },
      };

      await expect(
        schemaClient.registerSchema(
          [
            {
              name: schemaName,
              version: 1, // server will auto-increment with newVersion=true
              type: "JSON",
              data: updatedSchemaData,
            },
          ],
          true
        )
      ).resolves.not.toThrow();
    });

    test("getSchema version 2 should return the updated schema", async () => {
      const schema = await schemaClient.getSchema(schemaName, 2);

      expect(schema).toBeDefined();
      expect(schema.name).toEqual(schemaName);
      expect(schema.version).toEqual(2);
    });
  });

  // ==================== Schema Deletion ====================

  describe("Schema Deletion", () => {
    test("deleteSchema should remove a specific version", async () => {
      await expect(
        schemaClient.deleteSchema(schemaName, 2)
      ).resolves.not.toThrow();

      // Version 2 should be gone
      await expect(
        schemaClient.getSchema(schemaName, 2)
      ).rejects.toThrow();
    });

    test("deleteSchemaByName should remove all versions", async () => {
      await expect(
        schemaClient.deleteSchemaByName(schemaName)
      ).resolves.not.toThrow();

      // Version 1 should also be gone
      await expect(
        schemaClient.getSchema(schemaName, 1)
      ).rejects.toThrow();
    });
  });

  // ==================== Error Paths ====================

  describe("Error Paths", () => {
    test("getSchema should throw for non-existent schema", async () => {
      await expect(
        schemaClient.getSchema("nonexistent_schema_999999", 1)
      ).rejects.toThrow();
    });

    test("getSchemaByName should throw for non-existent schema", async () => {
      await expect(
        schemaClient.getSchemaByName("nonexistent_schema_999999")
      ).rejects.toThrow();
    });

    test("deleteSchema should throw for non-existent schema", async () => {
      await expect(
        schemaClient.deleteSchema("nonexistent_schema_999999", 1)
      ).rejects.toThrow();
    });
  });
});
