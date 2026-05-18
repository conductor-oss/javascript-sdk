import { expect, describe, it } from "@jest/globals";
import {
  createMetricsInterceptors,
  requestTemplateMap,
} from "../metricsInterceptors";
import type { ResolvedRequestOptions } from "@/open-api/generated/client/types.gen";

const fakeOpts = (url: string): ResolvedRequestOptions =>
  ({ url } as unknown as ResolvedRequestOptions);

describe("metricsInterceptors", () => {
  it("should stash stripped template in requestTemplateMap", () => {
    const { onRequest } = createMetricsInterceptors();

    const request = new Request("http://conductor.example.com/api/workflow/abc-123", {
      method: "GET",
    });
    const opts = fakeOpts("/api/workflow/{workflowId}");

    onRequest(request, opts);

    expect(requestTemplateMap.get(request)).toBe("/workflow/{workflowId}");
  });

  it("should strip /api prefix from path template", () => {
    const { onRequest } = createMetricsInterceptors();

    const request = new Request("http://host/api/tasks/poll/myTask", {
      method: "POST",
    });
    const opts = fakeOpts("/api/tasks/poll/{taskType}");

    onRequest(request, opts);

    expect(requestTemplateMap.get(request)).toBe("/tasks/poll/{taskType}");
  });

  it("should not strip prefix if path does not start with /api/", () => {
    const { onRequest } = createMetricsInterceptors();

    const request = new Request("http://host/health", { method: "GET" });
    const opts = fakeOpts("/health");

    onRequest(request, opts);

    expect(requestTemplateMap.get(request)).toBe("/health");
  });

  it("should return the request unchanged", () => {
    const { onRequest } = createMetricsInterceptors();

    const request = new Request("http://host/api/workflow", { method: "GET" });
    const opts = fakeOpts("/api/workflow");

    const returned = onRequest(request, opts);
    expect(returned).toBe(request);
  });

  it("should not stash when opts.url is not a string", () => {
    const { onRequest } = createMetricsInterceptors();

    const request = new Request("http://host/api/workflow", { method: "GET" });
    const opts = {} as unknown as ResolvedRequestOptions;

    onRequest(request, opts);

    expect(requestTemplateMap.has(request)).toBe(false);
  });
});
