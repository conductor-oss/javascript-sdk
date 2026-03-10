import type { Client } from "../open-api";
import type { OrkesApiConfig } from "./types";
import { createConductorClient } from "./createConductorClient";
import { ApplicationClient } from "./clients/application";
import { AuthorizationClient } from "./clients/authorization";
import { EventClient } from "./clients/event";
import { HumanExecutor } from "./clients/human";
import { IntegrationClient } from "./clients/integration";
import { MetadataClient } from "./clients/metadata";
import { PromptClient } from "./clients/prompt";
import { SchedulerClient } from "./clients/scheduler";
import { SchemaClient } from "./clients/schema";
import { SecretClient } from "./clients/secret";
import { ServiceRegistryClient } from "./clients/service-registry";
import { TaskClient } from "./clients/task";
import { TemplateClient } from "./clients/template";
import { WorkflowExecutor } from "./clients/workflow";

/**
 * Factory class that provides access to all Conductor client instances.
 * Equivalent to Python SDK's `OrkesClients`.
 *
 * Usage:
 * ```typescript
 * const clients = await OrkesClients.from({ serverUrl, keyId, keySecret });
 * const workflowClient = clients.getWorkflowClient();
 * const metadataClient = clients.getMetadataClient();
 * ```
 */
export class OrkesClients {
  private readonly _client: Client;

  constructor(client: Client) {
    this._client = client;
  }

  /**
   * Creates an OrkesClients instance from configuration.
   * Handles authentication and connection setup.
   */
  static async from(config?: OrkesApiConfig): Promise<OrkesClients> {
    const client = await createConductorClient(config);
    return new OrkesClients(client);
  }

  /** Returns the underlying HTTP client */
  getClient(): Client {
    return this._client;
  }

  getWorkflowClient(): WorkflowExecutor {
    return new WorkflowExecutor(this._client);
  }

  getMetadataClient(): MetadataClient {
    return new MetadataClient(this._client);
  }

  getTaskClient(): TaskClient {
    return new TaskClient(this._client);
  }

  getSchedulerClient(): SchedulerClient {
    return new SchedulerClient(this._client);
  }

  getSecretClient(): SecretClient {
    return new SecretClient(this._client);
  }

  getSchemaClient(): SchemaClient {
    return new SchemaClient(this._client);
  }

  getAuthorizationClient(): AuthorizationClient {
    return new AuthorizationClient(this._client);
  }

  getIntegrationClient(): IntegrationClient {
    return new IntegrationClient(this._client);
  }

  getPromptClient(): PromptClient {
    return new PromptClient(this._client);
  }

  getApplicationClient(): ApplicationClient {
    return new ApplicationClient(this._client);
  }

  getEventClient(): EventClient {
    return new EventClient(this._client);
  }

  getHumanClient(): HumanExecutor {
    return new HumanExecutor(this._client);
  }

  getTemplateClient(): TemplateClient {
    return new TemplateClient(this._client);
  }

  getServiceRegistryClient(): ServiceRegistryClient {
    return new ServiceRegistryClient(this._client);
  }
}
