// export type FetchFn<
//   T = RequestInit,
//   R extends { json: () => Promise<unknown> } = Response
// > = (input: RequestInfo, init?: T) => Promise<R>;

// todo: decide if to keep
export type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface OrkesApiConfig {
  serverUrl?: string;
  keyId?: string;
  keySecret?: string;
  refreshTokenInterval?: number;
  useEnvVars?: boolean; // DEPRECATED, has no effect
  maxHttp2Connections?: number; // max number of simultaneous http connections to the conductor server, defaults to 1 (since we use http2)
}
