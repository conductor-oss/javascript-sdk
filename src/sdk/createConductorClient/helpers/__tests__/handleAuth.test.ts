/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { jest, expect, describe, it, beforeEach, afterEach } from "@jest/globals";
import { handleAuth } from "../handleAuth";
import { TokenResource } from "../../../../open-api/generated";
import type { Client } from "../../../../open-api/generated/client/types.gen";
import type { ConductorLogger } from "../../../helpers/logger";
import { TOKEN_TTL_MS, MAX_AUTH_FAILURES, MAX_INITIAL_TOKEN_RETRIES } from "../../constants";

// Mock TokenResource.generateToken
jest.mock("../../../../open-api/generated", () => ({
  TokenResource: {
    generateToken: jest.fn(),
  },
}));

const mockedGenerateToken = TokenResource.generateToken as jest.MockedFunction<
  typeof TokenResource.generateToken
>;

const createMockClient = () => ({
  setConfig: jest.fn(),
  request: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: { use: jest.fn(), eject: jest.fn(), fns: [] },
    response: { use: jest.fn(), eject: jest.fn(), fns: [] },
  },
  getConfig: jest.fn(),
});

const createMockLogger = (): ConductorLogger & {
  warn: jest.Mock;
  info: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
} => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const mockSuccess = (token: string) =>
  ({
    data: { token },
    error: undefined,
    response: { status: 200 } as Response,
    request: {} as Request,
  }) as unknown as Awaited<ReturnType<typeof TokenResource.generateToken>>;

const mockFailure = (status = 500, message = "Server error") =>
  ({
    data: undefined,
    error: { message },
    response: { status } as Response,
    request: {} as Request,
  }) as unknown as Awaited<ReturnType<typeof TokenResource.generateToken>>;

const mock404 = () =>
  ({
    data: undefined,
    error: undefined,
    response: { status: 404 } as Response,
    request: {} as Request,
  }) as unknown as Awaited<ReturnType<typeof TokenResource.generateToken>>;

/** Helper to extract the auth callback that handleAuth sets on the client */
const getAuthCallback = (mockClient: ReturnType<typeof createMockClient>) => {
  const call = mockClient.setConfig.mock.calls.find(
    (c: unknown[]) => (c[0] as Record<string, unknown>)?.auth
  );
  if (!call) throw new Error("auth callback was never set");
  return (call[0] as Record<string, unknown>).auth as () => Promise<string | undefined>;
};

