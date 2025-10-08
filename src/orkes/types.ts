import type { OpenAPIConfig } from "../common";

export type FetchFn<
  T = RequestInit,
  R extends { json: () => Promise<unknown> } = Response
> = (input: RequestInfo, init?: T) => Promise<R>;

export interface OrkesApiConfig extends Partial<OpenAPIConfig> {
  serverUrl: string;
  keyId?: string;
  keySecret?: string;
  refreshTokenInterval?: number;
  useEnvVars?: boolean; // DEPRECATED, has no effect
  maxHttp2Connections?: number; // max number of simultaneous http connections to the conductor server, defaults to 1 (since we use http2)
}
