/**
 * Authorization API Journey — Full lifecycle of users, groups, and permissions
 *
 * Demonstrates all AuthorizationClient APIs:
 *   - User CRUD (upsert, get, list, delete)
 *   - Group CRUD (upsert, get, list, delete)
 *   - Group membership (add/remove users)
 *   - Permission management (grant, get, check, remove)
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/api-journeys/authorization.ts
 */
import { OrkesClients } from "../../src/sdk";

async function main() {
  const clients = await OrkesClients.from();
  const auth = clients.getAuthorizationClient();

  const userId = "example_user_1";
  const groupId = "example_group_1";

  try {
    // ── 1. User Management ────────────────────────────────────────────
    console.log("=== User Management ===\n");

    // Create a user
    const user = await auth.upsertUser(userId, {
      name: "Example User",
      roles: ["USER"],
    });
    console.log("1. Created user:", JSON.stringify(user, null, 2));

    // Get user
    const fetchedUser = await auth.getUser(userId);
    console.log("2. Fetched user:", JSON.stringify(fetchedUser, null, 2));

    // List all users
    const allUsers = await auth.listUsers();
    console.log("3. Total users:", allUsers.length);

    // ── 2. Group Management ───────────────────────────────────────────
    console.log("\n=== Group Management ===\n");

    // Create a group
    const group = await auth.upsertGroup(groupId, {
      description: "Example group for API journey",
      roles: ["USER"],
    });
    console.log("4. Created group:", JSON.stringify(group, null, 2));

    // Get group
    const fetchedGroup = await auth.getGroup(groupId);
    console.log("5. Fetched group:", JSON.stringify(fetchedGroup, null, 2));

    // List all groups
    const allGroups = await auth.listGroups();
    console.log("6. Total groups:", allGroups.length);

    // ── 3. Group Membership ───────────────────────────────────────────
    console.log("\n=== Group Membership ===\n");

    // Add user to group
    await auth.addUserToGroup(groupId, userId);
    console.log("7. Added user to group");

    // Get users in group
    const usersInGroup = await auth.getUsersInGroup(groupId);
    console.log("8. Users in group:", JSON.stringify(usersInGroup, null, 2));

    // Remove user from group
    await auth.removeUserFromGroup(groupId, userId);
    console.log("9. Removed user from group");

    // ── 4. Permission Management ──────────────────────────────────────
    console.log("\n=== Permission Management ===\n");

    // Grant permissions
    await auth.grantPermissions({
      subject: { type: "user", id: userId },
      target: { type: "WORKFLOW_DEF", id: "example_workflow" },
      access: ["READ", "EXECUTE"],
    });
    console.log("10. Granted permissions to user");

    // Get permissions
    const perms = await auth.getPermissions("WORKFLOW_DEF", "example_workflow");
    console.log("11. Permissions:", JSON.stringify(perms, null, 2));

    // Check user permissions
    const check = await auth.checkPermissions(
      userId,
      "WORKFLOW_DEF",
      "example_workflow"
    );
    console.log("12. Permission check:", JSON.stringify(check, null, 2));

    // Get granted permissions for user
    const grantedPerms = await auth.getGrantedPermissionsForUser(userId);
    console.log(
      "13. User granted permissions:",
      JSON.stringify(grantedPerms, null, 2)
    );

    // Get granted permissions for group
    const groupPerms = await auth.getGrantedPermissionsForGroup(groupId);
    console.log(
      "14. Group granted permissions:",
      JSON.stringify(groupPerms, null, 2)
    );

    // Remove permissions
    await auth.removePermissions({
      subject: { type: "user", id: userId },
      target: { type: "WORKFLOW_DEF", id: "example_workflow" },
      access: ["READ", "EXECUTE"],
    });
    console.log("15. Removed permissions");

    // ── 5. Cleanup ──────────────────────────────────────────────────
    console.log("\n=== Cleanup ===\n");

    await auth.deleteGroup(groupId);
    console.log("16. Deleted group");

    await auth.deleteUser(userId);
    console.log("17. Deleted user");
  } catch (err) {
    console.error("Error:", err);

    // Best-effort cleanup
    try { await auth.deleteGroup(groupId); } catch { /* ignore */ }
    try { await auth.deleteUser(userId); } catch { /* ignore */ }
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
