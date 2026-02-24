/**
 * Secrets API Journey — Full lifecycle of secret management
 *
 * Demonstrates all SecretClient APIs:
 *   - Put, get, check existence, delete secrets
 *   - List all secret names
 *   - List secrets user can grant access to
 *   - Tag management for secrets
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/api-journeys/secrets.ts
 */
import { OrkesClients } from "../../src/sdk";

async function main() {
  const clients = await OrkesClients.from();
  const secrets = clients.getSecretClient();

  const secretKey = "journey_example_api_key";

  try {
    // ── 1. Store a secret ───────────────────────────────────────────
    await secrets.putSecret(secretKey, "sk-example-secret-value-12345");
    console.log("1. Stored secret:", secretKey);

    // ── 2. Check if secret exists ───────────────────────────────────
    const exists = await secrets.secretExists(secretKey);
    console.log("2. Secret exists:", exists);

    // ── 3. Get the secret value ─────────────────────────────────────
    const value = await secrets.getSecret(secretKey);
    console.log("3. Secret value:", value.substring(0, 10) + "...");

    // ── 4. Update the secret ────────────────────────────────────────
    await secrets.putSecret(secretKey, "sk-updated-secret-value-67890");
    console.log("4. Updated secret value");

    // ── 5. List all secret names ────────────────────────────────────
    const allNames = await secrets.listAllSecretNames();
    console.log("5. All secret names:", allNames);

    // ── 6. List secrets user can grant access to ────────────────────
    const grantable = await secrets.listSecretsThatUserCanGrantAccessTo();
    console.log("6. Grantable secrets:", grantable);

    // ── 7. Tag management ───────────────────────────────────────────
    await secrets.setSecretTags(
      [
        { key: "env", value: "staging" },
        { key: "service", value: "payment" },
      ],
      secretKey
    );
    console.log("7. Set secret tags");

    const tags = await secrets.getSecretTags(secretKey);
    console.log("8. Secret tags:", JSON.stringify(tags));

    await secrets.deleteSecretTags(
      [{ key: "env", value: "staging" }],
      secretKey
    );
    console.log("9. Deleted secret tag");

    // Verify remaining tags
    const remainingTags = await secrets.getSecretTags(secretKey);
    console.log("10. Remaining tags:", JSON.stringify(remainingTags));

    // ── 8. Cleanup ──────────────────────────────────────────────────
    await secrets.deleteSecret(secretKey);
    console.log("11. Deleted secret");

    // Verify deletion
    const existsAfter = await secrets.secretExists(secretKey);
    console.log("12. Secret exists after delete:", existsAfter);
  } catch (err) {
    console.error("Error:", err);

    // Best-effort cleanup
    try { await secrets.deleteSecret(secretKey); } catch { /* ignore */ }
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
