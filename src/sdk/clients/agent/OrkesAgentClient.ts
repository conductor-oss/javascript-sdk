// Copyright (c) 2026 Agentspan
// Licensed under the MIT License. See LICENSE file in the project root for details.

/**
 * Conductor/Orkes implementation of {@link AgentClient}.
 *
 * On top of the raw `/agent/*` endpoints it adds agent-level convenience
 * methods — {@link OrkesAgentClient.run}, {@link OrkesAgentClient.start},
 * {@link OrkesAgentClient.deploy}, {@link OrkesAgentClient.schedule} — and a
 * {@link OrkesAgentClient.schedules} accessor for cron lifecycle.
 *
 * **Control-plane only.** {@link OrkesAgentClient.run} compiles + starts an
 * agent and polls to a result; it does NOT register or poll local tool
 * workers. Agents that use local `@tool` functions must run through
 * `AgentRuntime`. For LLM-only agents, remote tools (HTTP/MCP), or
 * pre-deployed workflows, this is enough.
 *
 * Built on a lazily-memoized {@link ConductorClient}. Every non-streaming
 * `/agent/*` call rides `client.request(...)` — the same authenticated call
 * path every generated resource client uses, inheriting token TTL refresh
 * and 401-retry for free (spec R1/R2). No token logic of its own.
 */

import { createConductorClient } from "../../createConductorClient";
import type { AgentResult, AgentStatus, DeploymentInfo, RunOptions } from "../../../agents/types.js";
import { AgentAPIError, AgentNotFoundError } from "../../../agents/errors.js";
import { AgentConfig } from "../../../agents/config.js";
import type { AgentConfigOptions } from "../../../agents/config.js";
import { Agent } from "../../../agents/agent.js";
import { AgentConfigSerializer } from "../../../agents/serializer.js";
import { detectFramework } from "../../../agents/frameworks/detect.js";
import { serializeFrameworkAgent } from "../../../agents/frameworks/serializer.js";
import { serializeLangGraph } from "../../../agents/frameworks/langgraph-serializer.js";
import { serializeLangChain } from "../../../agents/frameworks/langchain-serializer.js";
import { Schedule } from "./schedule.js";
import { SchedulerClient } from "../scheduler/SchedulerClient.js";
import { WorkflowClient } from "./WorkflowClient.js";
import { makeAgentResult, TERMINAL_STATUSES } from "../../../agents/result.js";
import { AgentStream } from "../../../agents/stream.js";
import type { AgentClient, ClientHandle, ConductorClient } from "./AgentClient.js";

export type { ConductorClient, ClientHandle } from "./AgentClient.js";

/** Auth security descriptor for every `/agent/*` call (matches the repo's existing `client.get(...)` convention). */
const AGENT_SECURITY = [{ name: "X-Authorization", type: "apiKey" as const }];

/** Default client-side ceiling for {@link OrkesAgentClient.run}/`wait()` when no `timeoutSeconds` is given. */
const DEFAULT_WAIT_MS = 600_000; // 10 min — mirrors the C# SDK's HttpClient cap

/**
 * {@link OrkesAgentClient} construction options: the agent config plus an
 * optional pre-built Conductor client to reuse (as handed out by
 * `OrkesClients`). The injected client must originate from
 * `createConductorClient` — it carries the `*Resource` members the workflow
 * client reads and the R2 auth accessors.
 */
export type AgentClientOptions = AgentConfigOptions & {
  client?: ConductorClient;
};

export class OrkesAgentClient implements AgentClient {
  readonly config: AgentConfig;

  private _clientPromise?: Promise<ConductorClient>;
  private _workflowClient?: WorkflowClient;
  private _scheduleClient?: SchedulerClient;
  private readonly serializer: AgentConfigSerializer;
  /** True when this instance built its own client (vs. reusing an injected one) — see {@link close}. */
  private readonly _ownsClient: boolean;
  private readonly _openStreams = new Set<AgentStream>();
  /**
   * The resolved client's real `baseUrl` (set once `getClient()` settles).
   * `ClientHandle.stream()` is synchronous by contract, so it reads this
   * cache rather than `this.config.serverUrl` — which, on the injected-client
   * path (`OrkesClients`), may not match the actual client's host.
   */
  private _resolvedBaseUrl?: string;

  constructor(options?: AgentClientOptions | AgentConfig) {
    if (options instanceof AgentConfig) {
      this.config = options;
      this._ownsClient = true;
    } else {
      const { client, ...configOptions } = options ?? {};
      this.config = new AgentConfig(configOptions);
      this._ownsClient = !client;
      // Pre-seed the memoized promise; getClient() then reuses the injected
      // client instead of building its own via createConductorClient.
      if (client) this._clientPromise = this._withResolvedBaseUrl(Promise.resolve(client));
    }
    this.serializer = new AgentConfigSerializer();
  }

