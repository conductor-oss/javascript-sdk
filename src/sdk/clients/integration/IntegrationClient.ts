import type {
  Client,
  Tag,
  ExtendedIntegrationApiUpdate,
} from "../../../open-api";
import type {
  Integration,
  IntegrationApi,
  IntegrationDef,
  IntegrationUpdate,
  MessageTemplate,
} from "../../../open-api/generated";
import { IntegrationResource } from "../../../open-api/generated";
import { handleSdkError } from "../../helpers/errors";

export class IntegrationClient {
  public readonly _client: Client;

  constructor(client: Client) {
    this._client = client;
  }

  // ==================== Integration Provider Management ====================

  /**
   * Save (create or update) an integration provider
   * @param name - The provider name
   * @param integration - The integration configuration
   */
  public async saveIntegrationProvider(
    name: string,
    integration: IntegrationUpdate
  ): Promise<void> {
    try {
      await IntegrationResource.saveIntegrationProvider({
        path: { name },
        body: integration,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to save integration provider '${name}'`
      );
    }
  }

  /**
   * Get an integration provider by name
   * @param name - The provider name
   * @returns The integration provider
   */
  public async getIntegrationProvider(
    name: string
  ): Promise<Integration> {
    try {
      const { data } = await IntegrationResource.getIntegrationProvider({
        path: { name },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to get integration provider '${name}'`
      );
    }
  }

  /**
   * Get all integration providers
   * @returns Array of integrations representing providers
   */
  public async getIntegrationProviders(): Promise<Integration[]> {
    try {
      const { data } = await IntegrationResource.getIntegrationProviders({
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, "Failed to get integration providers");
    }
  }

  /**
   * Delete an integration provider
   * @param name - The provider name
   */
  public async deleteIntegrationProvider(name: string): Promise<void> {
    try {
      await IntegrationResource.deleteIntegrationProvider({
        path: { name },
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to delete integration provider '${name}'`
      );
    }
  }

  // ==================== Integration API Management ====================

  /**
   * Save (create or update) an integration API
   * @param providerName - The provider name
   * @param integrationName - The integration name
   * @param api - The integration API configuration
   */
  public async saveIntegrationApi(
    providerName: string,
    integrationName: string,
    api: ExtendedIntegrationApiUpdate
  ): Promise<void> {
    try {
      await IntegrationResource.saveIntegrationApi({
        path: { name: providerName, integration_name: integrationName },
        body: api,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to save integration API '${integrationName}' for provider '${providerName}'`
      );
    }
  }

  /**
   * Get an integration API
   * @param providerName - The provider name
   * @param integrationName - The integration name
   * @returns The integration API
   */
  public async getIntegrationApi(
    providerName: string,
    integrationName: string
  ): Promise<IntegrationApi> {
    try {
      const { data } = await IntegrationResource.getIntegrationApi({
        path: { name: providerName, integration_name: integrationName },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to get integration API '${integrationName}' for provider '${providerName}'`
      );
    }
  }

  /**
   * Get all integration APIs for a provider
   * @param providerName - The provider name
   * @returns Array of integration APIs
   */
  public async getIntegrationApis(
    providerName: string
  ): Promise<IntegrationApi[]> {
    try {
      const { data } = await IntegrationResource.getIntegrationApis({
        path: { name: providerName },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to get integration APIs for provider '${providerName}'`
      );
    }
  }

  /**
   * Delete an integration API
   * @param providerName - The provider name
   * @param integrationName - The integration name
   */
  public async deleteIntegrationApi(
    providerName: string,
    integrationName: string
  ): Promise<void> {
    try {
      await IntegrationResource.deleteIntegrationApi({
        path: { name: providerName, integration_name: integrationName },
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to delete integration API '${integrationName}' for provider '${providerName}'`
      );
    }
  }

  // ==================== Integration Queries ====================

  /**
   * Get all integrations
   * @param category - Optional category filter
   * @param activeOnly - Whether to return only active integrations
   * @returns Array of integrations
   */
  public async getIntegrations(
    category?: string,
    activeOnly?: boolean
  ): Promise<Integration[]> {
    try {
      const { data } = await IntegrationResource.getAllIntegrations({
        query: { category, activeOnly },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, "Failed to get integrations");
    }
  }

  /**
   * Get integration provider definitions
   * @returns Array of integration definitions
   */
  public async getIntegrationProviderDefs(): Promise<IntegrationDef[]> {
    try {
      const { data } = await IntegrationResource.getIntegrationProviderDefs({
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, "Failed to get integration provider definitions");
    }
  }

  /**
   * Get providers and integrations
   * @param type - Optional type filter
   * @param activeOnly - Whether to return only active
   * @returns Array of provider and integration info
   */
  public async getProvidersAndIntegrations(
    type?: string,
    activeOnly?: boolean
  ): Promise<string[]> {
    try {
      const { data } = await IntegrationResource.getProvidersAndIntegrations({
        query: { type, activeOnly },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, "Failed to get providers and integrations");
    }
  }

  /**
   * Get available APIs for a provider
   * @param providerName - The provider name
   * @returns Array of available APIs
   */
  public async getIntegrationAvailableApis(
    providerName: string
  ): Promise<string[]> {
    try {
      const { data } = await IntegrationResource.getIntegrationAvailableApis({
        path: { name: providerName },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to get available APIs for provider '${providerName}'`
      );
    }
  }

  // ==================== Prompt Association ====================

  /**
   * Associate a prompt with an integration
   * @param providerName - The integration provider name
   * @param integrationName - The integration name
   * @param promptName - The prompt template name
   */
  public async associatePromptWithIntegration(
    providerName: string,
    integrationName: string,
    promptName: string
  ): Promise<void> {
    try {
      await IntegrationResource.associatePromptWithIntegration({
        path: {
          integration_provider: providerName,
          integration_name: integrationName,
          prompt_name: promptName,
        },
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to associate prompt '${promptName}' with integration '${integrationName}'`
      );
    }
  }

  /**
   * Get prompts associated with an integration
   * @param providerName - The integration provider name
   * @param integrationName - The integration name
   * @returns Array of associated prompt templates
   */
  public async getPromptsWithIntegration(
    providerName: string,
    integrationName: string
  ): Promise<MessageTemplate[]> {
    try {
      const { data } = await IntegrationResource.getPromptsWithIntegration({
        path: {
          integration_provider: providerName,
          integration_name: integrationName,
        },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to get prompts for integration '${integrationName}'`
      );
    }
  }

  // ==================== Integration Tags ====================

  /**
   * Set tags for an integration
   * @param providerName - The provider name
   * @param integrationName - The integration name
   * @param tags - The tags to set
   */
  public async setIntegrationTags(
    providerName: string,
    integrationName: string,
    tags: Tag[]
  ): Promise<void> {
    try {
      await IntegrationResource.putTagForIntegration({
        path: { name: providerName, integration_name: integrationName },
        body: tags,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to set tags for integration '${integrationName}'`
      );
    }
  }

  /**
   * Get tags for an integration
   * @param providerName - The provider name
   * @param integrationName - The integration name
   * @returns Array of tags
   */
  public async getIntegrationTags(
    providerName: string,
    integrationName: string
  ): Promise<Tag[]> {
    try {
      const { data } = await IntegrationResource.getTagsForIntegration({
        path: { name: providerName, integration_name: integrationName },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to get tags for integration '${integrationName}'`
      );
    }
  }

  /**
   * Delete tags from an integration
   * @param providerName - The provider name
   * @param integrationName - The integration name
   * @param tags - The tags to delete
   */
  public async deleteIntegrationTags(
    providerName: string,
    integrationName: string,
    tags: Tag[]
  ): Promise<void> {
    try {
      await IntegrationResource.deleteTagForIntegration({
        path: { name: providerName, integration_name: integrationName },
        body: tags,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to delete tags from integration '${integrationName}'`
      );
    }
  }

  // ==================== Provider Tags ====================

  /**
   * Set tags for an integration provider
   * @param providerName - The provider name
   * @param tags - The tags to set
   */
  public async setProviderTags(
    providerName: string,
    tags: Tag[]
  ): Promise<void> {
    try {
      await IntegrationResource.putTagForIntegrationProvider({
        path: { name: providerName },
        body: tags,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to set tags for provider '${providerName}'`
      );
    }
  }

  /**
   * Get tags for an integration provider
   * @param providerName - The provider name
   * @returns Array of tags
   */
  public async getProviderTags(providerName: string): Promise<Tag[]> {
    try {
      const { data } =
        await IntegrationResource.getTagsForIntegrationProvider({
          path: { name: providerName },
          client: this._client,
          throwOnError: true,
        });
      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to get tags for provider '${providerName}'`
      );
    }
  }

  /**
   * Delete tags from an integration provider
   * @param providerName - The provider name
   * @param tags - The tags to delete
   */
  public async deleteProviderTags(
    providerName: string,
    tags: Tag[]
  ): Promise<void> {
    try {
      await IntegrationResource.deleteTagForIntegrationProvider({
        path: { name: providerName },
        body: tags,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to delete tags from provider '${providerName}'`
      );
    }
  }
}
