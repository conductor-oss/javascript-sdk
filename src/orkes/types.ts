import type { GenerateTokenRequest, OpenAPIConfig } from "../common";

export type FetchFn<
  T = RequestInit,
  R extends { json: () => Promise<any> } = Response
> = (input: RequestInfo, init?: T) => Promise<R>;

export interface OrkesApiConfig extends GenerateTokenRequest, OpenAPIConfig {
  serverUrl: string;
  refreshTokenInterval: number;
}
