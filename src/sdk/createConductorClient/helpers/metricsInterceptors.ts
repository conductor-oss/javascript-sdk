import type { ResolvedRequestOptions } from "../../../open-api/generated/client/types.gen";

/**
 * Strips the /api prefix that the OpenAPI spec bakes into every path.
 * Other SDKs (Go, Java, Python, Rust, Ruby, C#) keep /api in the base URL
 * and use clean paths like /workflow/{workflowId}. The JS SDK's generated
 * code does it backwards: the base URL has /api stripped and every path
 * template starts with /api/. This normalises back to the cross-SDK
 * convention.
 */
const stripApiPrefix = (url: string): string =>
  url.startsWith("/api/") ? url.slice(4) : url;

/**
 * Maps each Request to its OpenAPI path template. The request interceptor
 * stashes the template here so the fetch wrapper (which only receives the
 * Request object) can pass bounded-cardinality URI labels to the metrics
 * observer for both success and error paths.
 *
 * Entries are garbage-collected with the Request.
 */
export const requestTemplateMap = new WeakMap<Request, string>();

/**
 * Creates a request interceptor that captures the OpenAPI path template
 * for each request. The template is stored in {@link requestTemplateMap}
 * and read by `wrapFetchWithRetry` when recording HTTP metrics.
 *
 * Timing and metric recording are handled entirely in the fetch wrapper;
 * the interceptor's only job is to bridge the path template from `opts`
 * (available to interceptors) to the fetch layer (which only sees the
 * Request object).
 */
export function createMetricsInterceptors() {
  const onRequest = (
    request: Request,
    opts: ResolvedRequestOptions,
  ): Request => {
    if (typeof opts.url === "string") {
      requestTemplateMap.set(request, stripApiPrefix(opts.url));
    }
    return request;
  };

  return { onRequest };
}
