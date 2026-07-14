import type {
  AgentResult,
  AgentEvent,
  AgentStatus,
  DeploymentInfo,
  RunOptions,
  ToolDef,
  GuardrailDef,
  FrameworkId,
} from "./types.js";
import { AgentspanError, AgentAPIError, WorkerStallError } from "./errors.js";
import { LivenessMonitor } from "./liveness.js";
import { AgentConfig } from "./config.js";
import type { AgentConfigOptions } from "./config.js";
import { Agent } from "./agent.js";
import type { CallbackHandler } from "./agent.js";
import { AgentConfigSerializer } from "./serializer.js";
import { getToolDef } from "./tool.js";
import { WorkerManager } from "./worker.js";
import { AgentStream } from "./stream.js";
import { makeAgentResult } from "./result.js";
import { TERMINAL_STATUSES } from "./result.js";
import type { TerminationCondition } from "./termination.js";
import type { HandoffContext } from "./handoff.js";
import { detectFramework } from "./frameworks/detect.js";
import type { Schedule } from "../sdk/clients/agent/schedule.js";
import type { SchedulerClient } from "../sdk/clients/scheduler/SchedulerClient.js";
import type { OrkesApiConfig } from "../sdk/types.js";
import type { AgentClient, ConductorClient } from "../sdk/clients/agent/AgentClient.js";
import { OrkesAgentClient } from "../sdk/clients/agent/OrkesAgentClient.js";
import { WorkflowClient } from "../sdk/clients/agent/WorkflowClient.js";
import { serializeFrameworkAgent } from "./frameworks/serializer.js";
import { serializeLangGraph } from "./frameworks/langgraph-serializer.js";
import { serializeLangChain } from "./frameworks/langchain-serializer.js";
import { createSkillWorkers } from "./skill.js";
import { applyRunSettings } from "./run-settings.js";
import type { RunSettings } from "./run-settings.js";

/**
 * Callback method → wire position mapping (must match serializer.ts).
 */
const CALLBACK_POSITION_MAP: Record<string, string> = {
  onAgentStart: "before_agent",
  onAgentEnd: "after_agent",
  onModelStart: "before_model",
  onModelEnd: "after_model",
  onToolStart: "before_tool",
  onToolEnd: "after_tool",
};

type CallbackCallable = (agentName: string, data: unknown) => unknown | Promise<unknown>;
type WorkerCallable = (inputData: Record<string, unknown>) => unknown | Promise<unknown>;

// ── AgentHandle ─────────────────────────────────────────

/**
 * Handle to a running agent workflow.
 * Returned by `start()` for async interaction.
 */
export interface AgentHandle {
  readonly executionId: string;
  readonly correlationId: string;
  getStatus(): Promise<AgentStatus>;
  wait(pollIntervalMs?: number): Promise<AgentResult>;
  respond(output: unknown): Promise<void>;
  approve(output?: Record<string, unknown>): Promise<void>;
  reject(reason?: string): Promise<void>;
  send(message: string): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  cancel(): Promise<void>;
  stop(): Promise<void>;
  stream(): AgentStream;
}

// ── serve() options ─────────────────────────────────────

/** Trailing options accepted by `serve(...agents, options?)`. */
export interface ServeOptions {
  /** `false` returns once agents are deployed, workers registered, and polling started (default: blocks until SIGINT/SIGTERM). */
  blocking?: boolean;
}

const SERVE_OPTIONS_KEYS = new Set(["blocking"]);
const DEPLOY_OPTS_KEYS = new Set(["schedules"]);

/** Default client-side ceiling for a handle's `wait()` when no `timeoutSeconds` is given (mirrors `OrkesAgentClient`'s `ClientHandle.wait`). */
const DEFAULT_WAIT_MS = 600_000;

/**
 * True iff `x` is a plain options object rather than an agent — a native
 * `Agent` or a framework agent object has far more (or framework-detected)
 * shape, so `detectFramework` returning non-null and the keys-subset check
 * both have to hold before we treat a trailing arg as options (design DD10's
 * misclassification guard).
 */
function _isPlainOptionsObject(x: unknown, allowedKeys: Set<string>): boolean {
  if (x == null || typeof x !== "object" || Array.isArray(x)) return false;
  if (x instanceof Agent) return false;
  if (detectFramework(x) !== null) return false;
  return Object.keys(x).every((k) => allowedKeys.has(k));
}

function _isServeOptions(x: unknown): x is ServeOptions {
  return _isPlainOptionsObject(x, SERVE_OPTIONS_KEYS);
}

function _isDeployOpts(x: unknown): x is { schedules?: Schedule[] | null } {
  return _isPlainOptionsObject(x, DEPLOY_OPTS_KEYS);
}

/**
 * Resolve the effective per-run `RunSettings`, folding `RunOptions.model` in
 * as `runSettings.model` sugar — an explicit `runSettings.model` wins when
 * both are set (spec R8).
 */
function _resolveRunSettings(options?: RunOptions): RunSettings {
  const rs = options?.runSettings;
  const modelFallback = typeof options?.model === "string" ? options.model : undefined;
  return { ...rs, model: rs?.model ?? modelFallback };
}

// ── AgentRuntime ────────────────────────────────────────

/**
 * Core execution runtime for the Agentspan SDK.
 * Manages agent lifecycle: run, start, stream, deploy, plan, serve.
 */
export class AgentRuntime {
  readonly config: AgentConfig;
  /** Control-plane client for `/agent/*` (spec R1 surface — 11 ops + close()). */
  readonly client: AgentClient;
  /** Full surface (workflows/schedules/convenience methods/escape-hatch request()) for internal use. */
  private readonly _agentClient: OrkesAgentClient;
  private readonly serializer: AgentConfigSerializer;
  private readonly workerManager: WorkerManager;

  /**
   * @param configuration a connection config to build the shared client from,
   *   or an already-built {@link ConductorClient} to reuse (the
   *   `OrkesClients` injection pattern). Env-resolved when omitted
   *   (`AGENTSPAN_SERVER_URL`/`AGENTSPAN_AUTH_KEY`/`AGENTSPAN_AUTH_SECRET`
   *   fallbacks, `localhost:8080` default — spec R3).
   * @param settings behavior knobs only (spec R4) — no connection/auth here.
   */
  constructor(configuration?: OrkesApiConfig | ConductorClient, settings?: AgentConfigOptions) {
    this.config = new AgentConfig(settings);
    const agentClient = new OrkesAgentClient(configuration);
    this._agentClient = agentClient;
    this.client = agentClient;
    this.serializer = new AgentConfigSerializer();
    // One client, both planes (spec R5) — the worker plane rides the exact
    // same shared client the control plane does.
    this.workerManager = new WorkerManager(
      () => agentClient.getClient(),
      this.config.workerPollIntervalMs,
      this.config.workerThreadCount,
    );
  }

  /** Read-only workflow client (Conductor workflow executions). */
  get workflows(): WorkflowClient {
    return this._agentClient.workflows;
  }

  // ── run() ─────────────────────────────────────────────

