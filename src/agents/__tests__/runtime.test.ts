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
import { LivenessMonitor } from "../liveness.js";
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
    it("creates with default config (zero-arg — 232 example constructions rely on this)", () => {
      const runtime = new AgentRuntime();
      expect(runtime.config).toBeInstanceOf(AgentConfig);
      expect(runtime.config.workerThreadCount).toBe(1);
      expect(runtime.config.autoStartWorkers).toBe(true);
    });

    it("settings (2nd param) apply behavior knobs; configuration (1st param) is connection-only", () => {
      const runtime = new AgentRuntime(
        { serverUrl: "https://custom.com" },
        { workerThreadCount: 4, autoStartWorkers: false },
      );
      expect(runtime.config.workerThreadCount).toBe(4);
      expect(runtime.config.autoStartWorkers).toBe(false);
    });

    it("resolves the connection config against the shared client (verified via _httpRequest URL)", async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({}));
      const runtime = new AgentRuntime({ serverUrl: "https://custom.com" });

      await runtime._httpRequest("GET", "/test");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://custom.com/api/test",
        expect.anything(),
      );
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

    it("mints a JWT from keyId/keySecret and sends X-Authorization", async () => {
      mockedGenerateToken.mockResolvedValue(tokenSuccess("minted-jwt"));
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({}));

      const runtime = new AgentRuntime({
        keyId: "my-auth-key",
        keySecret: "my-auth-secret",
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

  describe("RunSettings (spec R8)", () => {
    it("run(): full override lands in the start payload", async () => {
      mockAgentServer("wf-rs-full");
      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      jest.spyOn((runtime as any).workerManager, "startPolling").mockImplementation(() => {});
      jest.spyOn((runtime as any).workerManager, "stopPolling").mockImplementation(() => {});
      const { Agent } = await import("../agent.js");
      const agent = new Agent({ name: "rs_full_agent", model: "gpt-4o", temperature: 0.5 });

      await runtime.run(agent, "test prompt", {
        runSettings: {
          model: "anthropic/claude-sonnet-4-6",
          temperature: 0.9,
          maxTokens: 2048,
          reasoningEffort: "high",
          thinkingBudgetTokens: 1024,
        },
      });

      const startCall = (global.fetch as any).mock.calls.find(([url]: [string]) =>
        url.includes("/agent/start"),
      );
      const body = JSON.parse(startCall[1].body as string);
      expect(body.agentConfig.model).toBe("anthropic/claude-sonnet-4-6");
      expect(body.agentConfig.temperature).toBe(0.9);
      expect(body.agentConfig.maxTokens).toBe(2048);
      expect(body.agentConfig.reasoningEffort).toBe("high");
      expect(body.agentConfig.thinkingConfig).toEqual({ enabled: true, budgetTokens: 1024 });
    });

    it("no runSettings → payload equals the agent's own settings", async () => {
      mockAgentServer("wf-rs-none");
      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      jest.spyOn((runtime as any).workerManager, "startPolling").mockImplementation(() => {});
      jest.spyOn((runtime as any).workerManager, "stopPolling").mockImplementation(() => {});
      const { Agent } = await import("../agent.js");
      const agent = new Agent({ name: "rs_none_agent", model: "gpt-4o", temperature: 0.5 });

      await runtime.run(agent, "test prompt");

      const startCall = (global.fetch as any).mock.calls.find(([url]: [string]) =>
        url.includes("/agent/start"),
      );
      const body = JSON.parse(startCall[1].body as string);
      expect(body.agentConfig.model).toBe("gpt-4o");
      expect(body.agentConfig.temperature).toBe(0.5);
      expect(body.agentConfig.thinkingConfig).toBeUndefined();
    });

    it("partial override changes only provided fields; temperature: 0 applies", async () => {
      mockAgentServer("wf-rs-partial");
      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      jest.spyOn((runtime as any).workerManager, "startPolling").mockImplementation(() => {});
      jest.spyOn((runtime as any).workerManager, "stopPolling").mockImplementation(() => {});
      const { Agent } = await import("../agent.js");
      const agent = new Agent({
        name: "rs_partial_agent",
        model: "gpt-4o",
        temperature: 0.5,
        maxTokens: 100,
      });

      await runtime.run(agent, "test prompt", { runSettings: { temperature: 0 } });

      const startCall = (global.fetch as any).mock.calls.find(([url]: [string]) =>
        url.includes("/agent/start"),
      );
      const body = JSON.parse(startCall[1].body as string);
      expect(body.agentConfig.temperature).toBe(0);
      expect(body.agentConfig.model).toBe("gpt-4o");
      expect(body.agentConfig.maxTokens).toBe(100);
    });

    it("start(): forwards runSettings to the same start flow", async () => {
      mockAgentServer("wf-rs-start");
      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      jest.spyOn((runtime as any).workerManager, "startPolling").mockImplementation(() => {});
      const { Agent } = await import("../agent.js");
      const agent = new Agent({ name: "rs_start_agent", model: "gpt-4o" });

      await runtime.start(agent, "test prompt", { runSettings: { model: "openai/gpt-5" } });

      const startCall = (global.fetch as any).mock.calls.find(([url]: [string]) =>
        url.includes("/agent/start"),
      );
      const body = JSON.parse(startCall[1].body as string);
      expect(body.agentConfig.model).toBe("openai/gpt-5");
    });

    it("throws on an unknown RunSettings key", async () => {
      mockAgentServer("wf-rs-unknown");
      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      jest.spyOn((runtime as any).workerManager, "startPolling").mockImplementation(() => {});
      const { Agent } = await import("../agent.js");
      const agent = new Agent({ name: "rs_unknown_agent", model: "gpt-4o" });

      await expect(
        runtime.run(agent, "test prompt", { runSettings: { topP: 0.9 } as any }),
      ).rejects.toThrow(/Unknown RunSettings key/);
    });

    it("RunOptions.model is sugar for runSettings.model on the native path", async () => {
      mockAgentServer("wf-rs-model-sugar");
      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      jest.spyOn((runtime as any).workerManager, "startPolling").mockImplementation(() => {});
      jest.spyOn((runtime as any).workerManager, "stopPolling").mockImplementation(() => {});
      const { Agent } = await import("../agent.js");
      const agent = new Agent({ name: "rs_model_sugar_agent", model: "gpt-4o" });

      await runtime.run(agent, "test prompt", { model: "anthropic/claude-sonnet-4-6" });

      const startCall = (global.fetch as any).mock.calls.find(([url]: [string]) =>
        url.includes("/agent/start"),
      );
      const body = JSON.parse(startCall[1].body as string);
      expect(body.agentConfig.model).toBe("anthropic/claude-sonnet-4-6");
    });

    it("explicit runSettings.model wins over RunOptions.model when both are set (native path)", async () => {
      mockAgentServer("wf-rs-model-precedence");
      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      jest.spyOn((runtime as any).workerManager, "startPolling").mockImplementation(() => {});
      jest.spyOn((runtime as any).workerManager, "stopPolling").mockImplementation(() => {});
      const { Agent } = await import("../agent.js");
      const agent = new Agent({ name: "rs_model_precedence_agent", model: "gpt-4o" });

      await runtime.run(agent, "test prompt", {
        model: "openai/gpt-5",
        runSettings: { model: "anthropic/claude-sonnet-4-6" },
      });

      const startCall = (global.fetch as any).mock.calls.find(([url]: [string]) =>
        url.includes("/agent/start"),
      );
      const body = JSON.parse(startCall[1].body as string);
      expect(body.agentConfig.model).toBe("anthropic/claude-sonnet-4-6");
    });

    it("runSettings.model wins over RunOptions.model when resolving the framework path's model option", async () => {
      mockAgentServer("wf-rs-model-framework");
      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      jest.spyOn((runtime as any).workerManager, "startPolling").mockImplementation(() => {});
      jest.spyOn((runtime as any).workerManager, "stopPolling").mockImplementation(() => {});
      const serializeSpy = jest.spyOn(runtime as any, "_serializeFramework");

      const openAiAgent = {
        name: "rs_framework_agent",
        instructions: "You are helpful.",
        model: "gpt-4o",
        tools: [],
        handoffs: [],
      };

      await runtime.run(openAiAgent, "test prompt", {
        model: "openai/gpt-5",
        runSettings: { model: "anthropic/claude-sonnet-4-6" },
      });

      expect(serializeSpy).toHaveBeenCalledWith(
        openAiAgent,
        "openai",
        expect.objectContaining({ model: "anthropic/claude-sonnet-4-6" }),
      );
    });
  });

  describe("AgentHandle.stop() (spec T6)", () => {
    it("calls client.stop then best-effort client.signal, swallowing signal failures", async () => {
      mockAgentServer("wf-stop-test");
      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      jest.spyOn((runtime as any).workerManager, "startPolling").mockImplementation(() => {});
      const stopSpy = jest.spyOn(runtime.client, "stop").mockResolvedValue(undefined);
      const signalSpy = jest
        .spyOn(runtime.client, "signal")
        .mockRejectedValue(new Error("signal failed"));

      const { Agent } = await import("../agent.js");
      const agent = new Agent({ name: "stop_test_agent", model: "gpt-4o" });
      const handle = await runtime.start(agent, "test prompt");

      await expect(handle.stop()).resolves.toBeUndefined();

      expect(stopSpy).toHaveBeenCalledWith("wf-stop-test", undefined);
      expect(signalSpy).toHaveBeenCalledWith("wf-stop-test", "stopped", undefined);
    });

    it("also wires stop() on framework-agent handles", async () => {
      mockAgentServer("wf-stop-framework-test");
      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      jest.spyOn((runtime as any).workerManager, "startPolling").mockImplementation(() => {});
      const stopSpy = jest.spyOn(runtime.client, "stop").mockResolvedValue(undefined);
      jest.spyOn(runtime.client, "signal").mockResolvedValue(undefined);

      const openAiAgent = {
        name: "stop_framework_agent",
        instructions: "You are helpful.",
        model: "gpt-4o",
        tools: [],
        handoffs: [],
      };
      const handle = await runtime.start(openAiAgent, "test prompt");

      await handle.stop();

      expect(stopSpy).toHaveBeenCalledWith("wf-stop-framework-test", undefined);
    });
  });

  describe("deploy() (spec R9)", () => {
    it("single-agent form deploys and returns a DeploymentInfo (3 active example calls compile unchanged)", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(jsonResponse({ agentName: "a", workflowName: "wf_a" }));
      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      const { Agent } = await import("../agent.js");
      const agent = new Agent({ name: "a", model: "gpt-4o" });

      const info = await runtime.deploy(agent);

      expect(info).toEqual({ agentName: "a", workflowName: "wf_a" });
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8080/api/agent/deploy",
        expect.anything(),
      );
    });

    it("variadic form deploys each agent and returns an array", async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({ agentName: "x" }));
      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      const { Agent } = await import("../agent.js");
      const a = new Agent({ name: "a", model: "gpt-4o" });
      const b = new Agent({ name: "b", model: "gpt-4o" });

      const infos = await runtime.deploy(a, b);

      expect(Array.isArray(infos)).toBe(true);
      expect(infos).toHaveLength(2);
      const deployCalls = (global.fetch as any).mock.calls.filter(([url]: [string]) =>
        String(url).includes("/agent/deploy"),
      );
      expect(deployCalls).toHaveLength(2);
    });

    it("single-agent form with {schedules} reconciles via SchedulerClient", async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({ agentName: "a" }));
      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      const { Agent } = await import("../agent.js");
      const agent = new Agent({ name: "a", model: "gpt-4o" });
      const reconcile = jest.fn().mockResolvedValue(undefined);
      jest.spyOn(runtime, "schedulesClient").mockReturnValue({ reconcile } as any);

      await runtime.deploy(agent, { schedules: [] });

      expect(reconcile).toHaveBeenCalledWith("a", []);
    });
  });

  describe("serve() (spec R9)", () => {
    it("deploys before starting workers, then returns when blocking:false", async () => {
      const order: string[] = [];
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (String(url).includes("/agent/deploy")) order.push("deploy");
        return jsonResponse({});
      });
      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      jest.spyOn((runtime as any).workerManager, "startPolling").mockImplementation(async () => {
        order.push("startPolling");
      });

      const { Agent } = await import("../agent.js");
      const agent = new Agent({ name: "serve_order_agent", model: "gpt-4o" });

      await expect(runtime.serve(agent, { blocking: false })).resolves.toBeUndefined();

      expect(order).toEqual(["deploy", "startPolling"]);
    });

    it("deploys once per agent when multiple agents are served", async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({}));
      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      jest.spyOn((runtime as any).workerManager, "startPolling").mockImplementation(async () => {});

      const { Agent } = await import("../agent.js");
      const a = new Agent({ name: "serve_multi_a", model: "gpt-4o" });
      const b = new Agent({ name: "serve_multi_b", model: "gpt-4o" });

      await runtime.serve(a, b, { blocking: false });

      const deployCalls = (global.fetch as any).mock.calls.filter(([url]: [string]) =>
        String(url).includes("/agent/deploy"),
      );
      expect(deployCalls).toHaveLength(2);
    });

    it("treats a trailing {blocking:false} object as ServeOptions, not a second agent", async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({}));
      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      const startPolling = jest
        .spyOn((runtime as any).workerManager, "startPolling")
        .mockImplementation(async () => {});
      const { Agent } = await import("../agent.js");
      const agent = new Agent({ name: "serve_duck_agent", model: "gpt-4o" });

      await runtime.serve(agent, { blocking: false });

      const deployCalls = (global.fetch as any).mock.calls.filter(([url]: [string]) =>
        String(url).includes("/agent/deploy"),
      );
      expect(deployCalls).toHaveLength(1);
      expect(startPolling).toHaveBeenCalled();
    });

    it("does not misclassify a second real Agent as ServeOptions", async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({}));
      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      jest.spyOn((runtime as any).workerManager, "startPolling").mockImplementation(async () => {});
      const { Agent } = await import("../agent.js");
      const a = new Agent({ name: "serve_real_a", model: "gpt-4o" });
      const b = new Agent({ name: "serve_real_b", model: "gpt-4o" });

      await runtime.serve(a, b, { blocking: false });

      const deployCalls = (global.fetch as any).mock.calls.filter(([url]: [string]) =>
        String(url).includes("/agent/deploy"),
      );
      expect(deployCalls).toHaveLength(2);
    });
  });

  describe("Liveness monitor wiring (spec R11)", () => {
    // LivenessMonitor.prototype spies must be restored — unlike the
    // per-instance spies elsewhere in this file, a prototype spy leaks into
    // every later test (clearMocks resets call history, not implementations).
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("starts a LivenessMonitor for a stateful agent and stops it on completion", async () => {
      mockAgentServer("wf-liveness-test");
      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      jest.spyOn((runtime as any).workerManager, "startPolling").mockImplementation(() => {});
      const startSpy = jest.spyOn(LivenessMonitor.prototype, "start").mockImplementation(() => {});
      const stopSpy = jest.spyOn(LivenessMonitor.prototype, "stop").mockImplementation(() => {});
      const { Agent } = await import("../agent.js");
      const agent = new Agent({ name: "liveness_test_agent", model: "gpt-4o", stateful: true });

      const handle = await runtime.start(agent, "test prompt");
      expect(startSpy).toHaveBeenCalledTimes(1);

      await handle.wait();
      expect(stopSpy).toHaveBeenCalled();
    });

    it("does not start a LivenessMonitor for a non-stateful agent (no domain to watch)", async () => {
      mockAgentServer("wf-liveness-stateless-test");
      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      jest.spyOn((runtime as any).workerManager, "startPolling").mockImplementation(() => {});
      const startSpy = jest.spyOn(LivenessMonitor.prototype, "start").mockImplementation(() => {});
      const { Agent } = await import("../agent.js");
      const agent = new Agent({ name: "stateless_test_agent", model: "gpt-4o" });

      await runtime.start(agent, "test prompt");
      expect(startSpy).not.toHaveBeenCalled();
    });

    it("does not start a LivenessMonitor when livenessEnabled is false, even for a stateful agent", async () => {
      mockAgentServer("wf-liveness-disabled-test");
      const runtime = new AgentRuntime(
        { serverUrl: "http://localhost:8080/api" },
        { livenessEnabled: false },
      );
      jest.spyOn((runtime as any).workerManager, "startPolling").mockImplementation(() => {});
      const startSpy = jest.spyOn(LivenessMonitor.prototype, "start").mockImplementation(() => {});
      const { Agent } = await import("../agent.js");
      const agent = new Agent({ name: "liveness_disabled_agent", model: "gpt-4o", stateful: true });

      await runtime.start(agent, "test prompt");
      expect(startSpy).not.toHaveBeenCalled();
    });

    it("wait() rejects with WorkerStallError once the monitor detects a genuine stall", async () => {
      let capturedRunId: string | undefined;
      global.fetch = jest.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (String(url).includes("/agent/start")) {
          capturedRunId = JSON.parse(String(init?.body ?? "{}")).runId;
          return jsonResponse({ executionId: "wf-stall-test" });
        }
        if (String(url).includes("/status")) {
          return jsonResponse({ status: "RUNNING", output: {} });
        }
        return jsonResponse({});
      });
      const runtime = new AgentRuntime(
        { serverUrl: "http://localhost:8080/api" },
        { livenessStallSeconds: 0.05, livenessCheckIntervalSeconds: 0.05 },
      );
      jest.spyOn((runtime as any).workerManager, "startPolling").mockImplementation(() => {});
      const { Agent } = await import("../agent.js");
      const agent = new Agent({ name: "stall_test_agent", model: "gpt-4o", stateful: true });

      const handle = await runtime.start(agent, "test prompt");
      expect(capturedRunId).toBeTruthy();

      jest.spyOn(runtime.workflows, "getWorkflow").mockResolvedValue({
        status: "RUNNING",
        tasks: [
          {
            status: "SCHEDULED",
            domain: capturedRunId,
            pollCount: 0,
            taskId: "task-9",
            taskDefName: "some_tool",
            scheduledTime: Date.now() - 1000,
          },
        ],
      });

      await expect(handle.wait()).rejects.toThrow(/Worker stall detected/);
    });
  });

  describe("wait() deadline (spec R11)", () => {
    it("throws AgentAPIError naming the last status once the deadline elapses", async () => {
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (String(url).includes("/agent/start")) {
          return jsonResponse({ executionId: "wf-deadline-test" });
        }
        if (String(url).includes("/status")) {
          return jsonResponse({ status: "RUNNING", output: {} });
        }
        return jsonResponse({});
      });
      const runtime = new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
      jest.spyOn((runtime as any).workerManager, "startPolling").mockImplementation(() => {});
      const { Agent } = await import("../agent.js");
      const agent = new Agent({ name: "deadline_test_agent", model: "gpt-4o" });

      const handle = await runtime.start(agent, "test prompt", { timeoutSeconds: 5 });

      jest.useFakeTimers();
      try {
        const assertion = expect(handle.wait()).rejects.toThrow(
          /wait\(\) timed out for execution wf-deadline-test \(last status: RUNNING\)/,
        );
        await jest.advanceTimersByTimeAsync(40_000); // deadline = 5*1000 + 30_000
        await assertion;
      } finally {
        jest.useRealTimers();
      }
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
    const runtime = configure({ serverUrl: "https://singleton.com" }, { workerThreadCount: 2 });
    expect(runtime).toBeInstanceOf(AgentRuntime);
    expect(runtime.config.workerThreadCount).toBe(2);
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
