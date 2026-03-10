import type { Client, Tag } from "../../../open-api";
import { SecretResource } from "../../../open-api/generated";
import { handleSdkError } from "../../helpers/errors";

export class SecretClient {
  public readonly _client: Client;

  constructor(client: Client) {
    this._client = client;
  }

  /**
   * Store a secret value
   * @param key - The secret key
   * @param value - The secret value
   */
  public async putSecret(key: string, value: string): Promise<void> {
    try {
      await SecretResource.putSecret({
        path: { key },
        body: value,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to put secret '${key}'`);
    }
  }

  /**
   * Get a secret value
   * @param key - The secret key
   * @returns The secret value
   */
  public async getSecret(key: string): Promise<string> {
    try {
      const { data } = await SecretResource.getSecret({
        path: { key },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get secret '${key}'`);
    }
  }

  /**
   * Delete a secret
   * @param key - The secret key
   */
  public async deleteSecret(key: string): Promise<void> {
    try {
      await SecretResource.deleteSecret({
        path: { key },
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to delete secret '${key}'`);
    }
  }

  /**
   * List all secret names
   * @returns Array of secret names
   */
  public async listAllSecretNames(): Promise<string[]> {
    try {
      const { data } = await SecretResource.listAllSecretNames({
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, "Failed to list all secret names");
    }
  }

  /**
   * List secrets that the user can grant access to
   * @returns Array of secret names
   */
  public async listSecretsThatUserCanGrantAccessTo(): Promise<string[]> {
    try {
      const { data } =
        await SecretResource.listSecretsThatUserCanGrantAccessTo({
          client: this._client,
          throwOnError: true,
        });
      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        "Failed to list secrets that user can grant access to"
      );
    }
  }

  /**
   * Check if a secret exists
   * @param key - The secret key
   * @returns Whether the secret exists
   */
  public async secretExists(key: string): Promise<boolean> {
    try {
      const { data } = await SecretResource.secretExists({
        path: { key },
        client: this._client,
        throwOnError: true,
      });
      // The API returns an object; a successful response means the secret exists
      return data !== undefined && data !== null;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to check if secret '${key}' exists`);
    }
  }

  /**
   * Set tags for a secret
   * @param tags - The tags to set
   * @param key - The secret key
   */
  public async setSecretTags(tags: Tag[], key: string): Promise<void> {
    try {
      await SecretResource.putTagForSecret({
        path: { key },
        body: tags,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to set tags for secret '${key}'`);
    }
  }

  /**
   * Get tags for a secret
   * @param key - The secret key
   * @returns Array of tags
   */
  public async getSecretTags(key: string): Promise<Tag[]> {
    try {
      const { data } = await SecretResource.getTags({
        path: { key },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get tags for secret '${key}'`);
    }
  }

  /**
   * Delete tags from a secret
   * @param tags - The tags to delete
   * @param key - The secret key
   */
  public async deleteSecretTags(tags: Tag[], key: string): Promise<void> {
    try {
      await SecretResource.deleteTagForSecret({
        path: { key },
        body: tags,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to delete tags from secret '${key}'`);
    }
  }
}
