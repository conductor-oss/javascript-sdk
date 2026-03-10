import type { Client } from "../../../open-api";
import type { SchemaDef } from "../../../open-api/generated";
import { SchemaResource } from "../../../open-api/generated";
import { handleSdkError } from "../../helpers/errors";

export class SchemaClient {
  public readonly _client: Client;

  constructor(client: Client) {
    this._client = client;
  }

  /**
   * Register (create or update) schemas
   * @param schemas - Array of schema definitions to register
   * @param newVersion - Whether to create a new version
   */
  public async registerSchema(
    schemas: SchemaDef[],
    newVersion = false
  ): Promise<void> {
    try {
      await SchemaResource.save({
        body: schemas,
        query: { newVersion },
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, "Failed to register schema");
    }
  }

  /**
   * Get a schema by name and version
   * @param name - The schema name
   * @param version - The schema version
   * @returns The schema definition
   */
  public async getSchema(name: string, version: number): Promise<SchemaDef> {
    try {
      const { data } = await SchemaResource.getSchemaByNameAndVersion({
        path: { name, version },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to get schema '${name}' version ${version}`
      );
    }
  }

  /**
   * Get the latest version of a schema by name
   * @param name - The schema name
   * @returns The schema definition
   */
  public async getSchemaByName(name: string): Promise<SchemaDef> {
    try {
      const { data } =
        await SchemaResource.getSchemaByNameWithLatestVersion({
          path: { name },
          client: this._client,
          throwOnError: true,
        });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get schema '${name}'`);
    }
  }

  /**
   * Get all schemas
   * @returns Array of all schema definitions
   */
  public async getAllSchemas(): Promise<SchemaDef[]> {
    try {
      const { data } = await SchemaResource.getAllSchemas({
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, "Failed to get all schemas");
    }
  }

  /**
   * Delete a specific version of a schema
   * @param name - The schema name
   * @param version - The schema version
   */
  public async deleteSchema(name: string, version: number): Promise<void> {
    try {
      await SchemaResource.deleteSchemaByNameAndVersion({
        path: { name, version },
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to delete schema '${name}' version ${version}`
      );
    }
  }

  /**
   * Delete all versions of a schema by name
   * @param name - The schema name
   */
  public async deleteSchemaByName(name: string): Promise<void> {
    try {
      await SchemaResource.deleteSchemaByName({
        path: { name },
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to delete schema '${name}'`);
    }
  }
}
