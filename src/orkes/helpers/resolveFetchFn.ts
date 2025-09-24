import { FetchFn } from "../types";
// eslint-disable-next-line
// @ts-ignore since undici is an optional dependency and could me missing
import type { RequestInfo, RequestInit } from "undici";

export const resolveFetchFn = async (
  customFetch?: FetchFn
): Promise<FetchFn> => {
  if (customFetch) return customFetch;
  if (process?.release?.name !== "node") return fetch;

  try {
    // eslint-disable-next-line
    // @ts-ignore since undici is an optional dependency and could me missing
    const { fetch: undiciFetch, Agent, interceptors } = await import("undici");
    const undiciAgent = new Agent({
      allowH2: true,
      // connections: 1,
      // keepAliveTimeout: 500,
      clientTtl: 500,
      // keepAliveMaxTimeout: 1000 * 60 * 10,
    }).compose(
      interceptors.retry({
        maxRetries: 10, // Maximum number of retries (default: 5)
        minTimeout: 2000, // Minimum time to wait before retrying (default: 500ms)
        maxTimeout: 60000, // Maximum time to wait before retrying (default: 30000ms)
        timeoutFactor: 2, // Factor to multiply the timeout by for each retry (default: 2)
        //retryAfter: true, // Automatically retry if Retry-After header is present (default: true)
        methods: ["GET", "PUT", "HEAD", "POST", "DELETE", "PATCH", "OPTIONS"], // HTTP methods to retry (default includes GET, PUT, HEAD, OPTIONS, DELETE)
        //statusCodes: [429, 500, 502], // HTTP status codes to retry (default includes 429, 500, 502, 503, 504)
        errorCodes: ["ECONNRESET", "read ECONNRESET"], // Error codes to retry (default includes common network errors)
      })
    );

    return ((input: RequestInfo, init?: RequestInit) =>
      undiciFetch(input, { ...init, dispatcher: undiciAgent })) as FetchFn;
  } catch {
    return fetch;
  }
};
