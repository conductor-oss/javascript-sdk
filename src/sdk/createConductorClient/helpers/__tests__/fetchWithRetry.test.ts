import { jest, expect, describe, it, beforeEach, afterEach } from "@jest/globals";
import { retryFetch, wrapFetchWithRetry, applyTimeout } from "../fetchWithRetry";
import * as httpObserver from "@/sdk/worker/metrics/httpObserver";
import { requestTemplateMap } from "../metricsInterceptors";

const createMockResponse = (status: number, body = ""): Response =>
  new Response(body, { status, statusText: `Status ${status}` });

/** Create a 401/403 response with a token error code in the JSON body */
const createTokenErrorResponse = (
  status: 401 | 403,
  errorCode: "EXPIRED_TOKEN" | "INVALID_TOKEN"
): Response =>
  new Response(
    JSON.stringify({ error: errorCode, message: `Token ${errorCode}` }),
    { status, statusText: `Status ${status}`, headers: { "Content-Type": "application/json" } }
  );

/** Create a 401/403 response for a permission error (no token error code) */
const createPermissionErrorResponse = (status: 401 | 403): Response =>
  new Response(
    JSON.stringify({ error: "ACCESS_DENIED", message: "Insufficient permissions" }),
    { status, statusText: `Status ${status}`, headers: { "Content-Type": "application/json" } }
  );

