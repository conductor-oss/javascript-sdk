/**
 * Schemas API Journey — Full lifecycle of schema management
 *
 * Demonstrates all SchemaClient APIs:
 *   - Register, get, list, delete schemas
 *   - Version management (create new versions)
 *   - Get schema by name (latest version)
 *   - Get schema by name and version
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/api-journeys/schemas.ts
 */
import { OrkesClients } from "../../src/sdk";

async function main() {
  const clients = await OrkesClients.from();
  const schemas = clients.getSchemaClient();

  const schemaName = "journey_order_schema";

  try {
    // ── 1. Register a schema ────────────────────────────────────────
    await schemas.registerSchema([
      {
        name: schemaName,
        version: 1,
        type: "JSON",
        data: {
          $schema: "http://json-schema.org/draft-07/schema#",
          type: "object",
          properties: {
            orderId: { type: "string" },
            amount: { type: "number" },
            items: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["orderId", "amount"],
        },
      },
    ]);
    console.log("1. Registered schema:", schemaName, "v1");

    // ── 2. Get schema by name and version ───────────────────────────
    const schemaV1 = await schemas.getSchema(schemaName, 1);
    console.log("2. Schema v1:", JSON.stringify({
      name: schemaV1.name,
      version: schemaV1.version,
      type: schemaV1.type,
    }));

    // ── 3. Get schema by name (latest version) ─────────────────────
    const latest = await schemas.getSchemaByName(schemaName);
    console.log("3. Latest schema:", JSON.stringify({
      name: latest.name,
      version: latest.version,
    }));

    // ── 4. Register a new version ───────────────────────────────────
    await schemas.registerSchema(
      [
        {
          name: schemaName,
          version: 2,
          type: "JSON",
          data: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties: {
              orderId: { type: "string" },
              amount: { type: "number" },
              currency: { type: "string", default: "USD" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    quantity: { type: "integer" },
                    price: { type: "number" },
                  },
                },
              },
              shippingAddress: {
                type: "object",
                properties: {
                  street: { type: "string" },
                  city: { type: "string" },
                  zip: { type: "string" },
                },
              },
            },
            required: ["orderId", "amount", "currency"],
          },
        },
      ],
      true // newVersion = true
    );
    console.log("4. Registered schema v2 (with currency and shippingAddress)");

    // ── 5. Get both versions ────────────────────────────────────────
    const v1 = await schemas.getSchema(schemaName, 1);
    const v2 = await schemas.getSchema(schemaName, 2);
    console.log("5. v1 required fields:", (v1.data as Record<string, unknown>)?.required);
    console.log("   v2 required fields:", (v2.data as Record<string, unknown>)?.required);

    // ── 6. List all schemas ─────────────────────────────────────────
    const allSchemas = await schemas.getAllSchemas();
    console.log("6. Total schemas:", allSchemas.length);

    // ── 7. Register additional schemas ──────────────────────────────
    await schemas.registerSchema([
      {
        name: "journey_user_schema",
        version: 1,
        type: "JSON",
        data: {
          type: "object",
          properties: {
            userId: { type: "string" },
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["admin", "user", "viewer"] },
          },
          required: ["userId", "email"],
        },
      },
    ]);
    console.log("7. Registered additional schema: journey_user_schema");

    // ── 8. Cleanup ──────────────────────────────────────────────────
    await schemas.deleteSchema(schemaName, 1);
    console.log("8. Deleted schema v1");

    await schemas.deleteSchema(schemaName, 2);
    console.log("9. Deleted schema v2");

    await schemas.deleteSchemaByName("journey_user_schema");
    console.log("10. Deleted user schema (all versions)");
  } catch (err) {
    console.error("Error:", err);

    // Best-effort cleanup
    try { await schemas.deleteSchemaByName(schemaName); } catch { /* ignore */ }
    try { await schemas.deleteSchemaByName("journey_user_schema"); } catch { /* ignore */ }
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