  /**
   * Run an agent synchronously: start, register workers, stream events, return result.
   * Accepts native Agent instances or framework agent objects (Vercel AI, LangGraph, etc.).
   */
  async run(agent: Agent | object, prompt: string, options?: RunOptions): Promise<AgentResult> {
    const framework = detectFramework(agent);
    if (framework !== null) {
      return this._runFramework(agent, prompt, framework, options);
    }

    // Native Agent path — safe to cast since detectFramework returned null for non-Agent
    const nativeAgent = agent as Agent;
    const correlationId = generateCorrelationId();

    // Pre-deploy any skill agents nested inside agent_tool wrappers
    // BEFORE serialization — modifies tool defs to replace skill configs with workflowName refs.
    const preDeployedSkills = await this._preDeployNestedSkills(nativeAgent);

    // Generate domain UUID for stateful agents
    const runId = this._hasStatefulTools(nativeAgent) ? crypto.randomUUID().replace(/-/g, "") : undefined;

    // Serialize agent config (after pre-deploy so skill configs are replaced)
    const payload = this.serializer.serialize(nativeAgent, prompt, {
      sessionId: options?.sessionId,
      media: options?.media,
      idempotencyKey: options?.idempotencyKey,
    });
    applyRunSettings(payload.agentConfig as Record<string, unknown>, _resolveRunSettings(options));

    if (options?.timeoutSeconds !== undefined) {
      payload.timeoutSeconds = options.timeoutSeconds;
    }
    if (options?.credentials) {
      payload.credentials = options.credentials;
    }
    if (options?.context) {
      payload.context = options.context;
    }
    if (runId) {
      payload.runId = runId;
    }
    if (options?.plan !== undefined) {
      const { coercePlan } = await import("./plans.js");
      // Server reads ${workflow.input.static_plan} as the Case-0 plan source
      // — wins over the planner LLM's output. See plans.ts for wire shape.
      payload.static_plan = coercePlan(options.plan as Parameters<typeof coercePlan>[0]);
    }

    // Register tool workers with domain (for stateful isolation)
    await this._registerToolWorkers(nativeAgent, runId);

    // Register pre-deployed skill workers with domain
    for (const skillAgent of preDeployedSkills) {
      this._registerSkillWorkers(skillAgent, runId);
    }

    // Start agent — response may include requiredWorkers
    const startResponse = await this._httpRequest("POST", "/agent/start", payload, options?.signal);

    const executionId = startResponse.executionId as string;
    const requiredWorkers = this._parseRequiredWorkers(startResponse);

    // Register system workers with domain
    await this._registerSystemWorkers(nativeAgent, requiredWorkers, runId);
    if (this.config.autoStartWorkers) await this.workerManager.startPolling();

    try {
      // Create SSE stream
      const apiBaseUrl = await this._agentClient.apiBaseUrl();
      const agentStream = new AgentStream(
        `${apiBaseUrl}/agent/stream/${executionId}`,
        () => this._agentClient.authHeaders(),
        executionId,
        async (body) => this._respond(executionId, body, options?.signal),
        apiBaseUrl,
        undefined,
        !this.config.streamingEnabled,
      );

      // Drain all events
      const events: AgentEvent[] = [];
      for await (const event of agentStream) {
        events.push(event);
      }

      // Build result from stream
      const result = await agentStream.getResult();
      const resultRec = result as unknown as Record<string, unknown>;
      resultRec.correlationId = correlationId;

      // Enrich with execution data (toolCalls, messages, tokenUsage)
      try {
        const execution = await this._fetchExecution(executionId, options?.signal);
        if (execution) {
          const toolCalls = _extractToolCalls(execution);
          if (toolCalls.length > 0) {
            resultRec.toolCalls = toolCalls;
          }

          const messages = _extractMessages(execution);
          if (messages.length > 0) {
            resultRec.messages = messages;
          }

          const tokenUsage = await this._extractTokenUsage(executionId, options?.signal);
          if (tokenUsage) {
            resultRec.tokenUsage = tokenUsage;
          }

          // Fill output from execution if stream returned null or junk
          // (server sometimes returns workflow state like {result: [], finishReason: "TOOL_CALLS"})
          if (_isOutputJunk(resultRec.output)) {
            const execOutput = _extractOutput(execution);
            if (execOutput != null) {
              resultRec.output =
                typeof execOutput === "string" ? { result: execOutput } : execOutput;
            }
          }
        }
      } catch {
        // Non-critical — fall back to stream-only result
      }

      return result;
    } finally {
      await this.workerManager.stopPolling();
    }
  }

  // ── start() ───────────────────────────────────────────

  /**
   * Start an agent asynchronously. Returns a handle for interaction.
   * Accepts native Agent instances or framework agent objects.
   */
  async start(agent: Agent | object, prompt: string, options?: RunOptions): Promise<AgentHandle> {
    const framework = detectFramework(agent);
    if (framework !== null) {
      return this._startFramework(agent, prompt, framework, options);
    }

    const nativeAgent = agent as Agent;
    const correlationId = generateCorrelationId();

    // Pre-deploy BEFORE serialization
    const preDeployedSkills = await this._preDeployNestedSkills(nativeAgent);

    // Generate domain UUID for stateful agents
    const runId = this._hasStatefulTools(nativeAgent) ? crypto.randomUUID().replace(/-/g, "") : undefined;

    const payload = this.serializer.serialize(nativeAgent, prompt, {
      sessionId: options?.sessionId,
      media: options?.media,
      idempotencyKey: options?.idempotencyKey,
    });
    applyRunSettings(payload.agentConfig as Record<string, unknown>, _resolveRunSettings(options));

    if (options?.timeoutSeconds !== undefined) {
      payload.timeoutSeconds = options.timeoutSeconds;
    }
    if (options?.credentials) {
      payload.credentials = options.credentials;
    }
    if (options?.context) {
      payload.context = options.context;
    }
    if (runId) {
      payload.runId = runId;
    }
    if (options?.plan !== undefined) {
      const { coercePlan } = await import("./plans.js");
      payload.static_plan = coercePlan(options.plan as Parameters<typeof coercePlan>[0]);
    }

    // Register tool workers with domain
    await this._registerToolWorkers(nativeAgent, runId);

    // Register pre-deployed skill workers with domain
    for (const skillAgent of preDeployedSkills) {
      this._registerSkillWorkers(skillAgent, runId);
    }

    // Start agent — response may include requiredWorkers
    const startResponse = await this._httpRequest("POST", "/agent/start", payload, options?.signal);

    const executionId = startResponse.executionId as string;
    const requiredWorkers = this._parseRequiredWorkers(startResponse);

    // Register system workers with domain
    await this._registerSystemWorkers(nativeAgent, requiredWorkers, runId);
    if (this.config.autoStartWorkers) await this.workerManager.startPolling();

    // Liveness monitor (spec R11) — only meaningful for stateful, domain-routed
    // runs; stateless runs have no domain queue for a worker to stall on.
    let stallError: WorkerStallError | undefined;
    let livenessMonitor: LivenessMonitor | undefined;
    if (runId && this.config.livenessEnabled) {
      livenessMonitor = new LivenessMonitor({
        workflows: this.workflows,
        executionId,
        domain: runId,
        stallSeconds: this.config.livenessStallSeconds,
        checkIntervalSeconds: this.config.livenessCheckIntervalSeconds,
        onStall: (err) => {
          stallError = err;
        },
      });
      livenessMonitor.start();
    }

    const handle: AgentHandle = {
      executionId,
      correlationId,

      getStatus: () => this.getStatus(executionId, options?.signal),

      wait: async (pollIntervalMs = 500) => {
        const deadline =
          Date.now() +
          (options?.timeoutSeconds ? options.timeoutSeconds * 1000 + 30_000 : DEFAULT_WAIT_MS);
        while (true) {
          if (stallError) {
            livenessMonitor?.stop();
            throw stallError;
          }
          const status = await this.getStatus(executionId, options?.signal);
          if (TERMINAL_STATUSES.has(status.status)) {
            livenessMonitor?.stop();
            const resultData: Parameters<typeof makeAgentResult>[0] = {
              output: status.output,
              executionId,
              correlationId,
              status: status.status,
            };

            try {
              const execution = await this._fetchExecution(executionId, options?.signal);
              if (execution) {
                resultData.toolCalls = _extractToolCalls(execution) as unknown[];
                resultData.messages = _extractMessages(execution);
                resultData.tokenUsage = (await this._extractTokenUsage(executionId, options?.signal)) ?? undefined;

                // Replace junk output with execution data
                if (_isOutputJunk(resultData.output)) {
                  const execOutput = _extractOutput(execution);
                  if (execOutput != null) {
                    resultData.output =
                      typeof execOutput === "string" ? { result: execOutput } : execOutput;
                  }
                }
              }
            } catch {
              // Non-critical
            }

            return makeAgentResult(resultData);
          }
          if (Date.now() >= deadline) {
            livenessMonitor?.stop();
            throw new AgentAPIError(
              `wait() timed out for execution ${executionId} (last status: ${status.status})`,
              0,
              "",
            );
          }
          await sleep(pollIntervalMs);
        }
      },

      respond: (output) => this._respond(executionId, output, options?.signal),

      approve: (output?) =>
        this._respond(executionId, { approved: true, ...output }, options?.signal),

      reject: (reason?) => this._respond(executionId, { approved: false, reason }, options?.signal),

      send: (message) => this._respond(executionId, { message }, options?.signal),

      pause: () =>
        this._httpRequest("PUT", `/agent/${executionId}/pause`, undefined, options?.signal).then(
          () => undefined,
        ),

      resume: () =>
        this._httpRequest("PUT", `/agent/${executionId}/resume`, undefined, options?.signal).then(
          () => undefined,
        ),

      cancel: () =>
        this._httpRequest(
          "DELETE",
          `/agent/${executionId}/cancel`,
          undefined,
          options?.signal,
        ).then(() => undefined),

      stop: async () => {
        livenessMonitor?.stop();
        await this.client.stop(executionId, options?.signal);
        try {
          // Best-effort unblock for any pending wait — failures are
          // swallowed (the stop above already terminated the execution).
          await this.client.signal(executionId, "stopped", options?.signal);
        } catch {
          // Non-fatal.
        }
      },

      stream: () => {
        const apiBaseUrl = this._agentClient.apiBaseUrlSync();
        return new AgentStream(
          `${apiBaseUrl}/agent/stream/${executionId}`,
          () => this._agentClient.authHeaders(),
          executionId,
          async (body) => this._respond(executionId, body, options?.signal),
          apiBaseUrl,
          undefined,
          !this.config.streamingEnabled,
        );
      },
    };

    return handle;
  }

