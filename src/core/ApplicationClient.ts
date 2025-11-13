import { ApplicationResource } from "../common/open-api/sdk.gen";
import { Client } from "../common/open-api/client";
import { handleSdkError } from "./helpers";
import type {
  Tag,
  ExtendedConductorApplication,
  AccessKey,
  AccessKeyInfo,
} from "../common";

export class ApplicationClient {
  public readonly _client: Client;

  constructor(client: Client) {
    this._client = client;
  }

  /**
   * Get all applications
   * @returns {Promise<ExtendedConductorApplication[]>}
   * @throws {ConductorSdkError}
   */
  public async getAllApplications(): Promise<ExtendedConductorApplication[]> {
    try {
      const { data } = await ApplicationResource.listApplications({
        client: this._client,
        throwOnError: true,
      });

      return data as ExtendedConductorApplication[]; // TODO: remove cast after OpenApi spec type update
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get all applications`);
    }
  }

  /**
   * Create an application
   * @param {string} applicationName
   * @returns {Promise<ExtendedConductorApplication>}
   * @throws {ConductorSdkError}
   */
  public async createApplication(
    applicationName: string
  ): Promise<ExtendedConductorApplication> {
    try {
      const { data } = await ApplicationResource.createApplication({
        body: { name: applicationName },
        client: this._client,
        throwOnError: true,
      });

      return data as unknown as ExtendedConductorApplication; // TODO: remove cast after OpenApi spec type update
    } catch (error: unknown) {
      handleSdkError(error, `Failed to create application`);
    }
  }

  /**
   * Get application by access key id
   * @param {string} accessKeyId
   * @returns {Promise<ExtendedConductorApplication>}
   * @throws {ConductorSdkError}
   */
  public async getAppByAccessKeyId(
    accessKeyId: string
  ): Promise<ExtendedConductorApplication> {
    try {
      const { data } = await ApplicationResource.getAppByAccessKeyId({
        path: { accessKeyId },
        client: this._client,
        throwOnError: true,
      });

      return data as unknown as ExtendedConductorApplication; // TODO: remove cast after OpenApi spec type update
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to get application by access key id: ${accessKeyId}`
      );
    }
  }

  /**
   * Delete an access key
   * @param {string} applicationId
   * @param {string} keyId
   * @returns {Promise<void>}
   * @throws {ConductorSdkError}
   */
  public async deleteAccessKey(
    applicationId: string,
    keyId: string
  ): Promise<void> {
    try {
      await ApplicationResource.deleteAccessKey({
        path: { applicationId, keyId },
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to delete access key ${keyId} for application ${applicationId}`
      );
    }
  }

  /**
   * Toggle the status of an access key
   * @param {string} applicationId
   * @param {string} keyId
   * @returns {Promise<AccessKeyInfo>}
   * @throws {ConductorSdkError}
   */
  public async toggleAccessKeyStatus(
    applicationId: string,
    keyId: string
  ): Promise<AccessKeyInfo> {
    try {
      const { data } = await ApplicationResource.toggleAccessKeyStatus({
        path: { applicationId, keyId },
        client: this._client,
        throwOnError: true,
      });

      return data as unknown as AccessKeyInfo; // TODO: remove cast after OpenApi spec type update
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to toggle access key status ${keyId} for application ${applicationId}`
      );
    }
  }

  /**
   * Remove role from application user
   * @param {string} applicationId
   * @param {string} role
   * @returns {Promise<void>}
   * @throws {ConductorSdkError}
   */
  public async removeRoleFromApplicationUser(
    applicationId: string,
    role: string
  ): Promise<void> {
    try {
      await ApplicationResource.removeRoleFromApplicationUser({
        path: { applicationId, role },
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to remove role ${role} from application user ${applicationId}`
      );
    }
  }

  /**
   * Add role to application user
   * @param {string} applicationId
   * @param {string} role
   * @returns {Promise<void>}
   * @throws {ConductorSdkError}
   */
  public async addRoleToApplicationUser(
    applicationId: string,
    role: string
  ): Promise<void> {
    try {
      await ApplicationResource.addRoleToApplicationUser({
        path: { applicationId, role },
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to add role ${role} to application user ${applicationId}`
      );
    }
  }

  /**
   * Delete an application
   * @param {string} applicationId
   * @returns {Promise<void>}
   * @throws {ConductorSdkError}
   */
  public async deleteApplication(applicationId: string): Promise<void> {
    try {
      await ApplicationResource.deleteApplication({
        path: { id: applicationId },
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to delete application: ${applicationId}`);
    }
  }

  /**
   * Get an application by id
   * @param {string} applicationId
   * @returns {Promise<ExtendedConductorApplication>}
   * @throws {ConductorSdkError}
   */
  public async getApplication(
    applicationId: string
  ): Promise<ExtendedConductorApplication> {
    try {
      const { data } = await ApplicationResource.getApplication({
        path: { id: applicationId },
        client: this._client,
        throwOnError: true,
      });

      return data as unknown as ExtendedConductorApplication; // TODO: remove cast after OpenApi spec type update
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get application: ${applicationId}`);
    }
  }

  /**
   * Update an application
   * @param {string} applicationId
   * @param {string} newApplicationName
   * @returns {Promise<ExtendedConductorApplication>}
   * @throws {ConductorSdkError}
   */
  public async updateApplication(
    applicationId: string,
    newApplicationName: string
  ): Promise<ExtendedConductorApplication> {
    try {
      const { data } = await ApplicationResource.updateApplication({
        path: { id: applicationId },
        body: { name: newApplicationName },
        client: this._client,
        throwOnError: true,
      });

      return data as unknown as ExtendedConductorApplication; // TODO: remove cast after OpenApi spec type update
    } catch (error: unknown) {
      handleSdkError(error, `Failed to update application ${applicationId}`);
    }
  }

  /**
   * Get application's access keys
   * @param {string} applicationId
   * @returns {Promise<AccessKeyInfo[]>}
   * @throws {ConductorSdkError}
   */
  public async getAccessKeys(applicationId: string): Promise<AccessKeyInfo[]> {
    try {
      const { data } = await ApplicationResource.getAccessKeys({
        path: { id: applicationId },
        client: this._client,
        throwOnError: true,
      });

      return data as unknown as AccessKeyInfo[]; // TODO: remove cast after OpenApi spec update
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to get access keys for application: ${applicationId}`
      );
    }
  }

  /**
   * Create an access key for an application
   * @param {string} applicationId
   * @returns {Promise<AccessKey>}
   * @throws {ConductorSdkError}
   */
  public async createAccessKey(applicationId: string): Promise<AccessKey> {
    try {
      const { data } = await ApplicationResource.createAccessKey({
        path: { id: applicationId },
        client: this._client,
        throwOnError: true,
      });

      return data as unknown as AccessKey; // TODO: remove cast after OpenApi spec update
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to create access key for application: ${applicationId}`
      );
    }
  }

  /**
   * Delete application tags
   * @param {string} applicationId
   * @param {Tag[]} tags
   * @returns {Promise<void>}
   * @throws {ConductorSdkError}
   */
  public async deleteApplicationTags(
    applicationId: string,
    tags: Tag[]
  ): Promise<void> {
    try {
      await ApplicationResource.deleteTagForApplication({
        path: { id: applicationId },
        body: tags,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to delete tags for application: ${applicationId}`
      );
    }
  }

  /**
   * Delete a single application tag
   * @param {string} applicationId
   * @param {Tag} tag
   * @returns {Promise<void>}
   * @throws {ConductorSdkError}
   */
  public async deleteApplicationTag(
    applicationId: string,
    tag: Tag
  ): Promise<void> {
    try {
      await ApplicationResource.deleteTagForApplication({
        path: { id: applicationId },
        body: [tag],
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to delete a tag for application: ${applicationId}`
      );
    }
  }

  /**
   * Get application tags
   * @param {string} applicationId
   * @returns {Promise<Tag[]>}
   * @throws {ConductorSdkError}
   */
  public async getApplicationTags(applicationId: string): Promise<Tag[]> {
    try {
      const { data } = await ApplicationResource.getTagsForApplication({
        path: { id: applicationId },
        client: this._client,
        throwOnError: true,
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to get tags for application: ${applicationId}`
      );
    }
  }

  /**
   * Add application tags
   * @param {string} applicationId
   * @param {Tag[]} tags
   * @returns {Promise<void>}
   * @throws {ConductorSdkError}
   */
  public async addApplicationTags(
    applicationId: string,
    tags: Tag[]
  ): Promise<void> {
    try {
      await ApplicationResource.putTagForApplication({
        path: { id: applicationId },
        body: tags,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to add application tags: ${applicationId}`);
    }
  }

  /**
   * Add a single application tag
   * @param {string} applicationId
   * @param {Tag} tag
   * @returns {Promise<void>}
   * @throws {ConductorSdkError}
   */
  public async addApplicationTag(
    applicationId: string,
    tag: Tag
  ): Promise<void> {
    try {
      await ApplicationResource.putTagForApplication({
        path: { id: applicationId },
        body: [tag],
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to add an application tag: ${applicationId}`
      );
    }
  }
}