describe("fetchWithRetry", () => {
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    mockFetch = jest.fn<typeof fetch>();
  });

  // ─── Basic behavior ────────────────────────────────────────────────

  describe("basic behavior", () => {
    it("should return response on successful fetch", async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, "ok"));

      const result = await retryFetch("http://test.com", {}, mockFetch);
      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should pass through non-retryable status codes", async () => {
      mockFetch.mockResolvedValue(createMockResponse(500, "server error"));

      const result = await retryFetch("http://test.com", {}, mockFetch);
      expect(result.status).toBe(500);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should pass init options through to fetch", async () => {
      mockFetch.mockResolvedValue(createMockResponse(200));

      await retryFetch(
        "http://test.com",
        { method: "POST", headers: { "X-Custom": "value" } },
        mockFetch
      );

      const callInit = mockFetch.mock.calls[0][1];
      expect(callInit?.method).toBe("POST");
      expect(new Headers(callInit?.headers).get("X-Custom")).toBe("value");
    });
  });

  // ─── Rate limit (429) retry ────────────────────────────────────────

  describe("rate limit (429) retry", () => {
    it("should retry on 429 with exponential backoff", async () => {
      jest.useFakeTimers();
      mockFetch
        .mockResolvedValueOnce(createMockResponse(429))
        .mockResolvedValueOnce(createMockResponse(200, "ok"));

      const promise = retryFetch("http://test.com", {}, mockFetch);
      // Advance past max jittered delay (1000ms + 10% = 1100ms)
      await jest.advanceTimersByTimeAsync(1200);
      const result = await promise;

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });

    it("should stop after maxRateLimitRetries", async () => {
      jest.useFakeTimers();
      mockFetch.mockResolvedValue(createMockResponse(429));

      const promise = retryFetch("http://test.com", {}, mockFetch, {
        maxRateLimitRetries: 2,
        initialRetryDelay: 100,
      });

      for (let i = 0; i < 5; i++) {
        await jest.advanceTimersByTimeAsync(10_000);
      }

      const result = await promise;
      expect(result.status).toBe(429);
      // 1 initial + 2 retries = 3
      expect(mockFetch).toHaveBeenCalledTimes(3);
      jest.useRealTimers();
    });
  });

  // ─── Transport error retry ─────────────────────────────────────────

  describe("transport error retry", () => {
    it("should retry on network error with linear backoff", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("ECONNRESET"))
        .mockResolvedValueOnce(createMockResponse(200, "ok"));

      const result = await retryFetch("http://test.com", {}, mockFetch, {
        maxTransportRetries: 3,
        initialRetryDelay: 1,
      });

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should retry multiple times before succeeding", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("ECONNRESET"))
        .mockRejectedValueOnce(new Error("ECONNREFUSED"))
        .mockResolvedValueOnce(createMockResponse(200));

      const result = await retryFetch("http://test.com", {}, mockFetch, {
        maxTransportRetries: 3,
        initialRetryDelay: 1,
      });

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should exhaust transport retries and throw", async () => {
      mockFetch.mockRejectedValue(new Error("ECONNRESET"));

      await expect(
        retryFetch("http://test.com", {}, mockFetch, {
          maxTransportRetries: 2,
          initialRetryDelay: 1,
        })
      ).rejects.toThrow("ECONNRESET");
      // 1 initial + 2 retries = 3
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should NOT retry on AbortError (DOMException)", async () => {
      const abortError = new DOMException("The operation was aborted", "AbortError");
      mockFetch.mockRejectedValue(abortError);

      await expect(
        retryFetch("http://test.com", {}, mockFetch, { maxTransportRetries: 3 })
      ).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should NOT retry on TimeoutError", async () => {
      const timeoutError = new Error("Request timed out");
      timeoutError.name = "TimeoutError";
      mockFetch.mockRejectedValue(timeoutError);

      await expect(
        retryFetch("http://test.com", {}, mockFetch, { maxTransportRetries: 3 })
      ).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should NOT retry on Error with name AbortError", async () => {
      const abortError = new Error("signal aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValue(abortError);

      await expect(
        retryFetch("http://test.com", {}, mockFetch, { maxTransportRetries: 3 })
      ).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Server error (502/503/504) retry ───────────────────────────────

  describe("server error (502/503/504) retry", () => {
    it("should NOT retry 502 by default (retryServerErrors unset)", async () => {
      mockFetch.mockResolvedValue(createMockResponse(502, "Bad Gateway"));

      const result = await retryFetch("http://test.com", {}, mockFetch, {
        maxTransportRetries: 3,
        initialRetryDelay: 1,
      });

      expect(result.status).toBe(502);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should retry 502 and succeed on next attempt", async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(502, "Bad Gateway"))
        .mockResolvedValueOnce(createMockResponse(200, "ok"));

      const result = await retryFetch("http://test.com", {}, mockFetch, {
        maxTransportRetries: 3,
        initialRetryDelay: 1,
        retryServerErrors: true,
      });

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should retry 503 and succeed on next attempt", async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(503, "Service Unavailable"))
        .mockResolvedValueOnce(createMockResponse(200, "ok"));

      const result = await retryFetch("http://test.com", {}, mockFetch, {
        maxTransportRetries: 3,
        initialRetryDelay: 1,
        retryServerErrors: true,
      });

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should retry 504 and succeed on next attempt", async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(504, "Gateway Timeout"))
        .mockResolvedValueOnce(createMockResponse(200, "ok"));

      const result = await retryFetch("http://test.com", {}, mockFetch, {
        maxTransportRetries: 3,
        initialRetryDelay: 1,
        retryServerErrors: true,
      });

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should exhaust retries and return last 5xx response", async () => {
      mockFetch.mockResolvedValue(createMockResponse(502, "Bad Gateway"));

      const result = await retryFetch("http://test.com", {}, mockFetch, {
        maxTransportRetries: 2,
        initialRetryDelay: 1,
        retryServerErrors: true,
      });

      expect(result.status).toBe(502);
      // 1 initial + 2 retries = 3
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should NOT retry 502 for POST requests (non-idempotent)", async () => {
      mockFetch.mockResolvedValue(createMockResponse(502, "Bad Gateway"));

      const result = await retryFetch("http://test.com", { method: "POST" }, mockFetch, {
        maxTransportRetries: 3,
        initialRetryDelay: 1,
        retryServerErrors: true,
      });

      expect(result.status).toBe(502);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should NOT retry 503 for PATCH requests (non-idempotent)", async () => {
      mockFetch.mockResolvedValue(createMockResponse(503, "Service Unavailable"));

      const result = await retryFetch("http://test.com", { method: "PATCH" }, mockFetch, {
        maxTransportRetries: 3,
        initialRetryDelay: 1,
        retryServerErrors: true,
      });

      expect(result.status).toBe(503);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should retry 502 for PUT requests (idempotent)", async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(502, "Bad Gateway"))
        .mockResolvedValueOnce(createMockResponse(200, "ok"));

      const result = await retryFetch("http://test.com", { method: "PUT" }, mockFetch, {
        maxTransportRetries: 3,
        initialRetryDelay: 1,
        retryServerErrors: true,
      });

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should handle transport error then 502 then success", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("ECONNRESET"))
        .mockResolvedValueOnce(createMockResponse(502, "Bad Gateway"))
        .mockResolvedValueOnce(createMockResponse(200, "ok"));

      const result = await retryFetch("http://test.com", {}, mockFetch, {
        maxTransportRetries: 3,
        initialRetryDelay: 1,
        retryServerErrors: true,
      });

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  // ─── Auth failure (401/403) retry ──────────────────────────────────

  describe("auth failure (401/403) retry", () => {
    it("should retry 401 EXPIRED_TOKEN with refreshed token", async () => {
      const onAuthFailure = jest.fn<() => Promise<string | undefined>>()
        .mockResolvedValue("new-token");

      mockFetch
        .mockResolvedValueOnce(createTokenErrorResponse(401, "EXPIRED_TOKEN"))
        .mockResolvedValueOnce(createMockResponse(200, "ok"));

      const result = await retryFetch("http://test.com", {}, mockFetch, {
        onAuthFailure,
      });

      expect(result.status).toBe(200);
      expect(onAuthFailure).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Verify the retry request has the new token header
      const retryInit = mockFetch.mock.calls[1][1] as RequestInit;
      expect(new Headers(retryInit?.headers).get("X-Authorization")).toBe("new-token");
    });

    it("should retry 403 INVALID_TOKEN with refreshed token", async () => {
      const onAuthFailure = jest.fn<() => Promise<string | undefined>>()
        .mockResolvedValue("new-token");

      mockFetch
        .mockResolvedValueOnce(createTokenErrorResponse(403, "INVALID_TOKEN"))
        .mockResolvedValueOnce(createMockResponse(200, "ok"));

      const result = await retryFetch("http://test.com", {}, mockFetch, {
        onAuthFailure,
      });

      expect(result.status).toBe(200);
      expect(onAuthFailure).toHaveBeenCalledTimes(1);
    });

    it("should NOT retry 403 permission error (no token refresh)", async () => {
      const onAuthFailure = jest.fn<() => Promise<string | undefined>>()
        .mockResolvedValue("new-token");

      mockFetch.mockResolvedValueOnce(createPermissionErrorResponse(403));

      const result = await retryFetch("http://test.com", {}, mockFetch, {
        onAuthFailure,
      });

      // Should return the 403 immediately without refreshing or retrying
      expect(result.status).toBe(403);
      expect(onAuthFailure).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should NOT retry 401 permission error (non-token error code)", async () => {
      const onAuthFailure = jest.fn<() => Promise<string | undefined>>()
        .mockResolvedValue("new-token");

      mockFetch.mockResolvedValueOnce(createPermissionErrorResponse(401));

      const result = await retryFetch("http://test.com", {}, mockFetch, {
        onAuthFailure,
      });

      // Should return the 401 immediately without refreshing or retrying
      expect(result.status).toBe(401);
      expect(onAuthFailure).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should retry 401 with non-JSON body (fallback: assume token error)", async () => {
      const onAuthFailure = jest.fn<() => Promise<string | undefined>>()
        .mockResolvedValue("new-token");

      // 401 with non-JSON body — isTokenError falls back to true for 401
      mockFetch
        .mockResolvedValueOnce(createMockResponse(401, "Unauthorized"))
        .mockResolvedValueOnce(createMockResponse(200, "ok"));

      const result = await retryFetch("http://test.com", {}, mockFetch, {
        onAuthFailure,
      });

      expect(result.status).toBe(200);
      expect(onAuthFailure).toHaveBeenCalledTimes(1);
    });

    it("should NOT retry 403 with non-JSON body (fallback: assume permission error)", async () => {
      const onAuthFailure = jest.fn<() => Promise<string | undefined>>()
        .mockResolvedValue("new-token");

      // 403 with non-JSON body — isTokenError falls back to false for 403
      mockFetch.mockResolvedValueOnce(createMockResponse(403, "Forbidden"));

      const result = await retryFetch("http://test.com", {}, mockFetch, {
        onAuthFailure,
      });

      expect(result.status).toBe(403);
      expect(onAuthFailure).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should only retry auth failure once (no infinite loop)", async () => {
      const onAuthFailure = jest.fn<() => Promise<string | undefined>>()
        .mockResolvedValue("new-token");

      // Both the original and retry return 401 EXPIRED_TOKEN
      mockFetch.mockResolvedValue(createTokenErrorResponse(401, "EXPIRED_TOKEN"));

      const result = await retryFetch("http://test.com", {}, mockFetch, {
        onAuthFailure,
      });

      // Returns the 401 from the retry attempt (doesn't loop — retry response
      // has the same body but isTokenError is only checked on the first response)
      expect(result.status).toBe(401);
      expect(onAuthFailure).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should not retry auth failure when no onAuthFailure callback", async () => {
      mockFetch.mockResolvedValue(createTokenErrorResponse(401, "EXPIRED_TOKEN"));

      const result = await retryFetch("http://test.com", {}, mockFetch);
      expect(result.status).toBe(401);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should not retry auth failure when onAuthFailure returns undefined", async () => {
      const onAuthFailure = jest.fn<() => Promise<string | undefined>>()
        .mockResolvedValue(undefined);

      mockFetch.mockResolvedValue(createTokenErrorResponse(401, "EXPIRED_TOKEN"));

      const result = await retryFetch("http://test.com", {}, mockFetch, {
        onAuthFailure,
      });

      expect(result.status).toBe(401);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should preserve existing headers when retrying with new token", async () => {
      const onAuthFailure = jest.fn<() => Promise<string | undefined>>()
        .mockResolvedValue("new-token");

      mockFetch
        .mockResolvedValueOnce(createTokenErrorResponse(401, "EXPIRED_TOKEN"))
        .mockResolvedValueOnce(createMockResponse(200));

      await retryFetch(
        "http://test.com",
        { headers: { "Content-Type": "application/json", "X-Custom": "kept" } },
        mockFetch,
        { onAuthFailure }
      );

      const retryInit = mockFetch.mock.calls[1][1] as RequestInit;
      const headers = new Headers(retryInit?.headers);
      expect(headers.get("X-Authorization")).toBe("new-token");
      expect(headers.get("Content-Type")).toBe("application/json");
      expect(headers.get("X-Custom")).toBe("kept");
    });
  });

  // ─── Request timeout ───────────────────────────────────────────────

  describe("request timeout", () => {
    it("should apply timeout signal when requestTimeoutMs is set", async () => {
      mockFetch.mockImplementation(async (_input, init) => {
        expect(init?.signal).toBeDefined();
        return createMockResponse(200);
      });

      await retryFetch("http://test.com", {}, mockFetch, {
        requestTimeoutMs: 5000,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should not override existing signal when no timeout set", async () => {
      const controller = new AbortController();

      mockFetch.mockImplementation(async (_input, init) => {
        expect(init?.signal).toBe(controller.signal);
        return createMockResponse(200);
      });

      await retryFetch(
        "http://test.com",
        { signal: controller.signal },
        mockFetch,
        {}
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should not modify init when no timeout is set and no existing signal", async () => {
      mockFetch.mockImplementation(async (_input, init) => {
        // signal should be undefined/absent since no timeout and no existing signal
        expect(init?.signal).toBeUndefined();
        return createMockResponse(200);
      });

      await retryFetch("http://test.com", {}, mockFetch, {});
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // ─── applyTimeout ─────────────────────────────────────────────────

  describe("applyTimeout", () => {
    it("should return init with timeout signal when no existing signal", () => {
      const result = applyTimeout({}, 5000) as RequestInit;
      expect(result.signal).toBeDefined();
    });

    it("should combine signals when both timeout and existing signal present", () => {
      const controller = new AbortController();
      const result = applyTimeout({ signal: controller.signal }, 5000) as RequestInit;
      // Should have a signal (either from AbortSignal.any or manual combiner)
      expect(result.signal).toBeDefined();
      // Should NOT be the original signal (it's wrapped)
      expect(result.signal).not.toBe(controller.signal);
    });

    it("should immediately abort combined signal if existing signal is already aborted", () => {
      const controller = new AbortController();
      controller.abort("test reason");
      const result = applyTimeout({ signal: controller.signal }, 5000) as RequestInit;
      expect((result.signal as AbortSignal).aborted).toBe(true);
    });

    it("should preserve other init properties", () => {
      const result = applyTimeout({ method: "POST" }, 5000) as RequestInit;
      expect(result.method).toBe("POST");
      expect(result.signal).toBeDefined();
    });
  });

  // ─── Interaction: transport retry + timeout ────────────────────────

  describe("transport retry + timeout interaction", () => {
    it("should not retry timeout errors during transport retry loop", async () => {
      const timeoutError = new DOMException("Timed out", "AbortError");
      mockFetch.mockRejectedValue(timeoutError);

      await expect(
        retryFetch("http://test.com", {}, mockFetch, {
          maxTransportRetries: 3,
          requestTimeoutMs: 100,
        })
      ).rejects.toThrow();

      // Should NOT have retried -- timeout errors are not transport errors
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should apply timeout to retry attempts as well", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("ECONNRESET"))
        .mockImplementationOnce(async (_input, init) => {
          // Second attempt should also have a timeout signal
          expect(init?.signal).toBeDefined();
          return createMockResponse(200);
        });

      const result = await retryFetch("http://test.com", {}, mockFetch, {
        maxTransportRetries: 3,
        requestTimeoutMs: 5000,
        initialRetryDelay: 1,
      });

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Interaction: transport retry + 429 ────────────────────────────

  describe("transport retry + 429 interaction", () => {
    it("should handle 429 after recovering from transport error", async () => {
      jest.useFakeTimers();
      mockFetch
        .mockRejectedValueOnce(new Error("ECONNRESET"))
        .mockResolvedValueOnce(createMockResponse(429))
        .mockResolvedValueOnce(createMockResponse(200));

      const promise = retryFetch("http://test.com", {}, mockFetch, {
        maxTransportRetries: 3,
        initialRetryDelay: 1,
      });

      // Advance past transport retry delay + 429 retry delay
      await jest.advanceTimersByTimeAsync(2000);
      const result = await promise;

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      jest.useRealTimers();
    });
  });

  // ─── wrapFetchWithRetry ────────────────────────────────────────────

  describe("wrapFetchWithRetry", () => {
    it("should return a function with the fetch signature", async () => {
      mockFetch.mockResolvedValue(createMockResponse(200));

      const wrappedFetch = wrapFetchWithRetry(mockFetch);
      const result = await wrappedFetch("http://test.com");

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should pass options through to retryFetch", async () => {
      const onAuthFailure = jest.fn<() => Promise<string | undefined>>()
        .mockResolvedValue("new-token");

      mockFetch
        .mockResolvedValueOnce(createTokenErrorResponse(401, "EXPIRED_TOKEN"))
        .mockResolvedValueOnce(createMockResponse(200));

      const wrappedFetch = wrapFetchWithRetry(mockFetch, { onAuthFailure });
      const result = await wrappedFetch("http://test.com");

      expect(result.status).toBe(200);
      expect(onAuthFailure).toHaveBeenCalledTimes(1);
    });

    it("should work without options (backward-compatible)", async () => {
      mockFetch.mockResolvedValue(createMockResponse(200));

      const wrappedFetch = wrapFetchWithRetry(mockFetch);
      const result = await wrappedFetch("http://test.com", { method: "POST" });

      expect(result.status).toBe(200);
    });
  });

  // ─── wrapFetchWithRetry metrics recording ───────────────────────────

  describe("wrapFetchWithRetry metrics", () => {
    const mockRecordApiRequestTime = jest.fn<
      (m: string, u: string, s: string, d: number, t?: string) => void
    >();

    beforeEach(() => {
      mockRecordApiRequestTime.mockClear();
      httpObserver.setHttpMetricsObserver({
        measurePayloadSize: false,
        recordApiRequestTime: mockRecordApiRequestTime,
        recordWorkflowInputSize: jest.fn(),
        recordWorkflowStartError: jest.fn(),
      });
    });

    afterEach(() => {
      httpObserver.setHttpMetricsObserver(undefined);
    });

    it("should record metrics on successful response", async () => {
      mockFetch.mockResolvedValue(createMockResponse(200));

      const wrappedFetch = wrapFetchWithRetry(mockFetch);
      await wrappedFetch("http://test.com/api/tasks", { method: "POST" });

      expect(mockRecordApiRequestTime).toHaveBeenCalledTimes(1);
      const [method, uri, status, duration] =
        mockRecordApiRequestTime.mock.calls[0];
      expect(method).toBe("POST");
      expect(uri).toBe("/api/tasks");
      expect(status).toBe("200");
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it("should record status '0' on network failure", async () => {
      mockFetch.mockRejectedValue(new Error("ECONNRESET"));

      const wrappedFetch = wrapFetchWithRetry(mockFetch, {
        maxTransportRetries: 0,
      });

      await expect(
        wrappedFetch("http://test.com/api/workflow")
      ).rejects.toThrow("ECONNRESET");

      expect(mockRecordApiRequestTime).toHaveBeenCalledTimes(1);
      const [method, uri, status] =
        mockRecordApiRequestTime.mock.calls[0];
      expect(method).toBe("GET");
      expect(uri).toBe("/api/workflow");
      expect(status).toBe("0");
    });

    it("should extract method and URI from Request object on network failure", async () => {
      mockFetch.mockRejectedValue(new Error("ECONNRESET"));

      const wrappedFetch = wrapFetchWithRetry(mockFetch, {
        maxTransportRetries: 0,
      });
      const request = new Request("http://example.com/api/metadata", {
        method: "DELETE",
      });

      await expect(wrappedFetch(request)).rejects.toThrow("ECONNRESET");

      expect(mockRecordApiRequestTime).toHaveBeenCalledTimes(1);
      const [method, uri, status] = mockRecordApiRequestTime.mock.calls[0];
      expect(method).toBe("DELETE");
      expect(uri).toBe("/api/metadata");
      expect(status).toBe("0");
    });

    it("should pass template from requestTemplateMap on success", async () => {
      mockFetch.mockResolvedValue(createMockResponse(200));

      const request = new Request("http://host/api/workflow/abc-123", {
        method: "GET",
      });
      requestTemplateMap.set(request, "/workflow/{workflowId}");

      const wrappedFetch = wrapFetchWithRetry(mockFetch);
      await wrappedFetch(request);

      expect(mockRecordApiRequestTime).toHaveBeenCalledTimes(1);
      const [, , , , template] = mockRecordApiRequestTime.mock.calls[0];
      expect(template).toBe("/workflow/{workflowId}");
    });

    it("should pass template from requestTemplateMap on network failure", async () => {
      mockFetch.mockRejectedValue(new Error("ECONNRESET"));

      const request = new Request("http://host/api/workflow/abc-123", {
        method: "GET",
      });
      requestTemplateMap.set(request, "/workflow/{workflowId}");

      const wrappedFetch = wrapFetchWithRetry(mockFetch, {
        maxTransportRetries: 0,
      });

      await expect(wrappedFetch(request)).rejects.toThrow("ECONNRESET");

      expect(mockRecordApiRequestTime).toHaveBeenCalledTimes(1);
      const [, , , , template] = mockRecordApiRequestTime.mock.calls[0];
      expect(template).toBe("/workflow/{workflowId}");
    });

    it("should pass undefined template when requestTemplateMap has no entry", async () => {
      mockFetch.mockResolvedValue(createMockResponse(200));

      const request = new Request("http://host/api/workflow/abc-123", {
        method: "GET",
      });
      // Do NOT set requestTemplateMap

      const wrappedFetch = wrapFetchWithRetry(mockFetch);
      await wrappedFetch(request);

      expect(mockRecordApiRequestTime).toHaveBeenCalledTimes(1);
      const [, , , , template] = mockRecordApiRequestTime.mock.calls[0];
      expect(template).toBeUndefined();
    });

    it("should not break fetch when no observer is registered", async () => {
      httpObserver.setHttpMetricsObserver(undefined);

      mockFetch.mockResolvedValue(createMockResponse(200));
      const wrappedFetch = wrapFetchWithRetry(mockFetch);
      const result = await wrappedFetch("http://test.com");

      expect(result.status).toBe(200);
    });

    it("should not record metrics when no observer is registered", async () => {
      httpObserver.setHttpMetricsObserver(undefined);

      mockFetch.mockResolvedValue(createMockResponse(200));
      const wrappedFetch = wrapFetchWithRetry(mockFetch);
      await wrappedFetch("http://test.com");

      expect(mockRecordApiRequestTime).not.toHaveBeenCalled();
    });

    it("should still resolve the response when the collector throws on success", async () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      mockRecordApiRequestTime.mockImplementation(() => {
        throw new Error("collector blew up");
      });
      mockFetch.mockResolvedValue(createMockResponse(200));

      const wrappedFetch = wrapFetchWithRetry(mockFetch);
      const result = await wrappedFetch("http://test.com/api/tasks");

      expect(result.status).toBe(200);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("should propagate the original error (not the metrics error) when the collector throws on failure", async () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      mockRecordApiRequestTime.mockImplementation(() => {
        throw new Error("collector blew up");
      });
      mockFetch.mockRejectedValue(new Error("ECONNRESET"));

      const wrappedFetch = wrapFetchWithRetry(mockFetch, {
        maxTransportRetries: 0,
      });

      await expect(
        wrappedFetch("http://test.com/api/workflow")
      ).rejects.toThrow("ECONNRESET");

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
