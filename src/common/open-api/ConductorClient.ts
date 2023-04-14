/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BaseHttpRequest } from "./core/BaseHttpRequest";
import type { OpenAPIConfig, Resolver } from "./core/OpenAPI";

import { EventResourceService } from "./services/EventResourceService";
import { HealthCheckResourceService } from "./services/HealthCheckResourceService";
import { MetadataResourceService } from "./services/MetadataResourceService";
import { SchedulerResourceService } from "./services/SchedulerResourceService";
import { TaskResourceService } from "./services/TaskResourceService";
import { TokenResourceService } from "./services/TokenResourceService";
import { WorkflowBulkResourceService } from "./services/WorkflowBulkResourceService";
import { WorkflowResourceService } from "./services/WorkflowResourceService";
import { request as baseRequest } from "./core/request";
import { ConductorHttpRequest } from "../RequestCustomizer";

type HttpRequestConstructor = new (config: OpenAPIConfig) => BaseHttpRequest;

export const defaultRequestHandler: ConductorHttpRequest = (
  request,
  config,
  options
) => request(config, options);

export interface ConductorClientAPIConfig extends Omit<OpenAPIConfig, "BASE"> {
  serverUrl: string;
}

export class ConductorClient {
  public readonly eventResource: EventResourceService;
  public readonly healthCheckResource: HealthCheckResourceService;
  public readonly metadataResource: MetadataResourceService;
  public readonly schedulerResource: SchedulerResourceService;
  public readonly taskResource: TaskResourceService;
  public readonly tokenResource: TokenResourceService;
  public readonly workflowBulkResource: WorkflowBulkResourceService;
  public readonly workflowResource: WorkflowResourceService;

  public readonly request: BaseHttpRequest;

  public readonly token?: string | Resolver<string>;

  constructor(
    config?: Partial<ConductorClientAPIConfig>,
    requestHandler: ConductorHttpRequest = defaultRequestHandler
  ) {
    const resolvedConfig = {
      BASE: config?.serverUrl ?? "http://localhost:8080",
      VERSION: config?.VERSION ?? "0",
      WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
      CREDENTIALS: config?.CREDENTIALS ?? "include",
      TOKEN: config?.TOKEN,
      USERNAME: config?.USERNAME,
      PASSWORD: config?.PASSWORD,
      HEADERS: config?.HEADERS,
      ENCODE_PATH: config?.ENCODE_PATH,
    };

    // START conductor-client-modification
    /* The generated models are all based on the concept of an instantiated base http
    class. To avoid making edits there, we just create an object that satisfies the same
    interface. Yay typescript!
     */
    this.request = {
      config: resolvedConfig,
      request: (apiConfig) => {
        return requestHandler(baseRequest, resolvedConfig, apiConfig);
      },
    };
    // END conductor-client-modification
    this.token = config?.TOKEN;

    this.eventResource = new EventResourceService(this.request);
    this.healthCheckResource = new HealthCheckResourceService(this.request);
    this.metadataResource = new MetadataResourceService(this.request);
    this.schedulerResource = new SchedulerResourceService(this.request);
    this.taskResource = new TaskResourceService(this.request);
    this.tokenResource = new TokenResourceService(this.request);
    this.workflowBulkResource = new WorkflowBulkResourceService(this.request);
    this.workflowResource = new WorkflowResourceService(this.request);
  }
}