  // ── Conductor client (lazy, memoized) ──────────────────────────────

  /**
   * Captures the client's real `baseUrl` once resolved (for
   * {@link _makeHandle}'s sync `stream()`), and — when `config.apiKey` is an
   * explicit already-minted token — wires it onto the client's own `auth` so
   * `client.request(...)` (the REST path) carries it too, not just
   * {@link authHeaders}'s SSE-only header map.
   */
  private _withResolvedBaseUrl(p: Promise<ConductorClient>): Promise<ConductorClient> {
    p.then((c) => {
      this._resolvedBaseUrl = c.getConfig().baseUrl as string | undefined;
      if (this.config.apiKey) {
        c.setConfig({ auth: this.config.apiKey });
      }
    });
    return p;
  }

  /**
   * Lazily create (once) and return the shared {@link ConductorClient}.
   * `createConductorClient` is async, so we memoize the promise.
   */
  getClient(): Promise<ConductorClient> {
    if (!this._clientPromise) {
      // Conductor SDK reads CONDUCTOR_SERVER_URL with priority; baseUrl is the
      // server root WITHOUT the trailing `/api` (agent endpoints add `/api`).
      const baseUrl = this.config.serverUrl.replace(/\/api\/?$/, "");
      this._clientPromise = this._withResolvedBaseUrl(
        createConductorClient({
          serverUrl: baseUrl,
          disableHttp2: true,
          keyId: this.config.authKey || undefined,
          keySecret: this.config.authSecret || undefined,
        }),
      );
    }
    return this._clientPromise;
  }

  /** Read-only workflow client over the shared Conductor client. */
  get workflows(): WorkflowClient {
    if (!this._workflowClient) {
      this._workflowClient = new WorkflowClient(
        () => this.getClient(),
        (executionId) => this.getExecution(executionId),
      );
    }
    return this._workflowClient;
  }

  /** Cron schedule lifecycle client (shares this client's Conductor client). */
  get schedules(): SchedulerClient {
    if (!this._scheduleClient) {
      this._scheduleClient = new SchedulerClient(this.getClient());
    }
    return this._scheduleClient;
  }

  // ── Auth ───────────────────────────────────────────────────────────

  /**
   * `X-Authorization` header for secured hosts (Orkes); `{}` when anonymous.
   *
   * An explicit `config.apiKey` (an already-minted token, not a keyId/secret
   * pair) wins verbatim — `getClient()` wires the same value onto the shared
   * client's own `auth` config, so `/agent/*` REST calls carry it too.
   * Otherwise borrowed verbatim from the shared client's R2 accessor — this
   * class mints and caches nothing of its own. Kept as a thin delegate
   * (rather than inlined at call sites) because the runtime's worker
   * plumbing still calls it directly until S2 removes that plumbing.
   */
  async authHeaders(): Promise<Record<string, string>> {
    if (this.config.apiKey) {
      return { "X-Authorization": this.config.apiKey };
    }
    const client = await this.getClient();
    const headers = await client.getAuthenticationHeaders();
    return headers ?? {};
  }

  // ── `/agent/*` transport ────────────────────────────────────────────
  //
  // Every non-streaming call rides `client.request(...)` — the exact call
  // path every generated resource client uses (`security` triggers the
  // shared client's TTL-aware auth callback + 401-retry). One error choke
  // point below maps non-OK responses.

  /**
   * Generic escape hatch for `/agent/*` operations without a dedicated named
   * method (e.g. `AgentRuntime`'s pause/resume/cancel, which aren't part of
   * the spec's 11-op {@link AgentClient} interface). Not part of that
   * interface itself — internal callers reach it via the concrete class.
   */
  async request(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
    signal?: AbortSignal,
    query?: Record<string, unknown>,
  ): Promise<unknown> {
    const client = await this.getClient();
    const { data, error, response } = await client.request({
      method,
      url: `/api${path}`,
      security: AGENT_SECURITY,
      body,
      query,
      signal,
      throwOnError: false,
    });
    if (!response.ok) {
      throw this._mapError(method, path, response, error);
    }
    return data ?? {};
  }

  private async _call(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    signal?: AbortSignal,
    query?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return (await this.request(method, path, body, signal, query)) as Record<string, unknown>;
  }

  private _mapError(method: string, path: string, response: Response, error: unknown): Error {
    const bodyText =
      typeof error === "string" ? error : error === undefined ? "" : JSON.stringify(error);
    if (response.status === 404) {
      return new AgentNotFoundError(path);
    }
    return new AgentAPIError(`HTTP ${method} ${path} failed: ${response.status}`, response.status, bodyText);
  }

  // ── Low-level `/agent/*` endpoints (spec R1) ───────────────────────

