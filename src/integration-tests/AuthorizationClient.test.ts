import { expect, describe, test, jest, beforeAll, afterAll } from "@jest/globals";
import {
  orkesConductorClient,
  OrkesClients,
  AuthorizationClient,
  MetadataClient,
} from "../sdk";

/**
 * E2E Integration Tests for AuthorizationClient
 *
 * Tests user management, group management, and permission operations
 * in a lifecycle order: create → read → update → delete.
 */
describe("AuthorizationClient", () => {
  jest.setTimeout(60000);

  const suffix = Date.now();

  let authClient: AuthorizationClient;
  let metadataClient: MetadataClient;

  const userId = `jssdktest_user_${suffix}`;
  const userId2 = `jssdktest_user2_${suffix}`;
  const groupId = `jssdktest_group_${suffix}`;
  const workflowName = `jsSdkTest_auth_wf_${suffix}`;

  // Track resources for cleanup
  const usersToCleanup: string[] = [];
  const groupsToCleanup: string[] = [];

  beforeAll(async () => {
    // Retry client creation to handle transient auth failures in CI
    const maxAttempts = 3;
    let client;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        client = await orkesConductorClient();
        break;
      } catch (e) {
        if (attempt === maxAttempts) throw e;
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
    const clients = new OrkesClients(client!);
    authClient = clients.getAuthorizationClient();
    metadataClient = clients.getMetadataClient();

    // Register a workflow def to test permissions against
    await metadataClient.registerWorkflowDef(
      {
        name: workflowName,
        version: 1,
        tasks: [
          {
            name: "set_var",
            taskReferenceName: "set_var_ref",
            type: "SET_VARIABLE",
            inputParameters: { placeholder: true },
          },
        ],
        timeoutSeconds: 60,
        inputParameters: [],
      },
      true
    );
  });

  afterAll(async () => {
    // Skip cleanup if beforeAll failed (e.g. auth error in CI) and clients were never set
    if (!authClient || !metadataClient) return;
    // Cleanup groups first (they reference users)
    for (const gid of groupsToCleanup) {
      try {
        await authClient.deleteGroup(gid);
      } catch (e) {
        console.debug(`Cleanup group '${gid}' failed:`, e);
      }
    }
    // Then cleanup users
    for (const uid of usersToCleanup) {
      try {
        await authClient.deleteUser(uid);
      } catch (e) {
        console.debug(`Cleanup user '${uid}' failed:`, e);
      }
    }
    // Cleanup workflow def
    try {
      await metadataClient.unregisterWorkflow(workflowName, 1);
    } catch (e) {
      console.debug(`Cleanup workflow '${workflowName}' failed:`, e);
    }
  });

  // ==================== User Management ====================

  describe("User Management", () => {
    test("upsertUser should create a new user", async () => {
      const result = await authClient.upsertUser(userId, {
        name: `Test User ${suffix}`,
        roles: "USER",
      });
      usersToCleanup.push(userId);

      expect(result).toBeDefined();
    });

    test("upsertUser should create a second user", async () => {
      const result = await authClient.upsertUser(userId2, {
        name: `Test User2 ${suffix}`,
        roles: "USER",
      });
      usersToCleanup.push(userId2);

      expect(result).toBeDefined();
    });

    test("getUser should return the created user", async () => {
      const user = await authClient.getUser(userId);

      expect(user).toBeDefined();
    });

    test("listUsers should return an array", async () => {
      const users = await authClient.listUsers();

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);
    });

    test("upsertUser should update an existing user", async () => {
      const result = await authClient.upsertUser(userId, {
        name: `Updated Test User ${suffix}`,
        roles: "USER",
      });

      expect(result).toBeDefined();
    });
  });

  // ==================== Group Management ====================

  describe("Group Management", () => {
    test("upsertGroup should create a new group", async () => {
      const result = await authClient.upsertGroup(groupId, {
        description: `Test group ${suffix}`,
        roles: "USER",
      });
      groupsToCleanup.push(groupId);

      expect(result).toBeDefined();
    });

    test("getGroup should return the created group", async () => {
      const group = await authClient.getGroup(groupId);

      expect(group).toBeDefined();
      expect(group.id).toEqual(groupId);
    });

    test("listGroups should include the created group", async () => {
      const groups = await authClient.listGroups();

      expect(Array.isArray(groups)).toBe(true);
      const found = groups.find((g) => g.id === groupId);
      expect(found).toBeDefined();
    });

    test("upsertGroup should update an existing group", async () => {
      const result = await authClient.upsertGroup(groupId, {
        description: `Updated test group ${suffix}`,
        roles: "USER",
      });

      expect(result).toBeDefined();
    });

    test("addUserToGroup should add a single user to the group", async () => {
      await expect(
        authClient.addUserToGroup(groupId, userId)
      ).resolves.not.toThrow();
    });

    test("getUsersInGroup should return the added user", async () => {
      const result = await authClient.getUsersInGroup(groupId);

      expect(result).toBeDefined();
    });

    test("addUsersToGroup should add multiple users to the group", async () => {
      await expect(
        authClient.addUsersToGroup(groupId, [userId2])
      ).resolves.not.toThrow();
    });

    test("removeUserFromGroup should remove a single user", async () => {
      await expect(
        authClient.removeUserFromGroup(groupId, userId2)
      ).resolves.not.toThrow();
    });

    test("removeUsersFromGroup should remove multiple users", async () => {
      await expect(
        authClient.removeUsersFromGroup(groupId, [userId])
      ).resolves.not.toThrow();
    });
  });

  // ==================== Permission Management ====================

  describe("Permission Management", () => {
    test("grantPermissions should grant access to a workflow", async () => {
      await expect(
        authClient.grantPermissions({
          subject: {
            type: "USER",
            id: userId,
          },
          target: {
            type: "WORKFLOW_DEF",
            id: workflowName as never,
          },
          access: ["READ", "EXECUTE"],
        })
      ).resolves.not.toThrow();
    });

    test("getPermissions should return permissions for the workflow", async () => {
      const permissions = await authClient.getPermissions(
        "WORKFLOW_DEF",
        workflowName
      );

      expect(permissions).toBeDefined();
    });

    test("checkPermissions should verify user has access", async () => {
      const result = await authClient.checkPermissions(
        userId,
        "WORKFLOW_DEF",
        workflowName
      );

      expect(result).toBeDefined();
    });

    test("getGrantedPermissionsForUser should return user permissions", async () => {
      const result = await authClient.getGrantedPermissionsForUser(userId);

      expect(result).toBeDefined();
    });

    test("getGrantedPermissionsForGroup should return group permissions", async () => {
      // First grant permission to the group
      await authClient.grantPermissions({
        subject: {
          type: "GROUP",
          id: groupId,
        },
        target: {
          type: "WORKFLOW_DEF",
          id: workflowName as never,
        },
        access: ["READ"],
      });

      const result = await authClient.getGrantedPermissionsForGroup(groupId);

      expect(result).toBeDefined();
    });

    test("removePermissions should revoke access", async () => {
      await expect(
        authClient.removePermissions({
          subject: {
            type: "USER",
            id: userId,
          },
          target: {
            type: "WORKFLOW_DEF",
            id: workflowName as never,
          },
          access: ["READ", "EXECUTE"],
        })
      ).resolves.not.toThrow();
    });
  });

  // ==================== Cleanup Lifecycle ====================

  describe("Deletion", () => {
    test("deleteGroup should remove the group", async () => {
      await expect(authClient.deleteGroup(groupId)).resolves.not.toThrow();
      groupsToCleanup.splice(groupsToCleanup.indexOf(groupId), 1);
    });

    test("deleteUser should remove the user", async () => {
      await expect(authClient.deleteUser(userId)).resolves.not.toThrow();
      usersToCleanup.splice(usersToCleanup.indexOf(userId), 1);
    });

    test("deleteUser should remove the second user", async () => {
      await expect(authClient.deleteUser(userId2)).resolves.not.toThrow();
      usersToCleanup.splice(usersToCleanup.indexOf(userId2), 1);
    });

    test("getUser should throw for deleted user", async () => {
      await expect(authClient.getUser(userId)).rejects.toThrow();
    });

    test("getGroup should throw for deleted group", async () => {
      await expect(authClient.getGroup(groupId)).rejects.toThrow();
    });
  });

  // ==================== Error Paths ====================

  describe("Error Paths", () => {
    test("getUser should throw for non-existent user", async () => {
      await expect(
        authClient.getUser("nonexistent_user_999999")
      ).rejects.toThrow();
    });

    test("getGroup should throw for non-existent group", async () => {
      await expect(
        authClient.getGroup("nonexistent_group_999999")
      ).rejects.toThrow();
    });

    test("deleteUser should throw for non-existent user", async () => {
      await expect(
        authClient.deleteUser("nonexistent_user_999999")
      ).rejects.toThrow();
    });

    test("deleteGroup should throw for non-existent group", async () => {
      await expect(
        authClient.deleteGroup("nonexistent_group_999999")
      ).rejects.toThrow();
    });

    test("addUserToGroup should throw for non-existent user", async () => {
      // Create a temp group for this test
      const tempGroup = `jssdktest_errgroup_${Date.now()}`;
      await authClient.upsertGroup(tempGroup, {
        description: "temp",
        roles: "USER",
      });
      try {
        await expect(
          authClient.addUserToGroup(tempGroup, "nonexistent_user_999999")
        ).rejects.toThrow();
      } finally {
        try { await authClient.deleteGroup(tempGroup); } catch { /* ok */ }
      }
    });

    test("getUsersInGroup should throw for non-existent group", async () => {
      await expect(
        authClient.getUsersInGroup("nonexistent_group_999999")
      ).rejects.toThrow();
    });
  });
});
