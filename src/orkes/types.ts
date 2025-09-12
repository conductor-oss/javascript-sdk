import type { BaseHttpRequest, GenerateTokenRequest, OpenAPIConfig } from "../common";

export type FetchFn<
  T = RequestInit,
  R extends { json: () => Promise<any> } = Response
> = (input: RequestInfo, init?: T) => Promise<R>;

export interface OrkesApiConfig extends GenerateTokenRequest, OpenAPIConfig {
  serverUrl: string;
}

export type HttpRequestConstructor = new (
  config: OpenAPIConfig
) => BaseHttpRequest;