  /** POST /agent/start — start an agent execution. */
  async startAgent(payload: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> {
    return this._call("POST", "/agent/start", payload, signal);
  }

  /** POST /agent/deploy — compile + register (no execution). */
  async deployAgent(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this._call("POST", "/agent/deploy", payload);
  }

  /** POST /agent/compile — compile agent config to a workflow def. */
  async compile(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this._call("POST", "/agent/compile", payload);
  }

  /** GET /agent/{id}/status — current execution status. */
  async status(executionId: string, signal?: AbortSignal): Promise<AgentStatus> {
    const r = await this._call("GET", `/agent/${executionId}/status`, undefined, signal);
    return r as unknown as AgentStatus;
  }

  /** POST /agent/{id}/respond — complete a pending human task. */
  async respond(executionId: string, body: unknown, signal?: AbortSignal): Promise<void> {
    await this._call("POST", `/agent/${executionId}/respond`, body, signal);
  }

  /** GET /agent/execution/{id} — full execution data (tasks, output, tokens). */
  async getExecution(executionId: string, signal?: AbortSignal): Promise<Record<string, unknown> | null> {
    try {
      return await this._call("GET", `/agent/execution/${executionId}`, undefined, signal);
    } catch (e) {
      // Non-fatal: execution reads feed token accounting, not control flow.
      // Surface at debug so a silent null is diagnosable.
      console.debug(`getExecution(${executionId}) failed: ${(e as Error).message}`);
      return null;
    }
  }

  /** GET /agent/executions — list executions, optionally filtered. */
  async listExecutions(
    params?: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    return this._call("GET", "/agent/executions", undefined, signal, params);
  }

  /** POST /agent/{id}/stop — stop a running execution. */
  async stop(executionId: string, signal?: AbortSignal): Promise<void> {
    await this._call("POST", `/agent/${executionId}/stop`, undefined, signal);
  }

  /** POST /agent/{id}/signal — inject persistent context into a running execution. */
  async signal(executionId: string, message: string, signal?: AbortSignal): Promise<void> {
    await this._call("POST", `/agent/${executionId}/signal`, { message }, signal);
  }

  /** A connected {@link AgentStream} for an execution's SSE feed. */
  async stream(executionId: string, lastEventId?: string, signal?: AbortSignal): Promise<AgentStream> {
    const baseUrl = await this._httpBaseUrl();
    // AgentStream's polling-fallback paths append `/agent/...` directly, so
    // `serverUrl` carries the `/api` prefix (matches the historical contract).
    const apiBaseUrl = `${baseUrl}/api`;
    const s = new AgentStream(
      `${apiBaseUrl}/agent/stream/${executionId}`,
      () => this.authHeaders(),
      executionId,
      async (body) => this.respond(executionId, body, signal),
      apiBaseUrl,
      lastEventId,
    );
    this._openStreams.add(s);
    return s;
  }

  /**
   * Release this client's open {@link AgentStream}s; stops this instance's
   * background token refresh iff it built its own client (an injected
   * client — the `OrkesClients` path — outlives this instance and is not
   * ours to stop).
   */
  async close(): Promise<void> {
    for (const s of this._openStreams) {
      s.close();
    }
    this._openStreams.clear();
    if (this._ownsClient) {
      const client = await this.getClient();
      client.stopBackgroundRefresh();
    }
  }

  private async _httpBaseUrl(): Promise<string> {
    await this.getClient();
    return this._resolvedBaseUrl ?? this.config.serverUrl.replace(/\/api\/?$/, "");
  }

  /**
   * Synchronous best-effort base URL for {@link ClientHandle.stream}, which
   * is sync by contract. By the time a handle exists, `start()` has already
   * awaited `getClient()` at least once, so `_resolvedBaseUrl` is populated
   * in every real call path; the config fallback only applies to
   * hand-constructed handles in tests.
   */
  private _httpBaseUrlSync(): string {
    return this._resolvedBaseUrl ?? this.config.serverUrl.replace(/\/api\/?$/, "");
  }

  // ── Agent-level convenience (control-plane only — NO local workers) ─

  /**
   * Compile + start an agent, then poll to an {@link AgentResult}.
   *
   * **Control-plane only** — does NOT register or poll local tool workers.
   * Use `AgentRuntime.run` for agents with local `@tool` functions.
   */
  async run(agent: Agent | object, prompt: string, opts?: RunOptions): Promise<AgentResult> {
    const handle = await this.start(agent, prompt, opts);
    return handle.wait();
  }

  /** Compile + start an agent; return a {@link ClientHandle}. No workers. */
  async start(agent: Agent | object, prompt: string, opts?: RunOptions): Promise<ClientHandle> {
    const framework = detectFramework(agent);
    let payload: Record<string, unknown>;
    if (framework !== null) {
      const [rawConfig] = this._serializeFramework(agent, framework);
      payload = { framework, rawConfig, prompt };
    } else {
      payload = this.serializer.serialize(agent as Agent, prompt, {
        sessionId: opts?.sessionId,
        media: opts?.media,
        idempotencyKey: opts?.idempotencyKey,
      });
    }
    if (opts?.timeoutSeconds !== undefined) payload.timeoutSeconds = opts.timeoutSeconds;
    if (opts?.credentials) payload.credentials = opts.credentials;
    if (opts?.context) payload.context = opts.context;
    if (opts?.plan !== undefined) {
      const { coercePlan } = await import("../../../agents/plans.js");
      payload.static_plan = coercePlan(opts.plan as Parameters<typeof coercePlan>[0]);
    }

    const startResponse = await this.startAgent(payload, opts?.signal);
    const executionId = startResponse.executionId as string;
    return this._makeHandle(executionId, opts?.signal, opts?.timeoutSeconds);
  }

  /** Compile + register one or more agents (no execution, no workers). */
  async deploy(...agents: (Agent | object)[]): Promise<DeploymentInfo[]> {
    if (agents.length === 0) throw new Error("deploy() requires at least one agent.");
    const results: DeploymentInfo[] = [];
    for (const agent of agents) {
      const framework = detectFramework(agent);
      let payload: Record<string, unknown>;
      if (framework !== null) {
        const [rawConfig] = this._serializeFramework(agent, framework);
        payload = { framework, rawConfig };
      } else {
        payload = this.serializer.serialize(agent as Agent);
      }
      const data = await this.deployAgent(payload);
      results.push(data as unknown as DeploymentInfo);
    }
    return results;
  }

  /**
   * Deploy *agent* and reconcile its cron *schedules* declaratively.
   *
   * Upserts the listed schedules and prunes the others; `[]` purges all;
   * `null`/`undefined` leaves them untouched. Reuses the {@link SchedulerClient}.
   */
  async schedule(
    agent: Agent | object,
    schedules: Schedule[] | null | undefined,
  ): Promise<DeploymentInfo> {
    const info = (await this.deploy(agent))[0];
    const agentName = (agent as Agent).name ?? info.agentName;
    if (!agentName) {
      throw new Error("schedule(...) requires the agent to have a name");
    }
    await this.schedules.reconcile(agentName, schedules);
    return info;
  }

  // ── Internal ───────────────────────────────────────────────────────

  private _serializeFramework(
    agent: object,
    framework: string,
  ): [Record<string, unknown>, unknown[]] {
    if (framework === "langgraph") return serializeLangGraph(agent);
    if (framework === "langchain") return serializeLangChain(agent);
    return serializeFrameworkAgent(agent);
  }

  private _makeHandle(executionId: string, signal?: AbortSignal, timeoutSeconds?: number): ClientHandle {
    return {
      executionId,
      getStatus: () => this.status(executionId, signal),
      respond: (output) => this.respond(executionId, output, signal),
      approve: (output) => this.respond(executionId, { approved: true, ...output }, signal),
      reject: (reason) => this.respond(executionId, { approved: false, reason }, signal),
      send: (message) => this.respond(executionId, { message }, signal),
      stop: async () => {
        await this.stop(executionId, signal);
        // Best-effort unblock for any pending wait — failures are swallowed
        // (the stop above already terminated the execution).
        try {
          await this.signal(executionId, "stopped", signal);
        } catch {
          // Non-fatal.
        }
      },
      stream: () => {
        const apiBaseUrl = `${this._httpBaseUrlSync()}/api`;
        const s = new AgentStream(
          `${apiBaseUrl}/agent/stream/${executionId}`,
          () => this.authHeaders(),
          executionId,
          async (body) => this.respond(executionId, body, signal),
          apiBaseUrl,
        );
        this._openStreams.add(s);
        return s;
      },
      wait: async (pollIntervalMs = 500) => {
        const deadline =
          Date.now() + (timeoutSeconds ? timeoutSeconds * 1000 + 30_000 : DEFAULT_WAIT_MS);
        for (;;) {
          const status = await this.status(executionId, signal);
          if (TERMINAL_STATUSES.has(status.status)) {
            const resultData: Parameters<typeof makeAgentResult>[0] = {
              output: status.output,
              executionId,
              status: status.status,
            };
            try {
              const tokenUsage = await this.workflows.extractTokenUsage(executionId);
              if (tokenUsage) resultData.tokenUsage = tokenUsage;
            } catch {
              // Non-critical.
            }
            return makeAgentResult(resultData);
          }
          if (Date.now() >= deadline) {
            throw new AgentAPIError(
              `wait() timed out for execution ${executionId} (last status: ${status.status})`,
              0,
              "",
            );
          }
          await new Promise((r) => setTimeout(r, pollIntervalMs));
        }
      },
    };
  }
}
