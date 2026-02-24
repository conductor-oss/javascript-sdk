import { jest, expect, describe, it, beforeEach } from "@jest/globals";

// Mock undici to avoid ts-jest compilation failure on missing module
jest.mock("../helpers/getUndiciHttp2FetchFn", () => ({
  getUndiciHttp2FetchFn: async () => globalThis.fetch,
}));

// Mock the generated OpenAPI modules to avoid ts-jest issues with
// `export type *` and strict type errors in auto-generated code
jest.mock("../../../open-api/generated", () => ({
  TokenResource: {
    generateToken: jest.fn(),
  },
}));

jest.mock("../../../open-api/generated/client", () => {
  const actualClient = {
    _config: {} as Record<string, unknown>,
    _fetch: globalThis.fetch as typeof fetch,
    setConfig(config: Record<string, unknown>) {
      Object.assign(actualClient._config, config);
      if (config.fetch) actualClient._fetch = config.fetch as typeof fetch;
      return actualClient._config;
    },
    getConfig() {
      return actualClient._config;
    },
    async request(options: { url: string; method: string; headers?: Record<string, string> }) {
      const baseUrl = (actualClient._config.baseUrl as string) || "";
      const url = `${baseUrl}${options.url}`;

      // Build headers, applying auth callback if set
      const headers: Record<string, string> = { ...options.headers };
      const auth = actualClient._config.auth;
      if (typeof auth === "function") {
        const token = await auth({ name: "X-Authorization", type: "apiKey" });
        if (token) headers["X-Authorization"] = String(token);
      } else if (typeof auth === "string") {
        headers["X-Authorization"] = auth;
      }

      const fetchFn = actualClient._fetch;
      const response = await fetchFn(url, {
        method: options.method,
        headers,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { data: undefined, error: data, response, request: {} };
      }
      return { data, response, request: {} };
    },
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn(), fns: [] },
      response: { use: jest.fn(), eject: jest.fn(), fns: [] },
    },
  };

  return {
    createClient: (_config: Record<string, unknown>) => {
      actualClient._config = { ...actualClient._config, ..._config };
      if (_config.fetch) actualClient._fetch = _config.fetch as typeof fetch;
      return actualClient;
    },
  };
});

// Mock the backward compatibility helper to avoid pulling in full generated SDK
jest.mock("../helpers/addResourcesBackwardCompatibility", () => ({
  addResourcesBackwardCompatibility: (client: unknown) => client,
}));

// Must import AFTER mocks are set up
import { createConductorClient } from "../createConductorClient";
import { TokenResource } from "../../../open-api/generated";
import type { ConductorLogger } from "../../helpers/logger";

const mockedGenerateToken = TokenResource.generateToken as jest.MockedFunction<
  typeof TokenResource.generateToken
>;

/**
 * Integration tests for createConductorClient.
 *
 * These test the full wiring: config resolution -> auth -> fetch retry.
 * TokenResource.generateToken is mocked. A custom fetch is provided to
 * simulate server behavior for non-token requests.
 */

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

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const tokenSuccess = (token: string) =>
  ({
    data: { token },
    error: undefined,
    response: { status: 200 } as Response,
    request: {} as Request,
  }) as any;

const token404 = () =>
  ({
    data: undefined,
    error: undefined,
    response: { status: 404 } as Response,
    request: {} as Request,
  }) as any;

const tokenFailure = (message = "Server error") =>
  ({
    data: undefined,
    error: { message },
    response: { status: 500 } as Response,
    request: {} as Request,
  }) as any;

