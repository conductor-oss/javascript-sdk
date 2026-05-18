import { jest, expect, describe, it, beforeEach, afterEach } from "@jest/globals";
import { createMetricsInterceptors } from "../metricsInterceptors";
import * as httpObserver from "@/sdk/worker/metrics/httpObserver";
import type { ResolvedRequestOptions } from "@/open-api/generated/client/types.gen";

const mockRecordApiRequestTime = jest.fn<
  (m: string, u: string, s: string | number, d: number, mu?: string) => void
>();

const fakeOpts = (url: string): ResolvedRequestOptions =>
  ({ url } as unknown as ResolvedRequestOptions);

describe("metricsInterceptors", () => {
  beforeEach(() => {
    mockRecordApiRequestTime.mockClear();
    httpObserver.setHttpMetricsObserver({
      recordApiRequestTime: mockRecordApiRequestTime,
      recordWorkflowInputSize: jest.fn(),
      recordWorkflowStartError: jest.fn(),
    });
  });

  afterEach(() => {
    httpObserver.setHttpMetricsObserver(undefined);
  });

  it("should record method, interpolated uri, status, duration, and template metricUri", () => {
    const { onRequest, onResponse } = createMetricsInterceptors();

    const request = new Request("http://conductor.example.com/api/workflow/abc-123", {
      method: "GET",
    });
    const opts = fakeOpts("/api/workflow/{workflowId}");

    onRequest(request, opts);
    const response = new Response(null, { status: 200 });
    onResponse(response, request, opts);

    expect(mockRecordApiRequestTime).toHaveBeenCalledTimes(1);
    const [method, uri, status, duration, metricUri] =
      mockRecordApiRequestTime.mock.calls[0];
    expect(method).toBe("GET");
    expect(uri).toBe("/api/workflow/abc-123");
    expect(status).toBe("200");
    expect(duration).toBeGreaterThanOrEqual(0);
    expect(metricUri).toBe("/workflow/{workflowId}");
  });

  it("should strip /api prefix from path template", () => {
    const { onRequest, onResponse } = createMetricsInterceptors();

    const request = new Request("http://host/api/tasks/poll/myTask", {
      method: "POST",
    });
    const opts = fakeOpts("/api/tasks/poll/{taskType}");

    onRequest(request, opts);
    onResponse(new Response(null, { status: 200 }), request, opts);

    const metricUri = mockRecordApiRequestTime.mock.calls[0][4];
    expect(metricUri).toBe("/tasks/poll/{taskType}");
  });

  it("should not strip prefix if path does not start with /api/", () => {
    const { onRequest, onResponse } = createMetricsInterceptors();

    const request = new Request("http://host/health", { method: "GET" });
    const opts = fakeOpts("/health");

    onRequest(request, opts);
    onResponse(new Response(null, { status: 200 }), request, opts);

    const metricUri = mockRecordApiRequestTime.mock.calls[0][4];
    expect(metricUri).toBe("/health");
  });

  it("should compute duration from request interceptor start time", () => {
    const { onRequest, onResponse } = createMetricsInterceptors();

    const request = new Request("http://host/api/workflow", { method: "GET" });
    const opts = fakeOpts("/api/workflow");

    onRequest(request, opts);
    // Simulate a small delay so duration > 0
    const busyWaitUntil = performance.now() + 2;
    while (performance.now() < busyWaitUntil) { /* spin */ }
    onResponse(new Response(null, { status: 200 }), request, opts);

    const duration = mockRecordApiRequestTime.mock.calls[0][3] as number;
    expect(duration).toBeGreaterThan(0);
  });

  it("should gracefully handle missing start time (duration defaults to 0)", () => {
    const { onResponse } = createMetricsInterceptors();

    const request = new Request("http://host/api/workflow", { method: "GET" });
    const opts = fakeOpts("/api/workflow");

    onResponse(new Response(null, { status: 200 }), request, opts);

    const duration = mockRecordApiRequestTime.mock.calls[0][3] as number;
    expect(duration).toBe(0);
  });

  it("should do nothing when no observer is registered", () => {
    httpObserver.setHttpMetricsObserver(undefined);

    const { onRequest, onResponse } = createMetricsInterceptors();

    const request = new Request("http://host/api/workflow", { method: "GET" });
    const opts = fakeOpts("/api/workflow");

    onRequest(request, opts);
    const response = new Response(null, { status: 200 });
    const result = onResponse(response, request, opts);

    expect(result).toBe(response);
    expect(mockRecordApiRequestTime).not.toHaveBeenCalled();
  });

  it("should return request and response unchanged", () => {
    const { onRequest, onResponse } = createMetricsInterceptors();

    const request = new Request("http://host/api/workflow", { method: "GET" });
    const opts = fakeOpts("/api/workflow");

    const returnedRequest = onRequest(request, opts);
    expect(returnedRequest).toBe(request);

    const response = new Response("body", { status: 201 });
    const returnedResponse = onResponse(response, request, opts);
    expect(returnedResponse).toBe(response);
  });

  it("should record correct status for error responses", () => {
    const { onRequest, onResponse } = createMetricsInterceptors();

    const request = new Request("http://host/api/workflow", { method: "POST" });
    const opts = fakeOpts("/api/workflow");

    onRequest(request, opts);
    onResponse(new Response(null, { status: 500 }), request, opts);

    const status = mockRecordApiRequestTime.mock.calls[0][2];
    expect(status).toBe("500");
  });
});
