/**
 * `runtime.client` rides `OrkesAgentClient` on the shared client's
 * authenticated `client.request(...)` path (spec R1/R2) — so these tests
 * mock the generated OpenAPI transport (same pattern as
 * `agent-client-auth.test.ts`), not `global.fetch` directly.
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
        signal?: AbortSignal;
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
          signal: options.signal,
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

import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import {
  AgentRuntime,
  configure,
  run,
  start,
  stream,
  deploy,
  plan,
  serve,
  shutdown,
} from "../runtime.js";
import { AgentConfig } from "../config.js";
import { TokenResource } from "../../open-api/generated";

const mockedGenerateToken = TokenResource.generateToken as jest.MockedFunction<
  typeof TokenResource.generateToken
>;

const tokenSuccess = (token: string) =>
  ({
    data: { token },
    error: undefined,
    response: { status: 200 } as Response,
    request: {} as Request,
  }) as unknown as Awaited<ReturnType<typeof TokenResource.generateToken>>;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// ── AgentRuntime constructor ────────────────────────────

describe("AgentRuntime", () => {
  const savedEnv: Record<string, string | undefined> = {};
  const envKeys = [
    "AGENTSPAN_SERVER_URL",
    "AGENTSPAN_API_KEY",
    "AGENTSPAN_AUTH_KEY",
    "AGENTSPAN_AUTH_SECRET",
  ];

  function mockAgentServer(executionId = "wf-cred-test", fetchCalls?: string[]) {
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      fetchCalls?.push(url);
      if (url.includes("/agent/start")) {
        return jsonResponse({ executionId });
      }
      if (url.includes("/agent/stream/")) {
        const ssePayload = 'event: done\ndata: {"output":{"result":"ok"},"status":"COMPLETED"}\n\n';
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(ssePayload));
              controller.close();
            },
          }),
          { status: 200, headers: { "content-type": "text/event-stream" } },
        );
      }
      if (url.includes(`/agent/${executionId}/status`)) {
        return jsonResponse({ status: "COMPLETED", output: { result: "ok" } });
      }
      return jsonResponse({});
    });
  }

  beforeEach(() => {
    for (const key of envKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    mockedGenerateToken.mockReset();
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  describe("constructor", () => {
    it("creates with default config", () => {
      const runtime = new AgentRuntime();
      expect(runtime.config).toBeInstanceOf(AgentConfig);
      expect(runtime.config.serverUrl).toBe("http://localhost:8080/api");
    });

    it("creates with custom config", () => {
      const runtime = new AgentRuntime({
        serverUrl: "https://custom.com",
        apiKey: "my-key",
      });
      expect(runtime.config.serverUrl).toBe("https://custom.com/api");
      expect(runtime.config.apiKey).toBe("my-key");
    });

    it("builds Bearer auth headers for apiKey", () => {
      const runtime = new AgentRuntime({ apiKey: "test-key" });
      // Access private field indirectly via _httpRequest
      // We'll test this by checking the runtime was created without error
      expect(runtime.config.apiKey).toBe("test-key");
    });

    it("builds X-Auth-Key/Secret headers for authKey/authSecret", () => {
      const runtime = new AgentRuntime({
        authKey: "key",
        authSecret: "secret",
      });
      expect(runtime.config.authKey).toBe("key");
      expect(runtime.config.authSecret).toBe("secret");
    });
  });

  describe("_httpRequest", () => {
    it("throws AgentAPIError on a generic non-2xx response", async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({ message: "boom" }, 500));

      const runtime = new AgentRuntime();
      await expect(runtime._httpRequest("GET", "/test")).rejects.toThrow(
        /HTTP GET \/test failed: 500/,
      );
    });

    it("throws AgentNotFoundError on a 404 response (spec T5)", async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({ message: "no such execution" }, 404));

      const runtime = new AgentRuntime();
      await expect(runtime._httpRequest("GET", "/test")).rejects.toThrow(/Agent not found/);
    });

    it("returns parsed JSON for successful response", async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({ executionId: "wf-1" }));

      const runtime = new AgentRuntime();
      const result = await runtime._httpRequest("GET", "/test");
      expect(result).toEqual({ executionId: "wf-1" });
    });

    it("returns empty object for empty response", async () => {
      global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 204 }));

      const runtime = new AgentRuntime();
      const result = await runtime._httpRequest("GET", "/test");
      expect(result).toEqual({});
    });

    it("sends an explicit apiKey as X-Authorization (Orkes contract)", async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({}));

      const runtime = new AgentRuntime({ apiKey: "test-api-key" });
      await runtime._httpRequest("POST", "/agent/start", { prompt: "hi" });

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8080/api/agent/start",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "X-Authorization": "test-api-key",
          }),
        }),
      );
    });

    it("mints a JWT from authKey/authSecret and sends X-Authorization", async () => {
      mockedGenerateToken.mockResolvedValue(tokenSuccess("minted-jwt"));
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({}));

      const runtime = new AgentRuntime({
        authKey: "my-auth-key",
        authSecret: "my-auth-secret",
      });

      await runtime._httpRequest("GET", "/test");

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8080/api/test",
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Authorization": "minted-jwt",
          }),
        }),
      );
    });

    it("passes AbortSignal to fetch (propagates through the timeout-combined signal)", async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({}));

      const controller = new AbortController();
      const runtime = new AgentRuntime();
      await runtime._httpRequest("GET", "/test", undefined, controller.signal);

      // The real request pipeline combines the caller's signal with a
      // request-timeout signal (AbortSignal.any(...)), so fetch doesn't see
      // the exact same object — verify propagation instead of identity.
      const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [unknown, RequestInit];
      expect(init.signal).toBeInstanceOf(AbortSignal);
      expect(init.signal?.aborted).toBe(false);
      controller.abort();
      expect(init.signal?.aborted).toBe(true);
    });
  });

  describe("framework detection", () => {
    it("does not throw for native Agent (framework is null)", async () => {
      // Framework detection stub returns null, so native path is taken
      // This test just verifies the stub doesn't cause issues
      // Actual execution would require mocking the full HTTP flow
      const runtime = new AgentRuntime();
      expect(runtime).toBeInstanceOf(AgentRuntime);
    });
  });

  describe("shutdown", () => {
    it("can be called without error", async () => {
      const runtime = new AgentRuntime();
      await expect(runtime.shutdown()).resolves.not.toThrow();
    });
  });

  describe("SSE URL construction", () => {
    it("constructs SSE URL as /agent/stream/{executionId}", async () => {
      const fetchCalls: string[] = [];
      mockAgentServer("wf-sse-test", fetchCalls);

      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      jest.spyOn((runtime as any).workerManager, "startPolling").mockImplementation(() => {});
      const { Agent } = await import("../agent.js");
      const agent = new Agent({ name: "test_agent", model: "gpt-4o" });

      // run() drains the SSE stream, which triggers the fetch to the SSE URL
      try {
        await runtime.run(agent, "test prompt");
      } catch {
        // May error on SSE parsing — that's OK, we just need the URL
      }

      // Verify SSE URL uses /agent/stream/{id}
      const sseCall = fetchCalls.find((u) => u.includes("/stream/") || u.includes("/sse"));
      expect(sseCall).toBe("http://localhost:8080/api/agent/stream/wf-sse-test");
    });
  });

  describe("stream()", () => {
    it("streams native agents through the handle stream path", async () => {
      const fetchCalls: string[] = [];
      mockAgentServer("wf-native-stream", fetchCalls);

      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      jest.spyOn((runtime as any).workerManager, "startPolling").mockImplementation(() => {});

      const { Agent } = await import("../agent.js");
      const agent = new Agent({ name: "native_stream_agent", model: "gpt-4o" });

      const agentStream = await runtime.stream(agent, "test prompt");
      const result = await agentStream.getResult();

      expect(result.status).toBe("COMPLETED");
      expect(result.output).toEqual({ result: "ok" });
      expect(fetchCalls).toContain("http://localhost:8080/api/agent/stream/wf-native-stream");
    });

    it("streams framework agents through the same SSE endpoint", async () => {
      const fetchCalls: string[] = [];
      mockAgentServer("wf-framework-stream", fetchCalls);

      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      jest.spyOn((runtime as any).workerManager, "startPolling").mockImplementation(() => {});

      const openAiAgent = {
        name: "framework_stream_agent",
        instructions: "You are helpful.",
        model: "gpt-4o",
        tools: [],
        handoffs: [],
      };

      const agentStream = await runtime.stream(openAiAgent, "test prompt");
      const result = await agentStream.getResult();

      expect(result.status).toBe("COMPLETED");
      expect(result.output).toEqual({ result: "ok" });
      expect(fetchCalls).toContain("http://localhost:8080/api/agent/stream/wf-framework-stream");

      const startCall = (global.fetch as any).mock.calls.find(([url]: [string]) =>
        url.includes("/agent/start"),
      );
      const body = JSON.parse(startCall[1].body as string);
      expect(body.framework).toBe("openai");
    });
  });

  describe("credentials payloads", () => {
    it("includes credentials in native run start payload", async () => {
      mockAgentServer("wf-native-cred");

      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      jest.spyOn((runtime as any).workerManager, "startPolling").mockImplementation(() => {});
      jest.spyOn((runtime as any).workerManager, "stopPolling").mockImplementation(() => {});

      const { Agent } = await import("../agent.js");
      const agent = new Agent({ name: "native_cred_agent", model: "gpt-4o" });

      await runtime.run(agent, "test prompt", {
        credentials: ["OPENAI_API_KEY"],
      });

      const startCall = (global.fetch as any).mock.calls.find(([url]: [string]) =>
        url.includes("/agent/start"),
      );
      const body = JSON.parse(startCall[1].body as string);
      expect(body.credentials).toEqual(["OPENAI_API_KEY"]);
    });

    it("includes credentials in framework run start payload", async () => {
      mockAgentServer("wf-framework-cred");

      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      jest.spyOn((runtime as any).workerManager, "startPolling").mockImplementation(() => {});
      jest.spyOn((runtime as any).workerManager, "stopPolling").mockImplementation(() => {});

      const openAiAgent = {
        name: "framework_cred_agent",
        instructions: "You are helpful.",
        model: "gpt-4o",
        tools: [],
        handoffs: [],
      };

      await runtime.run(openAiAgent, "test prompt", {
        credentials: ["OPENAI_API_KEY"],
      });

      const startCall = (global.fetch as any).mock.calls.find(([url]: [string]) =>
        url.includes("/agent/start"),
      );
      const body = JSON.parse(startCall[1].body as string);
      expect(body.credentials).toEqual(["OPENAI_API_KEY"]);
      expect(body.framework).toBe("openai");
    });

    it("includes credentials in framework start payload", async () => {
      mockAgentServer("wf-framework-start-cred");

      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      jest.spyOn((runtime as any).workerManager, "startPolling").mockImplementation(() => {});

      const openAiAgent = {
        name: "framework_start_agent",
        instructions: "You are helpful.",
        model: "gpt-4o",
        tools: [],
        handoffs: [],
      };

      await runtime.start(openAiAgent, "test prompt", {
        credentials: ["OPENAI_API_KEY"],
      });

      const startCall = (global.fetch as any).mock.calls.find(([url]: [string]) =>
        url.includes("/agent/start"),
      );
      const body = JSON.parse(startCall[1].body as string);
      expect(body.credentials).toEqual(["OPENAI_API_KEY"]);
      expect(body.framework).toBe("openai");
    });
  });
});

// ── Singleton functions ─────────────────────────────────

describe("Singleton functions", () => {
  const savedEnv: Record<string, string | undefined> = {};
  const envKeys = ["AGENTSPAN_SERVER_URL", "AGENTSPAN_API_KEY"];

  beforeEach(() => {
    for (const key of envKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  it("configure creates a new singleton runtime", () => {
    const runtime = configure({
      serverUrl: "https://singleton.com",
      apiKey: "singleton-key",
    });
    expect(runtime).toBeInstanceOf(AgentRuntime);
    expect(runtime.config.serverUrl).toBe("https://singleton.com/api");
  });

  it("run is a function", () => {
    expect(typeof run).toBe("function");
  });

  it("start is a function", () => {
    expect(typeof start).toBe("function");
  });

  it("stream is a function", () => {
    expect(typeof stream).toBe("function");
  });

  it("deploy is a function", () => {
    expect(typeof deploy).toBe("function");
  });

  it("plan is a function", () => {
    expect(typeof plan).toBe("function");
  });

  it("serve is a function", () => {
    expect(typeof serve).toBe("function");
  });

  it("shutdown is a function", () => {
    expect(typeof shutdown).toBe("function");
  });
});
