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
import { HumanTaskService } from "./services/HumanTaskService";
import { HumanTaskResourceService } from "./services/HumanTaskResourceService";
import { ServiceRegistryResourceService } from "./services/ServiceRegistryResourceService";

import { NodeHttpRequest } from "./core/NodeHttpRequest";

type HttpRequestConstructor = new (config: OpenAPIConfig) => BaseHttpRequest;

export interface ConductorClientAPIConfig extends OpenAPIConfig {
  useEnvVars: boolean;
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
  public readonly serviceRegistryResource: ServiceRegistryResourceService;

  public readonly humanTask: HumanTaskService;
  public readonly humanTaskResource: HumanTaskResourceService;
  public readonly request: BaseHttpRequest;

  public token?: string | Resolver<string>;

  constructor(
    config?: Partial<OpenAPIConfig>,
    HttpRequest: HttpRequestConstructor = NodeHttpRequest
  ) {
    this.request = new HttpRequest({
      BASE: config?.BASE ?? "http://localhost:8080",
      VERSION: config?.VERSION ?? "2",
      WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
      CREDENTIALS: config?.CREDENTIALS ?? "include",
      TOKEN: config?.TOKEN,
      USERNAME: config?.USERNAME,
      PASSWORD: config?.PASSWORD,
      HEADERS: config?.HEADERS,
      ENCODE_PATH: config?.ENCODE_PATH,
    });

    // START conductor-client-modification
    /*

     constructor(config?: Partial<ConductorClientAPIConfig>, requestHandler: ConductorHttpRequest = defaultRequestHandler) {

    */
    // const resolvedConfig = {
    //   BASE: config?.BASE ?? "",
    //   VERSION: config?.VERSION ?? "0",
    //   WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
    //   CREDENTIALS: config?.CREDENTIALS ?? "include",
    //   TOKEN: config?.TOKEN,
    //   USERNAME: config?.USERNAME,
    //   PASSWORD: config?.PASSWORD,
    //   HEADERS: config?.HEADERS,
    //   ENCODE_PATH: config?.ENCODE_PATH,
    // };

    // this.request = {
    //   config: resolvedConfig,
    //   request: (apiConfig) => {
    //     return requestHandler(
    //       baseRequest,
    //       { ...resolvedConfig, TOKEN: this.token },
    //       apiConfig
    //     );
    //   },
    // };
    this.token = config?.TOKEN;
    // END conductor-client-modification

    this.eventResource = new EventResourceService(this.request);
    this.healthCheckResource = new HealthCheckResourceService(this.request);
    this.metadataResource = new MetadataResourceService(this.request);
    this.schedulerResource = new SchedulerResourceService(this.request);
    this.taskResource = new TaskResourceService(this.request);
    this.tokenResource = new TokenResourceService(this.request);
    this.workflowBulkResource = new WorkflowBulkResourceService(this.request);
    this.workflowResource = new WorkflowResourceService(this.request);
    this.serviceRegistryResource = new ServiceRegistryResourceService(this.request);
    this.humanTask = new HumanTaskService(this.request);
    this.humanTaskResource = new HumanTaskResourceService(this.request);
  }
  stop() {}
}
