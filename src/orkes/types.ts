import type {
  GenerateTokenRequest,
  OpenAPIConfig,
} from "../common";

export type FetchFn<
  T = RequestInit,
  R extends { json: () => Promise<any> } = Response
> = (input: RequestInfo, init?: T) => Promise<R>;

export interface OrkesConductorClientAPIConfig extends OpenAPIConfig {
  useEnvVars: boolean;
  serverUrl: string;
}

export type OrkesApiConfig = OrkesConductorClientAPIConfig & GenerateTokenRequest;
