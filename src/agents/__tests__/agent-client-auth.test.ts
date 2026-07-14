import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";

/**
 * Spec guard (R1/R2): `OrkesAgentClient` mints/caches nothing of its own —
 * every `/agent/*` call rides the shared client's `client.request(...)` path,
 * which borrows the TTL-aware token via the R2 accessor. These tests exercise
 * that through the REAL `createConductorClient` + `handleAuth` wiring, only
 * mocking the generated OpenAPI transport (same pattern as
 * `createConductorClient.test.ts`).
 */

jest.mock("../../sdk/createConductorClient/helpers/getUndiciHttp2FetchFn", () => ({
  getUndiciHttp2FetchFn: async () => globalThis.fetch,
}));

jest.mock("../../open-api/generated", () => ({
  TokenResource: {
    generateToken: jest.fn(),
  },
}));

jest.mock("../../open-api/generated/client", () => {
  // Each createClient(...) call returns its OWN independent client — never a
  // shared/mutated singleton. Two `OrkesAgentClient`s in the same test file
  // (one authenticated, one anonymous) must not leak `_config.auth` between
  // them the way a module-level singleton would.
  const makeClient = (initialConfig: Record<string, unknown>) => {
    const client = {
      _config: { ...initialConfig } as Record<string, unknown>,
      _fetch: (initialConfig.fetch as typeof fetch) ?? (globalThis.fetch as typeof fetch),
      setConfig(config: Record<string, unknown>) {
        Object.assign(client._config, config);
        if (config.fetch) client._fetch = config.fetch as typeof fetch;
        return client._config;
      },
      getConfig() {
        return client._config;
      },
      async request(options: {
        url: string;
        method: string;
        headers?: Record<string, string>;
        body?: unknown;
      }) {
        const baseUrl = (client._config.baseUrl as string) || "";
        const url = `${baseUrl}${options.url}`;

        const headers: Record<string, string> = { ...options.headers };
        const auth = client._config.auth;
        if (typeof auth === "function") {
          const token = await (auth as () => Promise<string | undefined>)();
          if (token) headers["X-Authorization"] = String(token);
        } else if (typeof auth === "string") {
          headers["X-Authorization"] = auth;
        }

        const fetchFn = client._fetch;
        const response = await fetchFn(url, {
          method: options.method,
          headers,
          body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
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
    return client;
  };

  return {
    createClient: (config: Record<string, unknown>) => makeClient(config),
  };
});

jest.mock("../../sdk/createConductorClient/helpers/addResourcesBackwardCompatibility", () => ({
  addResourcesBackwardCompatibility: (client: unknown) => client,
}));

// Must import AFTER mocks are set up.
import { OrkesAgentClient } from "../../sdk/clients/agent/OrkesAgentClient.js";
import { TokenResource } from "../../open-api/generated";

const mockedGenerateToken = TokenResource.generateToken as jest.MockedFunction<
  typeof TokenResource.generateToken
>;

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
  }) as unknown as Awaited<ReturnType<typeof TokenResource.generateToken>>;

describe("OrkesAgentClient auth (borrows the shared client's R2 accessor)", () => {
  let realFetch: typeof globalThis.fetch;

  beforeEach(() => {
    realFetch = globalThis.fetch;
    mockedGenerateToken.mockReset();
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it("mints one JWT across N /agent/* calls; X-Authorization on every request", async () => {
    mockedGenerateToken.mockResolvedValue(tokenSuccess("jwt-1"));

    const seen: Headers[] = [];
    globalThis.fetch = jest.fn(async (_url: unknown, init?: RequestInit) => {
      seen.push(new Headers(init?.headers));
      return jsonResponse({ executionId: "exec-1", status: "COMPLETED" });
    }) as unknown as typeof fetch;

    const client = new OrkesAgentClient({
      serverUrl: "http://localhost:8080/api",
      keyId: "KEY",
      keySecret: "SECRET",
    });

    await client.startAgent({ prompt: "hi" });
    await client.status("exec-1");
    await client.deployAgent({ name: "a" });

    expect(seen).toHaveLength(3);
    for (const h of seen) {
      expect(h.get("x-authorization")).toBe("jwt-1");
    }
    // One mint serves all three calls — OrkesAgentClient mints nothing itself.
    expect(mockedGenerateToken).toHaveBeenCalledTimes(1);
  });

  it("COUNTERFACTUAL: anonymous config sends no X-Authorization header and mints nothing", async () => {
    let captured: Headers | undefined;
    globalThis.fetch = jest.fn(async (_url: unknown, init?: RequestInit) => {
      captured = new Headers(init?.headers);
      return jsonResponse({ executionId: "exec-1", status: "COMPLETED" });
    }) as unknown as typeof fetch;

    const client = new OrkesAgentClient({ serverUrl: "http://localhost:8080/api" });

    await client.startAgent({ prompt: "hi" });

    expect(captured?.get("x-authorization")).toBeNull();
    expect(mockedGenerateToken).not.toHaveBeenCalled();
  });
});
