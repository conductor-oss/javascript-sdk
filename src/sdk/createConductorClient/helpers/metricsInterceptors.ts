import type { ResolvedRequestOptions } from "../../../open-api/generated/client/types.gen";
import { getHttpMetricsObserver } from "../../worker/metrics/httpObserver";

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

type OptsWithMetrics = ResolvedRequestOptions & { _metricsStart?: number };

/**
 * Creates a matched pair of request/response interceptors that record
 * http_api_client_request_seconds via the global HttpMetricsObserver.
 *
 * Both interceptors receive the same `opts` object for a given request
 * (see client.gen.ts lines 89-102), so start time is stashed directly
 * on opts — no WeakMap or side-channel needed.
 *
 * The response interceptor passes both the interpolated URI (for legacy
 * metrics) and the bounded-cardinality path template (for canonical
 * metrics) to the observer, letting each collector choose which to use.
 */
export function createMetricsInterceptors() {
  const onRequest = (
    request: Request,
    opts: ResolvedRequestOptions,
  ): Request => {
    (opts as OptsWithMetrics)._metricsStart = performance.now();
    return request;
  };

  const onResponse = (
    response: Response,
    request: Request,
    opts: ResolvedRequestOptions,
  ): Response => {
    const observer = getHttpMetricsObserver();
    if (!observer) return response;

    const start = (opts as OptsWithMetrics)._metricsStart;
    const durationMs = start != null ? performance.now() - start : 0;

    const method = request.method;
    const status = String(response.status);

    let uri = "";
    try {
      uri = new URL(request.url).pathname;
    } catch {
      uri = String(request.url);
    }

    const template = typeof opts.url === "string" ? stripApiPrefix(opts.url) : uri;

    observer.recordApiRequestTime(method, uri, status, durationMs, template);

    return response;
  };

  return { onRequest, onResponse };
}