  // ── stream() ──────────────────────────────────────────

  /**
   * Start an agent and return a connected AgentStream.
   * Accepts native Agent instances or framework agent objects.
   */
  async stream(agent: Agent | object, prompt: string, options?: RunOptions): Promise<AgentStream> {
    const handle = await this.start(agent, prompt, options);
    return handle.stream();
  }

  // ── deploy() ──────────────────────────────────────────

  /**
   * Deploy one agent, optionally reconciling its cron schedules.
   * Accepts native Agent instances or framework agent objects.
   *
   * @param agent The agent to deploy.
   * @param opts Optional declarative options:
   *   - `schedules`: cron schedules to attach. Tri-state:
   *     `undefined`/`null` leaves existing schedules untouched;
   *     `[]` purges all schedules for this agent;
   *     `[...]` upserts those and prunes the rest.
   */
  async deploy(
    agent: Agent | object,
    opts?: { schedules?: Schedule[] | null },
  ): Promise<DeploymentInfo>;
  /** Deploy one or more agents (no schedules option in this form). */
  async deploy(...agents: (Agent | object)[]): Promise<DeploymentInfo[]>;
  async deploy(
    first: Agent | object,
    ...rest: unknown[]
  ): Promise<DeploymentInfo | DeploymentInfo[]> {
    // Single-agent form: deploy(agent, opts?) — the schedules-reconciling shape.
    if (rest.length === 0 || (rest.length === 1 && _isDeployOpts(rest[0]))) {
      const opts = (rest[0] as { schedules?: Schedule[] | null } | undefined) ?? {};
      const info = await this._deployViaServer(first);
      if (opts.schedules !== undefined) {
        const agentName = (first as Agent).name ?? info.agentName;
        if (!agentName) {
          throw new Error("deploy(..., {schedules}) requires the agent to have a name");
        }
        await this.schedulesClient().reconcile(agentName, opts.schedules);
      }
      return info;
    }

    // Variadic form: deploy(...agents) — no schedules reconciliation.
    const agents = [first, ...rest] as (Agent | object)[];
    const results: DeploymentInfo[] = [];
    for (const agent of agents) {
      results.push(await this._deployViaServer(agent));
    }
    return results;
  }

  /** Compile + register one agent on the server (no execution, no workers). Shared by `deploy` and `serve`. */
  private async _deployViaServer(agent: Agent | object): Promise<DeploymentInfo> {
    const framework = detectFramework(agent);
    let payload: Record<string, unknown>;
    if (framework !== null) {
      const [rawConfig] = this._serializeFramework(agent, framework);
      payload = { framework, rawConfig };
    } else {
      payload = this.serializer.serialize(agent as Agent);
    }
    const response = await this._httpRequest("POST", "/agent/deploy", payload);
    return response as unknown as DeploymentInfo;
  }

  /** `SchedulerClient` — shares the control-plane client's Conductor client. */
  schedulesClient(): SchedulerClient {
    return this._agentClient.schedules;
  }

  /** HTTP request returning unknown — delegates to the control-plane client. */
  async _httpRequestUntyped(method: string, path: string, body?: unknown): Promise<unknown> {
    return this._agentClient.request(method as "GET" | "POST" | "PUT" | "DELETE", path, body);
  }

  // ── plan() ────────────────────────────────────────────

  /**
   * Compile an agent to a workflow definition without executing.
   */
  async plan(agent: Agent | object): Promise<object> {
    const framework = detectFramework(agent);
    let payload: Record<string, unknown>;
    if (framework !== null) {
      const [rawConfig] = this._serializeFramework(agent, framework);
      payload = { framework, rawConfig };
    } else {
      payload = this.serializer.serialize(agent as Agent);
    }
    const response = await this._httpRequest("POST", "/agent/compile", payload);
    return response;
  }

  // ── serve() ───────────────────────────────────────────

  /**
   * Deploy the provided agents, register their workers, and start polling.
   * When no agents are provided, starts polling with any workers already
   * registered. Blocks until SIGINT/SIGTERM by default; pass a trailing
   * `{blocking: false}` to return once deploy + registration + polling have
   * started (spec R9).
   */
  async serve(...args: (Agent | object | ServeOptions)[]): Promise<void> {
    let options: ServeOptions = {};
    let agents = args as (Agent | object)[];
    const last = args[args.length - 1];
    if (_isServeOptions(last)) {
      options = last;
      agents = args.slice(0, -1) as (Agent | object)[];
    }

    for (const agent of agents) {
      await this._deployViaServer(agent);

      const framework = detectFramework(agent);
      if (framework !== null) {
        const [, workers] = this._serializeFramework(agent, framework);
        this._registerExtractedWorkers(workers);
        continue;
      }

      const nativeAgent = agent as Agent;
      await this._registerToolWorkers(nativeAgent);
      await this._registerSystemWorkers(nativeAgent, null);
    }

    await this.workerManager.startPolling();

    if (options.blocking === false) {
      return;
    }

    // Keep process alive until SIGINT/SIGTERM
    return new Promise<void>((resolve) => {
      const onSignal = () => {
        void this.workerManager.stopPolling().then(() => resolve());
      };
      process.on("SIGINT", onSignal);
      process.on("SIGTERM", onSignal);
    });
  }

  // ── shutdown() ────────────────────────────────────────

  /**
   * Stop worker polling.
   */
  async shutdown(): Promise<void> {
    await this.workerManager.stopPolling();
  }

  // ── Private helpers ───────────────────────────────────

  /**
   * Shared HTTP request wrapper for `/agent/*` — delegates to the
   * control-plane {@link OrkesAgentClient} (which rides the shared client's
   * authenticated call path; see spec R1/R2).
   */
  async _httpRequest(
    method: string,
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const result = await this._agentClient.request(
      method as "GET" | "POST" | "PUT" | "DELETE",
      path,
      body,
      signal,
    );
    return (result as Record<string, unknown>) ?? {};
  }

  /**
   * Get agent status by execution ID.
   */
  async getStatus(executionId: string, signal?: AbortSignal): Promise<AgentStatus> {
    return this.client.status(executionId, signal);
  }

  /**
   * Send a respond payload to a waiting agent.
   */
  private async _respond(executionId: string, body: unknown, signal?: AbortSignal): Promise<void> {
    await this.client.respond(executionId, body, signal);
  }

