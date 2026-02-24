import type {
  Client,
  ExtendedConductorUser,
  ExtendedGroup,
} from "../../../open-api";
import type {
  AuthorizationRequest,
  GrantedAccessResponse,
  UpsertGroupRequest,
  UpsertUserRequest,
} from "../../../open-api/generated";
import {
  AuthorizationResource,
  GroupResource,
  UserResource,
} from "../../../open-api/generated";
import { handleSdkError } from "../../helpers/errors";

export class AuthorizationClient {
  public readonly _client: Client;

  constructor(client: Client) {
    this._client = client;
  }

  // ==================== Permission Management ====================

  /**
   * Grant permissions to a subject for a target
   * @param request - The authorization request
   */
  public async grantPermissions(
    request: AuthorizationRequest
  ): Promise<void> {
    try {
      await AuthorizationResource.grantPermissions({
        body: request,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, "Failed to grant permissions");
    }
  }

  /**
   * Get permissions for a resource
   * @param type - The resource type
   * @param id - The resource ID
   * @returns The permissions object
   */
  public async getPermissions(
    type:
      | "WORKFLOW"
      | "WORKFLOW_DEF"
      | "WORKFLOW_SCHEDULE"
      | "EVENT_HANDLER"
      | "TASK_DEF"
      | "TASK_REF_NAME"
      | "TASK_ID"
      | "APPLICATION"
      | "USER"
      | "SECRET_NAME"
      | "ENV_VARIABLE"
      | "TAG"
      | "DOMAIN"
      | "INTEGRATION_PROVIDER"
      | "INTEGRATION"
      | "PROMPT"
      | "USER_FORM_TEMPLATE"
      | "SCHEMA"
      | "CLUSTER_CONFIG"
      | "WEBHOOK",
    id: string
  ): Promise<{ [key: string]: unknown }> {
    try {
      const { data } = await AuthorizationResource.getPermissions({
        path: { type, id },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get permissions for ${type} '${id}'`);
    }
  }

  /**
   * Remove permissions from a subject for a target
   * @param request - The authorization request
   */
  public async removePermissions(
    request: AuthorizationRequest
  ): Promise<void> {
    try {
      await AuthorizationResource.removePermissions({
        body: request,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, "Failed to remove permissions");
    }
  }

  // ==================== User Management ====================

  /**
   * Create or update a user
   * @param id - The user ID
   * @param request - The upsert user request
   * @returns The user object
   */
  public async upsertUser(
    id: string,
    request: UpsertUserRequest
  ): Promise<{ [key: string]: unknown }> {
    try {
      const { data } = await UserResource.upsertUser({
        path: { id },
        body: request,
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to upsert user '${id}'`);
    }
  }

  /**
   * Get a user by ID
   * @param id - The user ID
   * @returns The user object
   */
  public async getUser(id: string): Promise<{ [key: string]: unknown }> {
    try {
      const { data } = await UserResource.getUser({
        path: { id },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get user '${id}'`);
    }
  }

  /**
   * List all users
   * @param apps - Whether to include application users
   * @returns Array of users
   */
  public async listUsers(apps = false): Promise<ExtendedConductorUser[]> {
    try {
      const { data } = await UserResource.listUsers({
        query: { apps },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, "Failed to list users");
    }
  }

  /**
   * Delete a user
   * @param id - The user ID
   */
  public async deleteUser(id: string): Promise<void> {
    try {
      await UserResource.deleteUser({
        path: { id },
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to delete user '${id}'`);
    }
  }

  /**
   * Check permissions for a user
   * @param userId - The user ID
   * @param type - The resource type
   * @param id - The resource ID
   * @returns The permissions check result
   */
  public async checkPermissions(
    userId: string,
    type: string,
    id: string
  ): Promise<{ [key: string]: unknown }> {
    try {
      const { data } = await UserResource.checkPermissions({
        path: { userId },
        query: { type, id },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to check permissions for user '${userId}'`
      );
    }
  }

  /**
   * Get granted permissions for a user
   * @param userId - The user ID
   * @returns The granted permissions
   */
  public async getGrantedPermissionsForUser(
    userId: string
  ): Promise<{ [key: string]: unknown }> {
    try {
      const { data } = await UserResource.getGrantedPermissions({
        path: { userId },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to get granted permissions for user '${userId}'`
      );
    }
  }

  // ==================== Group Management ====================

  /**
   * Create or update a group
   * @param id - The group ID
   * @param request - The upsert group request
   * @returns The group object
   */
  public async upsertGroup(
    id: string,
    request: UpsertGroupRequest
  ): Promise<{ [key: string]: unknown }> {
    try {
      const { data } = await GroupResource.upsertGroup({
        path: { id },
        body: request,
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to upsert group '${id}'`);
    }
  }

  /**
   * Get a group by ID
   * @param id - The group ID
   * @returns The group object
   */
  public async getGroup(id: string): Promise<{ [key: string]: unknown }> {
    try {
      const { data } = await GroupResource.getGroup({
        path: { id },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get group '${id}'`);
    }
  }

  /**
   * List all groups
   * @returns Array of groups
   */
  public async listGroups(): Promise<ExtendedGroup[]> {
    try {
      const { data } = await GroupResource.listGroups({
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, "Failed to list groups");
    }
  }

  /**
   * Delete a group
   * @param id - The group ID
   */
  public async deleteGroup(id: string): Promise<void> {
    try {
      await GroupResource.deleteGroup({
        path: { id },
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to delete group '${id}'`);
    }
  }

  /**
   * Add a user to a group
   * @param groupId - The group ID
   * @param userId - The user ID
   */
  public async addUserToGroup(
    groupId: string,
    userId: string
  ): Promise<void> {
    try {
      await GroupResource.addUserToGroup({
        path: { groupId, userId },
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to add user '${userId}' to group '${groupId}'`
      );
    }
  }

  /**
   * Add multiple users to a group
   * @param groupId - The group ID
   * @param userIds - Array of user IDs
   */
  public async addUsersToGroup(
    groupId: string,
    userIds: string[]
  ): Promise<void> {
    try {
      await GroupResource.addUsersToGroup({
        path: { groupId },
        body: userIds,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to add users to group '${groupId}'`);
    }
  }

  /**
   * Get users in a group
   * @param id - The group ID
   * @returns The users in the group
   */
  public async getUsersInGroup(
    id: string
  ): Promise<{ [key: string]: unknown }> {
    try {
      const { data } = await GroupResource.getUsersInGroup({
        path: { id },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get users in group '${id}'`);
    }
  }

  /**
   * Remove a user from a group
   * @param groupId - The group ID
   * @param userId - The user ID
   */
  public async removeUserFromGroup(
    groupId: string,
    userId: string
  ): Promise<void> {
    try {
      await GroupResource.removeUserFromGroup({
        path: { groupId, userId },
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to remove user '${userId}' from group '${groupId}'`
      );
    }
  }

  /**
   * Remove multiple users from a group
   * @param groupId - The group ID
   * @param userIds - Array of user IDs
   */
  public async removeUsersFromGroup(
    groupId: string,
    userIds: string[]
  ): Promise<void> {
    try {
      await GroupResource.removeUsersFromGroup({
        path: { groupId },
        body: userIds,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to remove users from group '${groupId}'`
      );
    }
  }

  /**
   * Get granted permissions for a group
   * @param groupId - The group ID
   * @returns The granted access response
   */
  public async getGrantedPermissionsForGroup(
    groupId: string
  ): Promise<GrantedAccessResponse> {
    try {
      const { data } = await GroupResource.getGrantedPermissions1({
        path: { groupId },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to get granted permissions for group '${groupId}'`
      );
    }
  }
}
