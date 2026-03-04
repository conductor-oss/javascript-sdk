/**
 * Application API Journey — Full lifecycle of applications and access keys
 *
 * Demonstrates all ApplicationClient APIs:
 *   - Application CRUD (create, get, update, list, delete)
 *   - Access key management (create, list, toggle, delete)
 *   - Role management (add, remove)
 *   - Tag management (add, get, delete)
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/api-journeys/applications.ts
 */
import { OrkesClients } from "../../src/sdk";

async function main() {
  const clients = await OrkesClients.from();
  const appClient = clients.getApplicationClient();

  const appName = `example_app_${Date.now()}`;
  let applicationId = "";
  let accessKeyId = "";

  try {
    // ── 1. Application CRUD ───────────────────────────────────────────
    console.log("=== Application CRUD ===\n");

    // Create application
    const app = await appClient.createApplication(appName);
    if (!app.id) throw new Error("Expected application id");
    applicationId = app.id;
    console.log(`1. Created application: ${app.name} (id: ${applicationId})`);

    // Get application
    const fetched = await appClient.getApplication(applicationId);
    console.log(`2. Fetched application: ${fetched.name}`);

    // Update application name
    const updatedName = `${appName}_updated`;
    const updated = await appClient.updateApplication(applicationId, updatedName);
    console.log(`3. Updated application name: ${updated.name}`);

    // List all applications
    const allApps = await appClient.getAllApplications();
    console.log(`4. Total applications: ${allApps.length}`);

    // ── 2. Access Key Management ──────────────────────────────────────
    console.log("\n=== Access Key Management ===\n");

    // Create access key
    const accessKey = await appClient.createAccessKey(applicationId);
    accessKeyId = accessKey.id;
    console.log(`5. Created access key: ${accessKey.id}`);
    console.log(`   Secret: ${accessKey.secret?.substring(0, 10)}...`);

    // List access keys
    const keys = await appClient.getAccessKeys(applicationId);
    console.log(`6. Access keys for app: ${keys.length}`);

    // Toggle access key status (active -> inactive)
    const toggled = await appClient.toggleAccessKeyStatus(applicationId, accessKeyId);
    console.log(`7. Toggled access key status: ${toggled.status}`);

    // Toggle back (inactive -> active)
    const toggledBack = await appClient.toggleAccessKeyStatus(applicationId, accessKeyId);
    console.log(`8. Toggled back: ${toggledBack.status}`);

    // ── 3. Role Management ────────────────────────────────────────────
    console.log("\n=== Role Management ===\n");

    // Add role
    await appClient.addApplicationRole(applicationId, "WORKER");
    console.log("9. Added WORKER role");

    // Remove role
    await appClient.removeRoleFromApplicationUser(applicationId, "WORKER");
    console.log("10. Removed WORKER role");

    // ── 4. Tag Management ─────────────────────────────────────────────
    console.log("\n=== Tag Management ===\n");

    // Add tags
    await appClient.addApplicationTags(applicationId, [
      { key: "environment", value: "staging" },
      { key: "team", value: "platform" },
    ]);
    console.log("11. Added tags");

    // Get tags
    const tags = await appClient.getApplicationTags(applicationId);
    console.log(`12. Tags: ${JSON.stringify(tags)}`);

    // Delete a single tag
    await appClient.deleteApplicationTag(applicationId, {
      key: "team",
      value: "platform",
    });
    console.log("13. Deleted 'team' tag");

    // Verify remaining tags
    const remainingTags = await appClient.getApplicationTags(applicationId);
    console.log(`14. Remaining tags: ${JSON.stringify(remainingTags)}`);

    // Lookup by access key
    const lookedUp = await appClient.getAppByAccessKeyId(accessKeyId);
    console.log(`15. Looked up app by access key: ${lookedUp.name}`);

    // ── 5. Cleanup ──────────────────────────────────────────────────
    console.log("\n=== Cleanup ===\n");

    // Delete access key
    await appClient.deleteAccessKey(applicationId, accessKeyId);
    console.log("16. Deleted access key");

    // Delete remaining tags
    await appClient.deleteApplicationTags(applicationId, remainingTags);
    console.log("17. Deleted remaining tags");

    // Delete application
    await appClient.deleteApplication(applicationId);
    console.log("18. Deleted application");
  } catch (err) {
    console.error("Error:", err);

    // Best-effort cleanup
    try {
      if (accessKeyId && applicationId) {
        await appClient.deleteAccessKey(applicationId, accessKeyId);
      }
    } catch {
      /* ignore */
    }
    try {
      if (applicationId) {
        await appClient.deleteApplication(applicationId);
      }
    } catch {
      /* ignore */
    }
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