describe("createConductorClient integration", () => {
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockedGenerateToken.mockReset();
    delete process.env.CONDUCTOR_SERVER_URL;
    delete process.env.CONDUCTOR_AUTH_KEY;
    delete process.env.CONDUCTOR_AUTH_SECRET;
    delete process.env.CONDUCTOR_REQUEST_TIMEOUT_MS;
  });

  // ─── Auth flow ─────────────────────────────────────────────────────

  describe("auth flow", () => {
    it("should authenticate and create a client with auth callback", async () => {
      mockedGenerateToken.mockResolvedValue(tokenSuccess("jwt-1"));
      const customFetch: typeof fetch = async () => jsonResponse({ result: "ok" });

      const client = await createConductorClient(
        {
          serverUrl: "http://localhost:8080",
          keyId: "test-key",
          keySecret: "test-secret",
          logger: mockLogger,
        },
        customFetch
      );

      expect(client).toBeDefined();
      expect(mockedGenerateToken).toHaveBeenCalledTimes(1);
    });

    it("should create client without auth when no credentials provided", async () => {
      const customFetch: typeof fetch = async () => jsonResponse({});

      const client = await createConductorClient(
        { serverUrl: "http://localhost:8080" },
        customFetch
      );

      expect(client).toBeDefined();
      expect(mockedGenerateToken).not.toHaveBeenCalled();
    });

    it("should throw when initial auth fails", async () => {
      mockedGenerateToken.mockResolvedValue(tokenFailure("Bad credentials"));

      await expect(
        createConductorClient(
          {
            serverUrl: "http://localhost:8080",
            keyId: "bad-key",
            keySecret: "bad-secret",
          },
          async () => jsonResponse({})
        )
      ).rejects.toThrow("Failed to generate authorization token");
    });
  });

  // ─── OSS detection ─────────────────────────────────────────────────

  describe("OSS detection", () => {
    it("should gracefully handle OSS server (404 on /token)", async () => {
      mockedGenerateToken.mockResolvedValue(token404());
      const customFetch: typeof fetch = async () => jsonResponse({ workflows: [] });

      const client = await createConductorClient(
        {
          serverUrl: "http://localhost:8080",
          keyId: "test-key",
          keySecret: "test-secret",
          logger: mockLogger,
        },
        customFetch
      );

      expect(client).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("OSS detected")
      );
    });
  });

  // ─── 401 retry with token refresh ─────────────────────────────────

  describe("401 retry via fetch wrapper", () => {
    it("should retry a 401 by refreshing the token", async () => {
      let tokenCallCount = 0;
      mockedGenerateToken.mockImplementation(async () => {
        tokenCallCount++;
        return tokenSuccess(`jwt-${tokenCallCount}`);
      });

      let apiCallCount = 0;
      const customFetch: typeof fetch = async (_input, init) => {
        apiCallCount++;
        const headers = new Headers(init?.headers);
        const authToken = headers.get("X-Authorization");

        // First API call returns 401 (simulating expired token)
        if (apiCallCount === 1 && authToken === "jwt-1") {
          return jsonResponse({ message: "Token expired" }, 401);
        }

        // After refresh, succeed
        return jsonResponse({ result: "ok" });
      };

      const client = await createConductorClient(
        {
          serverUrl: "http://localhost:8080",
          keyId: "test-key",
          keySecret: "test-secret",
          logger: mockLogger,
        },
        customFetch
      );

      // Make an API call that triggers 401 -> refresh -> retry
      try {
        await client.request({ url: "/api/workflow", method: "GET" });
      } catch {
        // May throw depending on response parsing
      }

      // Initial auth + refresh on 401 = 2 token calls
      expect(tokenCallCount).toBe(2);
      // First call (401) + retry (200) = 2 API calls
      expect(apiCallCount).toBe(2);
    });
  });

  // ─── Transport error retry ─────────────────────────────────────────

  describe("transport error retry via fetch wrapper", () => {
    it("should retry network errors transparently", async () => {
      mockedGenerateToken.mockResolvedValue(tokenSuccess("jwt-1"));

      let apiCallCount = 0;
      const customFetch: typeof fetch = async () => {
        apiCallCount++;
        if (apiCallCount === 1) {
          throw new Error("ECONNRESET");
        }
        return jsonResponse({ result: "ok" });
      };

      const client = await createConductorClient(
        {
          serverUrl: "http://localhost:8080",
          keyId: "test-key",
          keySecret: "test-secret",
          logger: mockLogger,
        },
        customFetch
      );

      const response = await client.request({
        url: "/api/workflow",
        method: "GET",
      });

      expect(apiCallCount).toBe(2); // 1 failure + 1 success
    });
  });

  // ─── Rate limit (429) retry ────────────────────────────────────────

  describe("rate limit retry via fetch wrapper", () => {
    it("should retry 429 responses with backoff", async () => {
      jest.useFakeTimers();
      mockedGenerateToken.mockResolvedValue(tokenSuccess("jwt-1"));

      let apiCallCount = 0;
      const customFetch: typeof fetch = async () => {
        apiCallCount++;
        if (apiCallCount <= 2) {
          return jsonResponse({ message: "Too Many Requests" }, 429);
        }
        return jsonResponse({ result: "ok" });
      };

      const client = await createConductorClient(
        {
          serverUrl: "http://localhost:8080",
          keyId: "test-key",
          keySecret: "test-secret",
          logger: mockLogger,
        },
        customFetch
      );

      const responsePromise = client.request({
        url: "/api/workflow",
        method: "GET",
      });

      // Advance timers for retry backoff
      for (let i = 0; i < 5; i++) {
        await jest.advanceTimersByTimeAsync(5000);
      }

      await responsePromise;
      expect(apiCallCount).toBe(3); // 2x 429 + 1 success
      jest.useRealTimers();
    });
  });

  // ─── Config resolution ─────────────────────────────────────────────

  describe("config resolution", () => {
    it("should throw when no server URL is provided", async () => {
      await expect(createConductorClient({})).rejects.toThrow(
        "Conductor server URL is not set"
      );
    });

    it("should resolve server URL from env var", async () => {
      process.env.CONDUCTOR_SERVER_URL = "http://env-server:8080";
      const customFetch: typeof fetch = async () => jsonResponse({});

      const client = await createConductorClient({}, customFetch);
      expect(client).toBeDefined();

      delete process.env.CONDUCTOR_SERVER_URL;
    });

    it("should resolve auth credentials from env vars", async () => {
      process.env.CONDUCTOR_AUTH_KEY = "env-key";
      process.env.CONDUCTOR_AUTH_SECRET = "env-secret";
      mockedGenerateToken.mockResolvedValue(tokenSuccess("jwt-env"));

      const client = await createConductorClient(
        { serverUrl: "http://localhost:8080" },
        async () => jsonResponse({})
      );

      expect(client).toBeDefined();
      expect(mockedGenerateToken).toHaveBeenCalledTimes(1);

      delete process.env.CONDUCTOR_AUTH_KEY;
      delete process.env.CONDUCTOR_AUTH_SECRET;
    });

    it("should strip trailing slash and /api from server URL", async () => {
      let capturedUrl = "";
      const customFetch: typeof fetch = async (input) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : (input as Request).url;
        capturedUrl = url;
        return jsonResponse({});
      };

      await createConductorClient(
        { serverUrl: "http://localhost:8080/api/" },
        customFetch
      );

      expect(capturedUrl).not.toContain("/api/api");
    });
  });
});