  /**
   * Fetch the full execution data (tasks, variables, output, tokenUsage).
   * Mirrors Python SDK's _fetch_agent_workflow: GET /agent/execution/{id}
   */
  private async _fetchExecution(
    executionId: string,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown> | null> {
    return this.client.getExecution(executionId, signal);
  }

  /**
   * Extract aggregated token usage from the full execution tree.
   * Mirrors Python's _extract_token_usage: recursively traverses sub-workflows
   * to aggregate tokens from every LLM_CHAT_COMPLETE task in the tree.
   */
  private async _extractTokenUsage(
    executionId: string,
    signal?: AbortSignal,
  ): Promise<{ promptTokens: number; completionTokens: number; totalTokens: number } | null> {
    if (!executionId) return null;
    const { prompt, completion, total, found } = await this._collectTokensById(
      executionId,
      new Set(),
      signal,
    );
    if (!found) return null;
    const finalTotal = total === 0 && (prompt > 0 || completion > 0) ? prompt + completion : total;
    return { promptTokens: prompt, completionTokens: completion, totalTokens: finalTotal };
  }

  /**
   * Recursively collect token counts via GET /api/agent/execution/{id}.
   * Reads tokenUsage from each level and recurses into SUB_WORKFLOW tasks.
   */
  private async _collectTokensById(
    executionId: string,
    visited: Set<string>,
    signal?: AbortSignal,
  ): Promise<{ prompt: number; completion: number; total: number; found: boolean }> {
    if (visited.has(executionId)) return { prompt: 0, completion: 0, total: 0, found: false };
    visited.add(executionId);

    const data = await this._fetchExecution(executionId, signal);
    if (!data) return { prompt: 0, completion: 0, total: 0, found: false };

    let totalPrompt = 0;
    let totalCompletion = 0;
    let totalTotal = 0;
    let foundAny = false;

    // Use server-computed token usage for this execution level
    const level = _readTokenUsage(data);
    if (level.found) {
      foundAny = true;
      totalPrompt += level.prompt;
      totalCompletion += level.completion;
      totalTotal += level.total;
    }

    // Recurse into sub-agent workflows
    const tasks = (data.tasks ?? []) as Record<string, unknown>[];
    for (const task of tasks) {
      const taskType = String(task.taskType ?? "").toUpperCase();
      if (taskType.includes("SUB_WORKFLOW")) {
        const subId = task.subWorkflowId as string | undefined;
        if (subId && !visited.has(subId)) {
          const sub = await this._collectTokensById(subId, visited, signal);
          if (sub.found) {
            foundAny = true;
            totalPrompt += sub.prompt;
            totalCompletion += sub.completion;
            totalTotal += sub.total;
          }
        }
      }
    }

    return { prompt: totalPrompt, completion: totalCompletion, total: totalTotal, found: foundAny };
  }

  /**
   * Recursively collect all ToolDefs with handlers from an agent tree.
   * Walks agent.agents AND agents nested inside agentTool() configs.
   */
  private _collectToolDefs(agent: Agent): ToolDef[] {
    const defs: ToolDef[] = [];

    for (const t of agent.tools) {
      try {
        const def = getToolDef(t);
        if (def.func != null) {
          defs.push(def);
        }
        // Walk into agents referenced via agentTool() — their tools need workers too
        if (def.toolType === "agent_tool" && def.config?.agent) {
          const innerAgent = def.config.agent as Agent;
          if (innerAgent.tools || innerAgent.agents) {
            defs.push(...this._collectToolDefs(innerAgent));
          }
        }
      } catch {
        // Skip unrecognized tool formats
      }
    }

    // Recurse into sub-agents
    for (const subAgent of agent.agents) {
      defs.push(...this._collectToolDefs(subAgent));
    }

    return defs;
  }

  /**
   * Parse the requiredWorkers list from a server response.
   * Returns a Set<string> if present, or null for fallback (older servers).
   */
  private _parseRequiredWorkers(response: Record<string, unknown>): Set<string> | null {
    const raw = response.requiredWorkers;
    if (Array.isArray(raw)) {
      return new Set(raw.map(String));
    }
    return null;
  }

  /**
   * Check if an agent or any of its tools/sub-agents use stateful isolation.
   * Mirrors Python SDK's _has_stateful_tools().
   */
  private _hasStatefulTools(agent: Agent): boolean {
    if (agent.stateful) return true;
    // Check tool-level stateful (synchronous check on already-normalized defs)
    for (const t of agent.tools) {
      if (typeof t === "object" && t !== null && (t as Record<string, unknown>).stateful) {
        return true;
      }
    }
    for (const sub of agent.agents) {
      if (this._hasStatefulTools(sub)) return true;
    }
    return false;
  }

  /**
   * Pre-deploy any skill agents nested inside agent_tool wrappers.
   * Skills have _framework fields that Jackson rejects in agentConfig.
   * Deploys the skill separately via the framework path, then replaces
   * the agent_tool config with a workflowName reference.
   */
  private async _preDeployNestedSkills(agent: Agent): Promise<Agent[]> {
    const { getToolDef } = await import("./tool.js");
    const skillAgents: Agent[] = [];

    for (const t of agent.tools) {
      try {
        const td = getToolDef(t);
        if (td.toolType === "agent_tool" && td.config?.agent) {
          const nested = td.config.agent as Record<string, unknown>;
          if (nested._framework === "skill") {
            const skillAgent = td.config.agent as Agent;
            const [rawConfig] = this._serializeFramework(skillAgent, "skill");
            const deployResult = await this._httpRequest("POST", "/agent/deploy", {
              framework: "skill",
              rawConfig,
            });
            const workflowName = (deployResult as Record<string, unknown>).agentName as string;
            td.config.workflowName = workflowName;
            td.config.workerNames = createSkillWorkers(skillAgent).map((sw) => sw.name);
            skillAgents.push(skillAgent);
            delete td.config.agent;
          }
        }
      } catch {
        // Skip non-tool items
      }
    }

    // Recurse into sub-agents
    for (const sub of agent.agents) {
      const nested = await this._preDeployNestedSkills(sub);
      skillAgents.push(...nested);
    }

    return skillAgents;
  }

  /**
   * Register tool workers (user-defined) for an agent tree.
   * These are always registered regardless of requiredWorkers.
   */
  private async _registerToolWorkers(agent: Agent, domain?: string): Promise<void> {
    const toolDefs = this._collectToolDefs(agent);

    for (const def of toolDefs) {
      const handler = def.func;
      if (!handler) {
        throw new Error(`Tool '${def.name}' has no local handler function`);
      }
      const credNames =
        def.credentials?.filter((c): c is string => typeof c === "string") ?? undefined;
      // Domain is only non-undefined when _hasStatefulTools returned true at the top level.
      // All workers under that execution must poll in the same domain.
      const workerDomain = domain;
      this.workerManager.addWorker(
        def.name,
        async (inputData) => {
          const toolContext = inputData["__toolContext__"];
          delete inputData["__toolContext__"];
          return handler(inputData, toolContext);
        },
        credNames,
        workerDomain,
      );
    }

    // Register custom guardrail workers from tools
    for (const def of toolDefs) {
      if (def.guardrails) {
        for (const g of def.guardrails) {
          const gDef = this._normalizeGuardrailDef(g);
          if (gDef && gDef.func && gDef.taskName) {
            await this._registerGuardrailWorker(gDef);
          }
        }
      }
    }
  }

  /**
   * Register skill workers (scripts + read_skill_file) for a skill-based agent.
   */
  private _registerSkillWorkers(agent: Agent, domain?: string): void {
    const skillWorkers = createSkillWorkers(agent);
    for (const sw of skillWorkers) {
      this.workerManager.addWorker(
        sw.name,
        async (inputData: Record<string, unknown>) => {
          const command = (inputData.command as string) ?? "";
          return sw.func(command);
        },
        undefined,
        domain,
      );
    }
  }

  /**
   * Recursively register all system workers (non-tool) for an agent tree.
   * When requiredWorkers is provided, only register workers whose task names
   * appear in the set. When null/undefined, register all (fallback for older servers).
   */
  private async _registerSystemWorkers(
    agent: Agent,
    requiredWorkers?: Set<string> | null,
    domain?: string,
  ): Promise<void> {
    // Helper: check if a task name is needed (always true when requiredWorkers is absent)
    const isNeeded = (taskName: string): boolean =>
      requiredWorkers == null || requiredWorkers.has(taskName);

    // Termination
    if (agent.termination) {
      const taskName = `${agent.name}_termination`;
      if (isNeeded(taskName)) {
        await this._registerTerminationWorker(
          agent.name,
          agent.termination as TerminationCondition,
          domain,
        );
      }
    }

    // Custom guardrails (those with func)
    for (const g of agent.guardrails) {
      const gDef = this._normalizeGuardrailDef(g);
      if (gDef && gDef.func && gDef.taskName) {
        if (isNeeded(gDef.taskName)) {
          await this._registerGuardrailWorker(gDef, domain);
        }
      }
    }

    // stopWhen
    if (agent.stopWhen) {
      const taskName = `${agent.name}_stop_when`;
      if (isNeeded(taskName)) {
        await this._registerStopWhenWorker(agent.name, agent.stopWhen, domain);
      }
    }

    // Callbacks
    if (agent.callbacks.length > 0) {
      const callbackTaskNames = Object.values(CALLBACK_POSITION_MAP).map(
        (pos) => `${agent.name}_${pos}`,
      );
      const anyCallbackNeeded =
        requiredWorkers == null || callbackTaskNames.some((t) => requiredWorkers.has(t));
      if (anyCallbackNeeded) {
        await this._registerCallbackWorkers(agent.name, agent.callbacks, requiredWorkers, domain);
      }
    }

    // Gate (callable)
    if (agent.gate && typeof agent.gate.fn === "function") {
      const taskName = `${agent.name}_gate`;
      if (isNeeded(taskName)) {
        await this._registerGateWorker(
          agent.name,
          agent.gate.fn as (...args: unknown[]) => unknown,
          domain,
        );
      }
    }

    // Router (function, not Agent)
    if (agent.router && typeof agent.router === "function") {
      const taskName = `${agent.name}_router_fn`;
      if (isNeeded(taskName)) {
        await this._registerRouterWorker(
          agent.name,
          agent.router as (...args: unknown[]) => string,
          domain,
        );
      }
    }

    // Swarm transfer workers
    if (agent.agents.length > 0) {
      const allNames = [agent.name, ...agent.agents.map((a) => a.name)];
      const anyTransferNeeded =
        requiredWorkers == null ||
        allNames.some((src) =>
          allNames.some((dst) => src !== dst && requiredWorkers.has(`${src}_transfer_to_${dst}`)),
        );
      if (anyTransferNeeded) {
        await this._registerSwarmTransferWorkers(agent, requiredWorkers, domain);
      }
    }

    // Check transfer worker
    {
      const taskName = `${agent.name}_check_transfer`;
      if (isNeeded(taskName)) {
        await this._registerCheckTransferWorker(agent.name, domain);
      }
    }

    // Handoff check worker
    if (agent.handoffs.length > 0 || agent.strategy === "swarm") {
      const taskName = `${agent.name}_handoff_check`;
      if (isNeeded(taskName)) {
        await this._registerHandoffCheckWorker(agent, domain);
      }
    }

    // Process selection worker
    if (agent.strategy === "manual" && agent.agents.length > 0) {
      const taskName = `${agent.name}_process_selection`;
      if (isNeeded(taskName)) {
        await this._registerProcessSelectionWorker(agent, domain);
      }
    }

    // Recurse into sub-agents (pass domain)
    for (const subAgent of agent.agents) {
      await this._registerSystemWorkers(subAgent, requiredWorkers, domain);
    }
  }

  /**
   * Register a termination condition worker.
   * Server dispatches {agent}_termination with {result, iteration}.
   * Worker returns {should_continue, reason}.
   */
  private async _registerTerminationWorker(
    agentName: string,
    cond: TerminationCondition,
    domain?: string,
  ): Promise<void> {
    const taskName = `${agentName}_termination`;
    this.workerManager.addWorker(taskName, async (inputData) => {
      const result = String(inputData["result"] ?? "");
      const iteration = Number(inputData["iteration"] ?? 0);
      const messages = Array.isArray(inputData["messages"]) ? inputData["messages"] : [];
      try {
        const outcome = cond.shouldTerminate({ result, messages, iteration });
        return { should_continue: !outcome.shouldTerminate, reason: outcome.reason };
      } catch {
        return { should_continue: true, reason: "" };
      }
    }, undefined, domain);
  }

  /**
   * Register a custom guardrail worker.
   * Server dispatches {guardrail.taskName} with {content, iteration}.
   * Worker returns {passed, message, on_fail, ...}.
   */
  private async _registerGuardrailWorker(gDef: GuardrailDef, domain?: string): Promise<void> {
    const { taskName, func: fn } = gDef;
    if (!taskName || !fn) {
      throw new Error(`Custom guardrail '${gDef.name}' is missing its taskName or local handler`);
    }
    this.workerManager.addWorker(taskName, async (inputData) => {
      const raw = inputData["content"] ?? "";
      const content = typeof raw === "object" ? JSON.stringify(raw) : String(raw);
      try {
        const result = await fn(content);
        return {
          passed: result.passed ?? true,
          message: result.message ?? "",
          on_fail: gDef.onFail ?? "raise",
          fixed_output: result.fixedOutput,
          guardrail_name: gDef.name,
          should_continue: result.passed ?? true,
        };
      } catch (err) {
        return {
          passed: false,
          message: err instanceof Error ? err.message : String(err),
          on_fail: gDef.onFail ?? "raise",
          guardrail_name: gDef.name,
          should_continue: false,
        };
      }
    }, undefined, domain);
  }

  /**
   * Register a stopWhen callback worker.
   * Server dispatches {agent}_stop_when with {result, iteration, messages}.
   * Worker returns {should_continue}.
   */
  private async _registerStopWhenWorker(
    agentName: string,
    stopWhenFn: (messages: unknown[], ...args: unknown[]) => boolean,
    domain?: string,
  ): Promise<void> {
    const taskName = `${agentName}_stop_when`;
    this.workerManager.addWorker(taskName, async (inputData) => {
      const result = String(inputData["result"] ?? "");
      const iteration = Number(inputData["iteration"] ?? 0);
      try {
        const shouldStop = stopWhenFn([result], iteration);
        return { should_continue: !shouldStop };
      } catch {
        return { should_continue: true };
      }
    }, undefined, domain);
  }

  /**
   * Register callback workers for each lifecycle position.
   * Server dispatches {agent}_{position} with {messages, llm_result}.
   * Worker returns the callback result or {}.
   */
  private async _registerCallbackWorkers(
    agentName: string,
    callbacks: CallbackHandler[],
    requiredWorkers?: Set<string> | null,
    domain?: string,
  ): Promise<void> {
    for (const [methodName, wirePosition] of Object.entries(CALLBACK_POSITION_MAP)) {
      // Check if any handler implements this method
      const handlers = callbacks.filter(
        (h) => typeof (h as Record<string, unknown>)[methodName] === "function",
      );
      if (handlers.length === 0) continue;

      const taskName = `${agentName}_${wirePosition}`;
      if (requiredWorkers != null && !requiredWorkers.has(taskName)) continue;
      this.workerManager.addWorker(taskName, async (inputData) => {
        const messages = inputData["messages"] ?? null;
        const llmResult = inputData["llm_result"] ?? null;
        try {
          let result: unknown = {};
          for (const handler of handlers) {
            const fn = (handler as Record<string, unknown>)[methodName] as CallbackCallable;
            // Pass server data matching CallbackHandler method signatures:
            // before/after_agent: (agentName, data)
            // before/after_model: (agentName, messages|response)
            // before/after_tool:  (agentName, toolName, data)
            const data = messages ?? llmResult;
            result = await fn.call(handler, agentName, data);
          }
          return typeof result === "object" && result !== null ? result : {};
        } catch {
          return {};
        }
      }, undefined, domain);
    }
  }

  /**
   * Register a callable gate worker.
   * Server dispatches {agent}_gate with {result}.
   * Worker returns {decision: "continue"|"stop"}.
   */
  private async _registerGateWorker(
    agentName: string,
    gateFn: (...args: unknown[]) => unknown,
    domain?: string,
  ): Promise<void> {
    const taskName = `${agentName}_gate`;
    this.workerManager.addWorker(taskName, async (inputData) => {
      const result = String(inputData["result"] ?? "");
      try {
        const decision = await gateFn(result);
        if (typeof decision === "string") {
          return { decision };
        }
        return { decision: decision ? "continue" : "stop" };
      } catch {
        return { decision: "continue" };
      }
    }, undefined, domain);
  }

  /**
   * Register a function-based router worker.
   * Server dispatches {agent}_router_fn with {prompt}.
   * Worker returns {selected_agent}.
   */
  private async _registerRouterWorker(
    agentName: string,
    routerFn: (...args: unknown[]) => string,
    domain?: string,
  ): Promise<void> {
    const taskName = `${agentName}_router_fn`;
    this.workerManager.addWorker(taskName, async (inputData) => {
      const prompt = String(inputData["prompt"] ?? "");
      try {
        const selected = await routerFn(prompt);
        return { selected_agent: selected };
      } catch {
        return { selected_agent: "" };
      }
    }, undefined, domain);
  }

  /**
   * Register transfer_to_{peer} workers for swarm agents.
   *
   * Each agent in the swarm gets transfer tools for its peers.
   * The transfer tools are no-ops — the actual handoff is detected
   * by check_transfer which inspects toolCalls output. Reachable targets
   * accept an optional `message` (the hand-off note) and echo it back so
   * it is visible in the task output (spec R13); the no-op is otherwise
   * silent to preserve backward compatibility with pre-`message` schemas.
   *
   * When allowed_transitions is set, transfers to targets that no
   * agent is allowed to reach return an error message so the LLM
   * knows to try a different tool.
   */
  private async _registerSwarmTransferWorkers(
    agent: Agent,
    requiredWorkers?: Set<string> | null,
    domain?: string,
  ): Promise<void> {
    // Build set of all valid transfer targets from allowed_transitions
    const allowed = agent.allowedTransitions;
    const validTargets = new Set<string>();
    if (allowed) {
      for (const targets of Object.values(allowed)) {
        for (const t of targets) {
          validTargets.add(t);
        }
      }
    }

    const allNames = [agent.name, ...agent.agents.map((a) => a.name)];
    const registered = new Set<string>();

    for (const sourceName of allNames) {
      for (const peerName of allNames) {
        if (peerName === sourceName) continue;

        // Prefix with the SOURCE agent name (the one calling transfer)
        const toolName = `${sourceName}_transfer_to_${peerName}`;
        if (registered.has(toolName)) continue;
        registered.add(toolName);

        // Skip if server told us this worker is not needed
        if (requiredWorkers != null && !requiredWorkers.has(toolName)) continue;

        // If this target is never reachable via allowed_transitions,
        // return an error message so the LLM knows to stop trying.
        const isUnreachable = !!allowed && !validTargets.has(peerName);

        if (isUnreachable) {
          this.workerManager.addWorker(toolName, async () => ({
            result: `ERROR: ${toolName} is not available. Use a different transfer tool, or if you are done, just provide your final response without calling any transfer tool.`,
          }), undefined, domain);
        } else {
          this.workerManager.addWorker(toolName, async (inputData) => {
            const message = inputData?.["message"];
            return message ? { message: String(message) } : {};
          }, undefined, domain);
        }
      }
    }
  }

  /**
   * Register a check_transfer worker for hybrid handoff agents.
   * Server dispatches {agent}_check_transfer with {tool_calls} — a list of
   * objects with at least `name` and `inputParameters` (or `arguments`, an
   * older tool-call schema variant). Worker scans for _transfer_to_ in
   * emission order; selection is first-wins since the swarm loop can only
   * hand off to one agent per turn (spec R13). Non-winning transfer calls
   * surface as `dropped_transfers` (only when there is more than one) with a
   * warning naming the honored and dropped targets, so a fan-out intent is
   * never silently discarded.
   */
  private async _registerCheckTransferWorker(agentName: string, domain?: string): Promise<void> {
    const taskName = `${agentName}_check_transfer`;
    this.workerManager.addWorker(taskName, async (inputData) => {
      const toolCalls = Array.isArray(inputData["tool_calls"]) ? inputData["tool_calls"] : [];
      const transfers: { transferTo: string; message: string }[] = [];

      for (const tc of toolCalls) {
        if (typeof tc !== "object" || tc === null) continue;
        const rec = tc as Record<string, unknown>;
        const name = String(rec.name ?? "");
        if (!name.includes("_transfer_to_")) continue;

        const params = (rec.inputParameters ?? rec.arguments ?? {}) as Record<string, unknown>;
        const message = params.message;
        transfers.push({
          transferTo: name.split("_transfer_to_")[1],
          message: message == null ? "" : String(message),
        });
      }

      if (transfers.length === 0) {
        return { is_transfer: false, transfer_to: "", transfer_message: "" };
      }

      const [first, ...rest] = transfers;
      const out: Record<string, unknown> = {
        is_transfer: true,
        transfer_to: first.transferTo,
        transfer_message: first.message,
      };
      if (rest.length > 0) {
        console.warn(
          `[${taskName}] Multiple transfer calls in one turn; honoring '${first.transferTo}', ` +
            `dropping ${JSON.stringify(rest.map((t) => t.transferTo))}`,
        );
        out.dropped_transfers = rest.map((t) => ({ transfer_to: t.transferTo, message: t.message }));
      }
      return out;
    }, undefined, domain);
  }

  /**
   * Register a handoff_check worker for swarm strategy.
   *
   * Supports dual-mechanism handoffs:
   * 1. Primary: Transfer tool detected (is_transfer=true, transfer_to=<name>)
   * 2. Secondary: Condition-based handoffs (OnTextMention, OnCondition, etc.)
   */
  private async _registerHandoffCheckWorker(agent: Agent, domain?: string): Promise<void> {
    const taskName = `${agent.name}_handoff_check`;
    const handoffConditions = agent.handoffs;

    // Parent agent is "0", sub-agents are "1", "2", ...
    const nameToIdx: Record<string, string> = { [agent.name]: "0" };
    agent.agents.forEach((sub, i) => {
      nameToIdx[sub.name] = String(i + 1);
    });
    const idxToName: Record<string, string> = {};
    for (const [name, idx] of Object.entries(nameToIdx)) {
      idxToName[idx] = name;
    }

    const allowed = agent.allowedTransitions;
    const maxBlockedRetries = 3;
    const blockedCounts: Record<string, number> = {};

    const isTransferTruthy = (val: unknown): boolean => {
      if (val === true) return true;
      if (typeof val === "string") return val.trim().toLowerCase() === "true";
      return false;
    };

    const isAllowed = (sourceIdx: string, targetName: string): boolean => {
      if (!allowed) return true;
      const sourceName = idxToName[sourceIdx] ?? "";
      return (allowed[sourceName] ?? []).includes(targetName);
    };

    this.workerManager.addWorker(taskName, async (inputData) => {
      const result = String(inputData["result"] ?? "");
      const activeAgent = String(inputData["active_agent"] ?? "0");
      const conversation = String(inputData["conversation"] ?? "");
      const isTransfer = inputData["is_transfer"];
      const transferTo = String(inputData["transfer_to"] ?? "");

      // Priority 1: Transfer tool detected
      if (isTransferTruthy(isTransfer)) {
        if (isAllowed(activeAgent, transferTo)) {
          Reflect.deleteProperty(blockedCounts, activeAgent);
          const targetIdx = nameToIdx[transferTo] ?? activeAgent;
          if (targetIdx !== activeAgent) {
            return { active_agent: targetIdx, handoff: true };
          }
        } else if (allowed) {
          // Transfer blocked — give the agent a few retries to self-correct
          const count = (blockedCounts[activeAgent] ?? 0) + 1;
          blockedCounts[activeAgent] = count;
          if (count <= maxBlockedRetries) {
            return { active_agent: activeAgent, handoff: true };
          }
          // Max retries exceeded — exit the loop
          Reflect.deleteProperty(blockedCounts, activeAgent);
          return { active_agent: activeAgent, handoff: false };
        }
      }

      // Priority 2: Condition-based handoffs (fallback)
      const context: HandoffContext = {
        result,
        messages: conversation,
        toolName: "",
        toolResult: "",
      };
      for (const cond of handoffConditions) {
        // Check if the condition object supports shouldHandoff evaluation
        const condObj = cond as {
          target?: string;
          shouldHandoff?: (ctx: HandoffContext) => boolean;
        };
        if (typeof condObj.shouldHandoff === "function" && condObj.target) {
          if (condObj.shouldHandoff(context)) {
            if (isAllowed(activeAgent, condObj.target)) {
              const targetIdx = nameToIdx[condObj.target] ?? activeAgent;
              if (targetIdx !== activeAgent) {
                return { active_agent: targetIdx, handoff: true };
              }
            }
          }
        }
      }

      // Neither transfer nor condition matched — loop exits
      return { active_agent: activeAgent, handoff: false };
    }, undefined, domain);
  }

  /**
   * Register a process_selection worker for manual strategy.
   * Server dispatches {agent}_process_selection with {human_output}.
   * Worker maps agent name to index.
   * Returns {selected}.
   */
  private async _registerProcessSelectionWorker(agent: Agent, domain?: string): Promise<void> {
    const taskName = `${agent.name}_process_selection`;
    const nameToIdx: Record<string, string> = {};
    agent.agents.forEach((sub, i) => {
      nameToIdx[sub.name] = String(i);
    });

    this.workerManager.addWorker(taskName, async (inputData) => {
      const humanOutput = inputData["human_output"];
      if (humanOutput == null) {
        return { selected: "0" };
      }
      if (typeof humanOutput === "object" && humanOutput !== null) {
        const obj = humanOutput as Record<string, unknown>;
        const selected = String(obj.selected ?? obj.agent ?? "0");
        if (selected in nameToIdx) {
          return { selected: nameToIdx[selected] };
        }
        return { selected };
      }
      return { selected: String(humanOutput) };
    }, undefined, domain);
  }

  /**
   * Normalize a guardrail from any input format to GuardrailDef (if it has a func).
   */
  private _normalizeGuardrailDef(g: unknown): GuardrailDef | null {
    if (g == null || typeof g !== "object") return null;

    // Already a GuardrailDef with func
    const obj = g as Record<string, unknown>;
    if (typeof obj.func === "function") {
      return obj as unknown as GuardrailDef;
    }

    // RegexGuardrail, LLMGuardrail — server-side, no local worker needed
    return null;
  }

  /**
   * Derive a worker name from a framework agent object.
   */
  private _deriveWorkerName(agent: object, frameworkId: FrameworkId): string {
    const a = agent as Record<string, unknown>;
    if (typeof a.id === "string" && a.id.length > 0) return a.id;
    if (typeof a.name === "string" && a.name.length > 0) return a.name;
    if (agent.constructor && agent.constructor.name !== "Object") {
      return agent.constructor.name;
    }
    return `${frameworkId}_agent`;
  }

  /**
   * Serialize a framework agent into (rawConfig, workers) using extraction.
   */
  private _serializeFramework(
    agent: object,
    frameworkId: FrameworkId,
    options?: { model?: unknown },
  ) {
    switch (frameworkId) {
      case "langgraph":
        return serializeLangGraph(
          agent,
          options?.model != null ? { model: options.model } : undefined,
        );
      case "langchain":
        return serializeLangChain(agent);
      case "openai":
      case "google_adk":
        return serializeFrameworkAgent(agent);
      case "skill":
        return this._serializeSkill(agent as Agent);
      default:
        throw new AgentspanError(`Unsupported framework: ${frameworkId}`);
    }
  }

  /**
   * Register extracted worker functions for framework-based agents.
   */
  private _registerExtractedWorkers(
    workers: { name: string; func?: unknown | null }[],
    credentials?: string[],
  ): void {
    for (const worker of workers) {
      if (typeof worker.func === "function") {
        const fn = worker.func as WorkerCallable;
        this.workerManager.addWorker(
          worker.name,
          async (inputData) => {
            const cleanInput = { ...inputData };
            delete cleanInput["__workflowInstanceId__"];
            delete cleanInput["__toolContext__"];
            delete cleanInput["_agent_state"];
            delete cleanInput["method"];
            delete cleanInput["__agentspan_ctx__"];
            return fn(cleanInput);
          },
          credentials,
        );
      }
    }
  }

  /**
   * Serialize a skill-based agent for server-side normalization.
   * Returns (rawConfig, workers) matching the framework serialization interface.
   */
  private _serializeSkill(
    agent: Agent,
  ): [Record<string, unknown>, { name: string; func?: WorkerCallable }[]] {
    const a = agent as unknown as Record<string, unknown>;
    const rawConfig = a._framework_config as Record<string, unknown>;
    const skillWorkers = createSkillWorkers(agent);

    const workers = skillWorkers.map((sw) => ({
      name: sw.name,
      func: (inputData: Record<string, unknown>) => {
        const command = (inputData.command as string) ?? "";
        return sw.func(command);
      },
    }));

    return [rawConfig, workers];
  }

  /**
   * Run a framework agent via extraction.
   *
   * 1. Serialize the framework agent into rawConfig + WorkerInfo[]
   * 2. Register task definitions for each extracted worker
   * 3. Add workers to WorkerManager
   * 4. Start polling
   * 5. POST /agent/start with extracted rawConfig
   * 6. Wait for result via SSE stream
   */
  private async _runFramework(
    agent: object,
    prompt: string,
    frameworkId: FrameworkId,
    options?: RunOptions,
  ): Promise<AgentResult> {
    const correlationId = generateCorrelationId();
    const [rawConfig, workers] = this._serializeFramework(agent, frameworkId, {
      model: _resolveRunSettings(options).model ?? options?.model,
    });

    this._registerExtractedWorkers(workers, options?.credentials);

    if (this.config.autoStartWorkers) await this.workerManager.startPolling();

    try {
      // POST /agent/start with extracted config
      const startPayload = {
        framework: frameworkId,
        rawConfig,
        prompt,
        sessionId: options?.sessionId,
        credentials: options?.credentials,
      };

      const startResponse = await this._httpRequest(
        "POST",
        "/agent/start",
        startPayload,
        options?.signal,
      );

      const executionId = startResponse.executionId as string;

      // Create SSE stream to drain events and wait for completion
      const apiBaseUrl = await this._agentClient.apiBaseUrl();
      const agentStream = new AgentStream(
        `${apiBaseUrl}/agent/stream/${executionId}`,
        () => this._agentClient.authHeaders(),
        executionId,
        async (body) => this._respond(executionId, body, options?.signal),
        apiBaseUrl,
        undefined,
        !this.config.streamingEnabled,
      );

      // Drain all events
      const events: AgentEvent[] = [];
      for await (const event of agentStream) {
        events.push(event);
      }

      // Build result from stream
      const result = await agentStream.getResult();
      const resultRec = result as unknown as Record<string, unknown>;
      resultRec.correlationId = correlationId;

      // Enrich with execution data (messages, toolCalls, tokenUsage, output)
      // mirroring what the Python SDK does via get_workflow + _fetch_agent_workflow
      try {
        const execution = await this._fetchExecution(executionId, options?.signal);
        if (execution) {
          // Extract output from execution if stream returned null or junk
          if (_isOutputJunk(resultRec.output)) {
            const execOutput = _extractOutput(execution);
            if (execOutput != null) {
              resultRec.output =
                typeof execOutput === "string" ? { result: execOutput } : execOutput;
            }
          }

          // Extract messages from execution variables
          const messages = _extractMessages(execution);
          if (messages.length > 0) {
            resultRec.messages = messages;
          }

          // Extract tool calls from execution tasks
          const toolCalls = _extractToolCalls(execution);
          if (toolCalls.length > 0) {
            resultRec.toolCalls = toolCalls;
          }

          // Extract token usage (recursive across sub-workflows)
          const tokenUsage = await this._extractTokenUsage(executionId, options?.signal);
          if (tokenUsage) {
            resultRec.tokenUsage = tokenUsage;
          }
        }
      } catch {
        // Non-critical — fall back to stream-only result
      }

      return result;
    } finally {
      await this.workerManager.stopPolling();
    }
  }

  /**
   * Start a framework agent asynchronously. Returns a handle for interaction.
   */
  private async _startFramework(
    agent: object,
    prompt: string,
    frameworkId: FrameworkId,
    options?: RunOptions,
  ): Promise<AgentHandle> {
    const correlationId = generateCorrelationId();
    const [rawConfig, workers] = this._serializeFramework(agent, frameworkId, {
      model: _resolveRunSettings(options).model ?? options?.model,
    });

    this._registerExtractedWorkers(workers, options?.credentials);

    if (this.config.autoStartWorkers) await this.workerManager.startPolling();

    // POST /agent/start with extracted config
    const startPayload = {
      framework: frameworkId,
      rawConfig,
      prompt,
      sessionId: options?.sessionId,
      credentials: options?.credentials,
    };

    const startResponse = await this._httpRequest(
      "POST",
      "/agent/start",
      startPayload,
      options?.signal,
    );

    const executionId = startResponse.executionId as string;

    const handle: AgentHandle = {
      executionId,
      correlationId,

      getStatus: () => this.getStatus(executionId, options?.signal),

      wait: async (pollIntervalMs = 500) => {
        const deadline =
          Date.now() +
          (options?.timeoutSeconds ? options.timeoutSeconds * 1000 + 30_000 : DEFAULT_WAIT_MS);
        while (true) {
          const status = await this.getStatus(executionId, options?.signal);
          if (TERMINAL_STATUSES.has(status.status)) {
            const resultData: Parameters<typeof makeAgentResult>[0] = {
              output: status.output,
              executionId,
              correlationId,
              status: status.status,
            };

            try {
              const execution = await this._fetchExecution(executionId, options?.signal);
              if (execution) {
                resultData.toolCalls = _extractToolCalls(execution) as unknown[];
                resultData.messages = _extractMessages(execution);
                resultData.tokenUsage = (await this._extractTokenUsage(executionId, options?.signal)) ?? undefined;

                // Replace junk output with execution data
                if (_isOutputJunk(resultData.output)) {
                  const execOutput = _extractOutput(execution);
                  if (execOutput != null) {
                    resultData.output =
                      typeof execOutput === "string" ? { result: execOutput } : execOutput;
                  }
                }
              }
            } catch {
              // Non-critical
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
          await sleep(pollIntervalMs);
        }
      },

      respond: (output) => this._respond(executionId, output, options?.signal),

      approve: (output?) =>
        this._respond(executionId, { approved: true, ...output }, options?.signal),

      reject: (reason?) => this._respond(executionId, { approved: false, reason }, options?.signal),

      send: (message) => this._respond(executionId, { message }, options?.signal),

      pause: () =>
        this._httpRequest("PUT", `/agent/${executionId}/pause`, undefined, options?.signal).then(
          () => undefined,
        ),

      resume: () =>
        this._httpRequest("PUT", `/agent/${executionId}/resume`, undefined, options?.signal).then(
          () => undefined,
        ),

      cancel: () =>
        this._httpRequest(
          "DELETE",
          `/agent/${executionId}/cancel`,
          undefined,
          options?.signal,
        ).then(() => undefined),

      stop: async () => {
        await this.client.stop(executionId, options?.signal);
        try {
          // Best-effort unblock for any pending wait — failures are
          // swallowed (the stop above already terminated the execution).
          await this.client.signal(executionId, "stopped", options?.signal);
        } catch {
          // Non-fatal.
        }
      },

      stream: () => {
        const apiBaseUrl = this._agentClient.apiBaseUrlSync();
        return new AgentStream(
          `${apiBaseUrl}/agent/stream/${executionId}`,
          () => this._agentClient.authHeaders(),
          executionId,
          async (body) => this._respond(executionId, body, options?.signal),
          apiBaseUrl,
          undefined,
          !this.config.streamingEnabled,
        );
      },
    };

    return handle;
  }
}

// ── Singleton functions ─────────────────────────────────

let _singletonRuntime: AgentRuntime | null = null;

export function getRuntime(): AgentRuntime {
  if (!_singletonRuntime) {
    _singletonRuntime = new AgentRuntime();
  }
  return _singletonRuntime;
}

/**
 * Configure the singleton AgentRuntime.
 */
export function configure(
  configuration?: OrkesApiConfig | ConductorClient,
  settings?: AgentConfigOptions,
): AgentRuntime {
  _singletonRuntime = new AgentRuntime(configuration, settings);
  return _singletonRuntime;
}

/**
 * Run an agent using the singleton runtime.
 * Accepts native Agent instances or framework agent objects.
 */
export function run(
  agent: Agent | object,
  prompt: string,
  options?: RunOptions,
): Promise<AgentResult> {
  return getRuntime().run(agent, prompt, options);
}

/**
 * Start an agent using the singleton runtime.
 * Accepts native Agent instances or framework agent objects.
 */
export function start(
  agent: Agent | object,
  prompt: string,
  options?: RunOptions,
): Promise<AgentHandle> {
  return getRuntime().start(agent, prompt, options);
}

/**
 * Stream an agent using the singleton runtime.
 * Accepts native Agent instances or framework agent objects.
 */
export function stream(
  agent: Agent | object,
  prompt: string,
  options?: RunOptions,
): Promise<AgentStream> {
  return getRuntime().stream(agent, prompt, options);
}

/**
 * Deploy one or more agents using the singleton runtime.
 */
export function deploy(
  agent: Agent | object,
  opts?: { schedules?: Schedule[] | null },
): Promise<DeploymentInfo>;
export function deploy(...agents: (Agent | object)[]): Promise<DeploymentInfo[]>;
export function deploy(...args: unknown[]): Promise<DeploymentInfo | DeploymentInfo[]> {
  return (
    getRuntime().deploy as (...a: unknown[]) => Promise<DeploymentInfo | DeploymentInfo[]>
  )(...args);
}

/**
 * Compile an agent to a workflow definition using the singleton runtime.
 */
export function plan(agent: Agent): Promise<object> {
  return getRuntime().plan(agent);
}

/**
 * Deploy the provided agents, register workers on the singleton runtime, and
 * start polling. See {@link AgentRuntime.serve}.
 */
export function serve(...args: (Agent | object | ServeOptions)[]): Promise<void> {
  return getRuntime().serve(...args);
}

/**
 * Stop the singleton runtime worker polling.
 */
export function shutdown(): Promise<void> {
  return getRuntime().shutdown();
}

// ── Helpers ─────────────────────────────────────────────

function generateCorrelationId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback for environments without crypto.randomUUID
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Execution extraction helpers (mirrors Python SDK) ────

/**
 * Detect "junk" output from the server — workflow state objects that
 * aren't the actual LLM response (e.g. {result: [], finishReason: "TOOL_CALLS"}).
 */
function _isOutputJunk(output: unknown): boolean {
  if (output == null) return true;
  if (typeof output !== "object" || Array.isArray(output)) return false;
  const obj = output as Record<string, unknown>;
  const result = obj.result;
  // {result: null, ...} or {result: [], finishReason: ...}
  if (result === null && "finishReason" in obj) return true;
  if (Array.isArray(result) && result.length === 0) return true;
  return false;
}

/** System task types that are never user-defined tool calls. */
const SYSTEM_TASK_TYPES = new Set([
  "LLM_CHAT_COMPLETE",
  "SWITCH",
  "DO_WHILE",
  "INLINE",
  "SET_VARIABLE",
  "FORK",
  "FORK_JOIN_DYNAMIC",
  "JOIN",
  "SUB_WORKFLOW",
]);

/** Internal keys to strip from tool call input. */
const INTERNAL_KEYS = ["_agent_state", "method", "__humanTaskDefinition"];

/**
 * Extract output from a full execution response.
 * Mirrors Python's wf.output extraction with fallback to messages.
 *
 * The server sometimes returns workflow state as output
 * (e.g. {result: [], finishReason: "TOOL_CALLS"}) instead of the
 * actual LLM text response.  When that happens, fall back to the
 * last assistant message in execution.variables.messages.
 */
function _extractOutput(execution: Record<string, unknown>): unknown {
  const output = execution.output;

  // Try workflow output first
  if (output != null && typeof output === "object" && !Array.isArray(output)) {
    const obj = output as Record<string, unknown>;
    const result = "result" in obj ? obj.result : undefined;
    // Usable if result is a non-empty string or non-empty object/array
    if (result != null && result !== "") {
      if (Array.isArray(result) && result.length === 0) {
        // empty array — fall through to messages
      } else {
        return result;
      }
    }
  } else if (output != null) {
    // Primitive or array — return directly
    return output;
  }

  // Fallback: last assistant message content from execution variables
  const variables = execution.variables as Record<string, unknown> | undefined;
  if (variables && Array.isArray(variables.messages)) {
    for (let i = variables.messages.length - 1; i >= 0; i--) {
      const msg = variables.messages[i] as Record<string, unknown>;
      if (msg.role === "assistant" && msg.content) {
        return msg.content;
      }
    }
  }

  return null;
}

/**
 * Extract conversation messages from execution variables.
 * Mirrors Python's _extract_messages: wf.variables.messages
 */
function _extractMessages(execution: Record<string, unknown>): unknown[] {
  // Backwards-compat: check variables first (populated by some paths)
  const variables = execution.variables as Record<string, unknown> | undefined;
  if (variables && Array.isArray(variables.messages) && variables.messages.length > 0) {
    return variables.messages;
  }

  // Extract from the last LLM_CHAT_COMPLETE task's input messages.
  // The full conversation history is accumulated in the last LLM task's input.
  const tasks = execution.tasks as Record<string, unknown>[] | undefined;
  if (!Array.isArray(tasks)) return [];

  let lastLlmMsgs: unknown[] = [];
  for (const task of tasks) {
    const taskType = String(task.taskType ?? task.task_type ?? "").toUpperCase();
    if (taskType === "LLM_CHAT_COMPLETE") {
      const inputData = (task.inputData ?? task.input_data ?? {}) as Record<string, unknown>;
      const msgs = inputData.messages;
      if (Array.isArray(msgs) && msgs.length > 0) {
        lastLlmMsgs = msgs;
      }
    }
  }
  return lastLlmMsgs;
}

/**
 * Extract tool calls from execution tasks.
 * Mirrors Python's _extract_tool_calls: filters for call_* refs, skips system tasks.
 */
function _extractToolCalls(execution: Record<string, unknown>): unknown[] {
  const tasks = execution.tasks as Record<string, unknown>[] | undefined;
  if (!Array.isArray(tasks)) return [];

  const toolCalls: unknown[] = [];
  for (const task of tasks) {
    const taskType = String(task.taskType ?? task.task_type ?? "").toUpperCase();
    const ref = String(task.referenceTaskName ?? task.reference_task_name ?? "");

    // The call_ prefix is the compiler's marker for tool invocations.
    // Any task with a call_ ref is a user-initiated tool call, regardless
    // of whether the underlying task type is HTTP, CALL_MCP_TOOL, SIMPLE, etc.
    if (!ref.startsWith("call_")) continue;
    // Skip only orchestration-level system tasks (these never have call_ refs,
    // but guard against edge cases)
    if (SYSTEM_TASK_TYPES.has(taskType)) continue;

    const inputData = { ...((task.inputData ?? task.input_data ?? {}) as Record<string, unknown>) };
    for (const k of INTERNAL_KEYS) {
      Reflect.deleteProperty(inputData, k);
    }

    // Use the tool name from inputData.method (set by compiler) if available
    const toolName = String(inputData.method ?? taskType).toLowerCase();
    delete inputData.method;

    toolCalls.push({
      name: toolName,
      args: inputData,
      result: task.outputData ?? task.output_data ?? {},
    });
  }
  return toolCalls;
}

/**
 * Read token counts from a single execution level (no recursion).
 */
function _readTokenUsage(
  execution: Record<string, unknown>,
): { prompt: number; completion: number; total: number; found: boolean } {
  const tokenUsage = execution.tokenUsage as Record<string, unknown> | undefined;
  if (!tokenUsage) return { prompt: 0, completion: 0, total: 0, found: false };

  const prompt = Number(tokenUsage.promptTokens ?? 0);
  const completion = Number(tokenUsage.completionTokens ?? 0);
  const total = Number(tokenUsage.totalTokens ?? 0);

  if (!prompt && !completion && !total) return { prompt: 0, completion: 0, total: 0, found: false };
  return { prompt, completion, total, found: true };
}