describe("handleAuth", () => {
  let mockClient: ReturnType<typeof createMockClient>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    jest.useFakeTimers();
    mockClient = createMockClient();
    mockLogger = createMockLogger();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── Initial auth ──────────────────────────────────────────────────

  describe("initial auth", () => {
    it("should set auth callback with token on successful initial auth", async () => {
      mockedGenerateToken.mockResolvedValue(mockSuccess("test-token-123"));

      const result = await handleAuth(
        mockClient as unknown as Client, "key-id", "key-secret", 3600000, mockLogger
      );

      expect(result).toBeDefined();
      if (!result) throw new Error("expected result to be defined");
      expect(result.refreshToken).toBeInstanceOf(Function);
      expect(result.stopBackgroundRefresh).toBeInstanceOf(Function);
      expect(mockClient.setConfig).toHaveBeenCalledWith(
        expect.objectContaining({ auth: expect.any(Function) })
      );
    });

    it("should throw on initial auth failure after retries", async () => {
      mockedGenerateToken.mockResolvedValue(mockFailure(401, "Unauthorized"));

      // Set up rejection handler BEFORE advancing timers to avoid unhandled rejection
      const assertion = expect(
        handleAuth(mockClient as unknown as Client, "key-id", "key-secret", 3600000, mockLogger)
      ).rejects.toThrow("Failed to generate authorization token");

      // Advance past all retry backoff delays (1s + 2s = 3s)
      await jest.advanceTimersByTimeAsync(3000);
      await assertion;

      expect(mockedGenerateToken).toHaveBeenCalledTimes(MAX_INITIAL_TOKEN_RETRIES);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Initial token request failed")
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Initial token generation failed after all retries"),
        expect.anything()
      );
    });

    it("should succeed on retry after transient failure", async () => {
      let callCount = 0;
      mockedGenerateToken.mockImplementation(async () => {
        callCount++;
        if (callCount < 3) return mockFailure(500, "Server error");
        return mockSuccess("recovered-token");
      });

      const p = handleAuth(mockClient as unknown as Client, "key-id", "key-secret", 3600000, mockLogger);

      // Advance past retry backoff delays
      await jest.advanceTimersByTimeAsync(3000);

      const result = await p;
      expect(result).toBeDefined();
      expect(callCount).toBe(3); // 2 failures + 1 success
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Initial token request failed")
      );
    });

    it("should log auth error code when present in response (EXPIRED_TOKEN)", async () => {
      mockedGenerateToken.mockResolvedValue({
        data: undefined,
        error: { message: "Token expired", error: "EXPIRED_TOKEN" },
        response: { status: 401 } as Response,
        request: {} as Request,
      } as unknown as Awaited<ReturnType<typeof TokenResource.generateToken>>);

      const assertion = expect(
        handleAuth(mockClient as unknown as Client, "key-id", "key-secret", 3600000, mockLogger)
      ).rejects.toThrow("Failed to generate authorization token");

      await jest.advanceTimersByTimeAsync(3000);
      await assertion;

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("EXPIRED_TOKEN")
      );
    });

    it("should log auth error code when present in response (INVALID_TOKEN)", async () => {
      mockedGenerateToken.mockResolvedValue({
        data: undefined,
        error: { message: "Invalid token", error: "INVALID_TOKEN" },
        response: { status: 403 } as Response,
        request: {} as Request,
      } as unknown as Awaited<ReturnType<typeof TokenResource.generateToken>>);

      const assertion = expect(
        handleAuth(mockClient as unknown as Client, "key-id", "key-secret", 3600000, mockLogger)
      ).rejects.toThrow("Failed to generate authorization token");

      await jest.advanceTimersByTimeAsync(3000);
      await assertion;

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("INVALID_TOKEN")
      );
    });
  });

  // ─── OSS detection ─────────────────────────────────────────────────

  describe("OSS detection", () => {
    it("should detect OSS server (404 on /token) and return undefined", async () => {
      mockedGenerateToken.mockResolvedValue(mock404());

      const result = await handleAuth(
        mockClient as unknown as Client, "key-id", "key-secret", 3600000, mockLogger
      );

      expect(result).toBeUndefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("OSS detected")
      );
    });

    it("should not set auth callback or start background refresh for OSS", async () => {
      mockedGenerateToken.mockResolvedValue(mock404());

      await handleAuth(mockClient as unknown as Client, "key-id", "key-secret", 60000, mockLogger);

      // setConfig should NOT have been called with an auth callback
      const authCalls = mockClient.setConfig.mock.calls.filter(
        (c: unknown[]) => (c[0] as Record<string, unknown>)?.auth
      );
      expect(authCalls).toHaveLength(0);

      // Advancing time should NOT trigger any more generateToken calls
      const callsBefore = mockedGenerateToken.mock.calls.length;
      await jest.advanceTimersByTimeAsync(120_000);
      expect(mockedGenerateToken.mock.calls.length).toBe(callsBefore);
    });
  });

  // ─── Pre-request TTL check ─────────────────────────────────────────

  describe("pre-request TTL check", () => {
    it("should return current token when TTL has not elapsed", async () => {
      mockedGenerateToken.mockResolvedValue(mockSuccess("token-1"));

      await handleAuth(mockClient as unknown as Client, "key-id", "key-secret", 3600000, mockLogger);
      const authCallback = getAuthCallback(mockClient);

      const token = await authCallback();
      expect(token).toBe("token-1");
      // Only the initial call, no refresh
      expect(mockedGenerateToken).toHaveBeenCalledTimes(1);
    });

    it("should refresh token inline when TTL is exceeded", async () => {
      let callCount = 0;
      mockedGenerateToken.mockImplementation(async () => {
        callCount++;
        return mockSuccess(`token-${callCount}`);
      });

      // Disable background refresh so only inline TTL path is tested
      await handleAuth(mockClient as unknown as Client, "key-id", "key-secret", 0, mockLogger);
      const authCallback = getAuthCallback(mockClient);

      // First call -- not expired
      expect(await authCallback()).toBe("token-1");

      // Advance past TTL
      jest.advanceTimersByTime(TOKEN_TTL_MS + 1);

      // Next call triggers inline refresh
      expect(await authCallback()).toBe("token-2");
      expect(callCount).toBe(2); // initial + inline refresh
    });

    it("should return stale token when inline refresh fails", async () => {
      let callCount = 0;
      mockedGenerateToken.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return mockSuccess("initial-token");
        return mockFailure();
      });

      // Disable background refresh so only inline TTL path is tested
      await handleAuth(mockClient as unknown as Client, "key-id", "key-secret", 0, mockLogger);
      const authCallback = getAuthCallback(mockClient);

      jest.advanceTimersByTime(TOKEN_TTL_MS + 1);

      // Should fall back to the stale token, not throw
      expect(await authCallback()).toBe("initial-token");
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Pre-request token refresh failed")
      );
    });

    it("should respect backoff on inline refresh", async () => {
      let callCount = 0;
      mockedGenerateToken.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return mockSuccess("initial-token");
        return mockFailure();
      });

      // Disable background refresh so only inline TTL path is tested
      await handleAuth(mockClient as unknown as Client, "key-id", "key-secret", 0, mockLogger);
      const authCallback = getAuthCallback(mockClient);

      jest.advanceTimersByTime(TOKEN_TTL_MS + 1);

      // First inline refresh fails -> callCount=2, consecutiveFailures=1
      await authCallback();
      expect(callCount).toBe(2);

      // Immediately calling again should be backed off (2^0 * 1000 = 1s)
      // so no new getNewToken call
      await authCallback();
      expect(callCount).toBe(2); // unchanged -- backoff skipped the call

      // After backoff elapses, should try again
      jest.advanceTimersByTime(1001);
      await authCallback();
      expect(callCount).toBe(3); // now it tried again
    });
  });

  // ─── Background refresh ────────────────────────────────────────────

  describe("background refresh", () => {
    it("should keep running after failures (never clearInterval)", async () => {
      let callCount = 0;
      mockedGenerateToken.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return mockSuccess("initial-token");
        return mockFailure();
      });

      await handleAuth(mockClient as unknown as Client, "key-id", "key-secret", 10_000, mockLogger);

      // Advance through several intervals
      for (let i = 0; i < 4; i++) {
        await jest.advanceTimersByTimeAsync(10_001);
      }

      // Should have attempted multiple refreshes despite all failing
      expect(callCount).toBeGreaterThan(2);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("should log error after MAX_AUTH_FAILURES consecutive failures", async () => {
      let callCount = 0;
      mockedGenerateToken.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return mockSuccess("initial-token");
        return mockFailure();
      });

      // Use a very short interval to avoid large time advances
      await handleAuth(mockClient as unknown as Client, "key-id", "key-secret", 1000, mockLogger);

      // Need enough intervals for MAX_AUTH_FAILURES (5) to accumulate.
      // With backoff, some ticks will be skipped, so advance generously.
      for (let i = 0; i < MAX_AUTH_FAILURES + 10; i++) {
        await jest.advanceTimersByTimeAsync(61_000); // past max backoff
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("consecutive times")
      );
    });

    it("should apply exponential backoff on consecutive failures", async () => {
      let callCount = 0;
      mockedGenerateToken.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return mockSuccess("initial-token");
        return mockFailure();
      });

      // interval = 500ms for fast testing
      await handleAuth(mockClient as unknown as Client, "key-id", "key-secret", 500, mockLogger);

      // First tick fires at 500ms -- fails, consecutiveFailures=1, backoff=1s
      await jest.advanceTimersByTimeAsync(501);
      const callsAfterFirst = callCount; // should be 2 (initial + first bg)

      // Next tick at 1000ms -- within 1s backoff, should be skipped
      await jest.advanceTimersByTimeAsync(500);
      expect(callCount).toBe(callsAfterFirst); // no new call

      // After backoff elapses (>1s from failure) -- next tick should fire
      await jest.advanceTimersByTimeAsync(1000);
      expect(callCount).toBeGreaterThan(callsAfterFirst);
    });

    it("should reset consecutive failures on success after failures", async () => {
      let callCount = 0;
      mockedGenerateToken.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return mockSuccess("initial-token");
        if (callCount <= 3) return mockFailure(); // 2 failures
        return mockSuccess("recovered-token"); // then success
      });

      await handleAuth(mockClient as unknown as Client, "key-id", "key-secret", 500, mockLogger);

      // Advance enough for failures + backoff + eventual success
      for (let i = 0; i < 20; i++) {
        await jest.advanceTimersByTimeAsync(61_000);
      }

      // Should have eventually called with success (callCount >= 4)
      expect(callCount).toBeGreaterThanOrEqual(4);

      // After recovery, warn count should NOT have kept growing indefinitely
      // (consecutive failures reset, so further intervals succeed without warnings)
      const warnCount = mockLogger.warn.mock.calls.length;

      // Advance more -- these should succeed without new warnings
      const warnCountBefore = warnCount;
      for (let i = 0; i < 5; i++) {
        await jest.advanceTimersByTimeAsync(61_000);
      }
      expect(mockLogger.warn.mock.calls.length).toBe(warnCountBefore);
    });

    it("should cap refresh interval at 80% of TOKEN_TTL_MS", async () => {
      mockedGenerateToken.mockResolvedValue(mockSuccess("token"));

      // Pass a huge refresh interval -- should be capped
      const result = await handleAuth(
        mockClient as unknown as Client, "key-id", "key-secret", 999_999_999, mockLogger
      );
      expect(result).toBeDefined();

      // The effective interval is min(999999999, TOKEN_TTL_MS * 0.8) = TOKEN_TTL_MS * 0.8
      // Verify by advancing just past TOKEN_TTL_MS * 0.8 and checking a refresh happened
      const callsBefore = mockedGenerateToken.mock.calls.length;
      await jest.advanceTimersByTimeAsync(Math.floor(TOKEN_TTL_MS * 0.8) + 1);
      expect(mockedGenerateToken.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  // ─── stopBackgroundRefresh ─────────────────────────────────────────

  describe("stopBackgroundRefresh", () => {
    it("should stop background refresh when called", async () => {
      let callCount = 0;
      mockedGenerateToken.mockImplementation(async () => {
        callCount++;
        return mockSuccess(`token-${callCount}`);
      });

      const result = await handleAuth(
        mockClient as unknown as Client, "key-id", "key-secret", 1000, mockLogger
      );

      // Stop background refresh
      result!.stopBackgroundRefresh();

      const callsAtStop = callCount;
      await jest.advanceTimersByTimeAsync(10_000); // advance 10 intervals
      expect(callCount).toBe(callsAtStop); // no new calls
    });

    it("should be safe to call multiple times", async () => {
      mockedGenerateToken.mockResolvedValue(mockSuccess("token"));

      const result = await handleAuth(
        mockClient as unknown as Client, "key-id", "key-secret", 1000, mockLogger
      );

      // Should not throw
      result!.stopBackgroundRefresh();
      result!.stopBackgroundRefresh();
    });
  });

  // ─── refreshToken callback ─────────────────────────────────────────

  describe("refreshToken callback", () => {
    it("should return fresh token on success", async () => {
      let callCount = 0;
      mockedGenerateToken.mockImplementation(async () => {
        callCount++;
        return mockSuccess(`token-${callCount}`);
      });

      const result = await handleAuth(
        mockClient as unknown as Client, "key-id", "key-secret", 3600000, mockLogger
      );

      expect(await result!.refreshToken()).toBe("token-2");
    });

    it("should return existing token on failure", async () => {
      let callCount = 0;
      mockedGenerateToken.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return mockSuccess("initial-token");
        return mockFailure();
      });

      const result = await handleAuth(
        mockClient as unknown as Client, "key-id", "key-secret", 3600000, mockLogger
      );

      expect(await result!.refreshToken()).toBe("initial-token");
    });

    it("should respect backoff and return stale token during backoff window", async () => {
      let callCount = 0;
      mockedGenerateToken.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return mockSuccess("initial-token");
        return mockFailure();
      });

      // Disable background refresh to isolate refreshToken behavior
      const result = await handleAuth(
        mockClient as unknown as Client, "key-id", "key-secret", 0, mockLogger
      );

      // First refresh fails -> consecutiveFailures=1, backoff=1s
      const t1 = await result!.refreshToken();
      expect(t1).toBe("initial-token"); // fell back to stale token
      expect(callCount).toBe(2); // initial + one failed refresh

      // Immediately calling again should be skipped due to backoff
      const t2 = await result!.refreshToken();
      expect(t2).toBe("initial-token"); // stale token, no API call
      expect(callCount).toBe(2); // unchanged -- backoff skipped the call

      // After backoff elapses (>1s), should try again
      jest.advanceTimersByTime(1001);
      const t3 = await result!.refreshToken();
      expect(t3).toBe("initial-token"); // still fails, but tried
      expect(callCount).toBe(3); // new attempt was made
    });

    it("should reset consecutive failures on success", async () => {
      let callCount = 0;
      mockedGenerateToken.mockImplementation(async () => {
        callCount++;
        return mockSuccess(`token-${callCount}`);
      });

      // Disable background refresh to isolate inline behavior
      const result = await handleAuth(
        mockClient as unknown as Client, "key-id", "key-secret", 0, mockLogger
      );

      // refreshToken succeeds -> consecutiveFailures should be 0
      await result!.refreshToken();
      // Inline auth should also work immediately without backoff
      jest.advanceTimersByTime(TOKEN_TTL_MS + 1);
      const authCallback = getAuthCallback(mockClient);
      const token = await authCallback();
      expect(token).toBe("token-3"); // initial + refreshToken + inline refresh
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should work with no logger provided", async () => {
      mockedGenerateToken.mockResolvedValue(mockSuccess("token"));

      // Should not throw even without a logger
      const result = await handleAuth(
        mockClient as unknown as Client, "key-id", "key-secret", 3600000
      );
      expect(result).toBeDefined();
    });

    it("should still set auth callback when refreshTokenInterval is 0", async () => {
      mockedGenerateToken.mockResolvedValue(mockSuccess("test-token"));

      const result = await handleAuth(
        mockClient as unknown as Client, "key-id", "key-secret", 0, mockLogger
      );

      expect(result).toBeDefined();
      expect(mockClient.setConfig).toHaveBeenCalledWith(
        expect.objectContaining({ auth: expect.any(Function) })
      );
    });
  });

  // ─── Concurrent refresh mutex ──────────────────────────────────────

  describe("concurrent refresh mutex", () => {
    it("should coalesce concurrent refreshToken calls into one API call", async () => {
      let callCount = 0;
      let resolveToken: (() => void) | undefined;

      mockedGenerateToken.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Initial auth -- resolve immediately
          return Promise.resolve(mockSuccess("token-1"));
        }
        // Subsequent calls: delay resolution to simulate slow network
        return new Promise((resolve) => {
          resolveToken = () => resolve(mockSuccess(`token-${callCount}`));
        });
      });

      // Disable background refresh
      const result = await handleAuth(
        mockClient as unknown as Client, "key-id", "key-secret", 0, mockLogger
      );

      // Fire two concurrent refreshToken calls
      const p1 = result!.refreshToken();
      const p2 = result!.refreshToken();

      // Only one generateToken call should be in flight
      expect(callCount).toBe(2); // initial (1) + one new call (2)

      // Resolve the in-flight refresh
      resolveToken!();
      const [t1, t2] = await Promise.all([p1, p2]);

      // Both should get the same token
      expect(t1).toBe(t2);
      // Still only 2 total calls (initial + 1 coalesced)
      expect(callCount).toBe(2);
    });

    it("should allow a new refresh after the previous one completes", async () => {
      let callCount = 0;
      mockedGenerateToken.mockImplementation(async () => {
        callCount++;
        return mockSuccess(`token-${callCount}`);
      });

      // Disable background refresh
      const result = await handleAuth(
        mockClient as unknown as Client, "key-id", "key-secret", 0, mockLogger
      );

      // First refresh
      const t1 = await result!.refreshToken();
      expect(t1).toBe("token-2");

      // Second refresh -- should make a new API call since the first completed
      const t2 = await result!.refreshToken();
      expect(t2).toBe("token-3");

      expect(callCount).toBe(3); // initial + 2 sequential refreshes
    });
  });
});
