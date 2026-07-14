# API Reference

The public surface of `@io-orkes/conductor-javascript/agents`. One section per type. Everything here is exported from the package root unless noted.

## AgentRuntime

Core execution runtime. Manages agent lifecycle and local tool workers.

```ts
new AgentRuntime(configuration?: OrkesApiConfig | ConductorClient, settings?: AgentConfigOptions)
```

`configuration` is connection/auth (the same shape as every other Conductor client, or a pre-built `ConductorClient` to share one client and one token mint across control- and worker-plane calls); `settings` is behavior-only (see [AgentConfig / AgentConfigOptions](#agentconfig--agentconfigoptions)). Both are optional.

| Member | Signature | Notes |
|---|---|---|
| `config` | `AgentConfig` | Resolved behavior config (readonly). |
| `client` | `AgentClient` | Control-plane client (`/agent/*`) — shares the runtime's underlying Conductor client. |
| `workflows` | `WorkflowClient` | Read-only workflow executions. |
| `run` | `(agent, prompt, options?) => Promise<AgentResult>` | Compile + start + stream + return result. Registers local workers. |
| `start` | `(agent, prompt, options?) => Promise<AgentHandle>` | Async interaction handle. |
| `stream` | `(agent, prompt, options?) => Promise<AgentStream>` | Event stream. |
| `deploy` | `(agent, { schedules? }?) => Promise<DeploymentInfo>` \| `(...agents) => Promise<DeploymentInfo[]>` | Register workflow def(s) (+ reconcile schedules in the single-agent form). No execution, no workers. |
| `plan` | `(agent) => Promise<object>` | Compile to workflow def without executing. |
| `serve` | `(...agents, options?: ServeOptions) => Promise<void>` | Deploys the given agents, registers workers, starts polling. Blocks until SIGINT/SIGTERM by default; `{ blocking: false }` returns once deploy + registration + polling have started. |
| `getStatus` | `(executionId, signal?) => Promise<AgentStatus>` | Current execution status. |
| `schedulesClient` | `() => SchedulerClient` | Schedule lifecycle client (the SDK scheduler client). |
| `shutdown` | `() => Promise<void>` | Stop worker polling. |

`agent` is an `Agent` or a detected framework object. `options?: RunOptions` on `run`/`start`/`stream` includes `runSettings` (see [RunSettings](#runsettings)). Module-level helpers `configure(configuration?, settings?)`, `run`, `start`, `stream`, `deploy`, `plan`, `serve`, `shutdown` operate on a shared singleton runtime.

## AgentClient

`AgentClient` is the interface for the `/agent/*` control-plane HTTP surface (11 ops + `close()`); `OrkesAgentClient` is the Conductor/Orkes implementation, which also carries the agent-level convenience methods below (`run`, `start`, `deploy`, `schedule`) and the `workflows`/`schedules` accessors. **Does not run local tool workers.** Every op rides the shared `ConductorClient`'s authenticated call path — no bespoke auth/transport logic lives behind this interface, so it never mints a token independently.

```ts
new OrkesAgentClient(configuration?: OrkesApiConfig | ConductorClient)
```

Obtain one via `runtime.client` (shares the runtime's client) or `OrkesClients.getAgentClient()` (shares whatever `Client` the `OrkesClients` instance was built with).

| Member | Signature | Notes |
|---|---|---|
| `workflows` | `WorkflowClient` | Read-only workflow client. |
| `schedules` | `SchedulerClient` | Cron lifecycle client (SDK scheduler client over the shared Conductor client). |
| `run` | `(agent, prompt, opts?) => Promise<AgentResult>` | Compile + start + poll to result. |
| `start` | `(agent, prompt, opts?) => Promise<ClientHandle>` | Compile + start; returns a handle. |
| `deploy` | `(agent, { schedules? }?) => Promise<DeploymentInfo>` \| `(...agents) => Promise<DeploymentInfo[]>` | Compile + register agent(s) (+ reconcile schedules in the single-agent form). |
| `schedule` | `(agent, schedules) => Promise<DeploymentInfo>` | Deploy + reconcile schedules. |
| `startAgent` / `deployAgent` / `compile` | `(payload, signal?) => Promise<Record>` | Low-level POST endpoints (spec R1 surface). |
| `status` | `(executionId, signal?) => Promise<AgentStatus>` | GET status. |
| `getExecution` | `(executionId, signal?) => Promise<Record \| null>` | Full execution data (tasks, output, tokens). |
| `listExecutions` | `(params?, signal?) => Promise<Record>` | List executions, optionally filtered. |
| `respond` | `(executionId, body, signal?) => Promise<void>` | Complete a pending human task. |
| `stop` | `(executionId, signal?) => Promise<void>` | Stop a running execution. |
| `signal` | `(executionId, message, signal?) => Promise<void>` | Inject persistent context into a running execution. |
| `stream` | `(executionId, lastEventId?, signal?) => Promise<AgentStream>` | SSE stream for an execution. |
| `close` | `() => Promise<void>` | Release this client's open `AgentStream`s. |

### ClientHandle

Returned by `AgentClient.start`. `{ executionId, getStatus(), wait(pollIntervalMs?), respond(output), approve(output?), reject(reason?), send(message), stop(), stream() }`. `wait()` rejects once its deadline passes (`timeoutSeconds`-derived, or 10 min default) with an `AgentAPIError` naming the last known status.

## WorkflowClient

Read-only client for Conductor workflow executions. Available as `runtime.workflows`.

| Method | Signature | Notes |
|---|---|---|
| `getWorkflow` | `(executionId, includeTasks = true) => Promise<WorkflowExecution>` | Full execution (with tasks). |
| `getStatus` | `(executionId) => Promise<string>` | `'RUNNING'` / `'COMPLETED'` / ... or `''`. |
| `extractTokenUsage` | `(executionId) => Promise<WorkflowTokenUsage \| null>` | Aggregated across sub-workflows. |

`WorkflowTokenUsage` = `{ promptTokens, completionTokens, totalTokens }`.

## AgentConfig / AgentConfigOptions

Behavior-only — no connection/auth fields (those live on `OrkesApiConfig`, the `AgentRuntime`/`OrkesAgentClient` constructors' first argument).

```ts
interface AgentConfigOptions {
  workerPollIntervalMs?: number;         // AGENTSPAN_WORKER_POLL_INTERVAL (100)
  workerThreadCount?: number;            // AGENTSPAN_WORKER_THREADS (1)
  autoStartWorkers?: boolean;            // AGENTSPAN_AUTO_START_WORKERS (true)
  streamingEnabled?: boolean;            // AGENTSPAN_STREAMING_ENABLED (true)
  livenessEnabled?: boolean;             // AGENTSPAN_LIVENESS_ENABLED (true)
  livenessStallSeconds?: number;         // AGENTSPAN_LIVENESS_STALL_SECONDS (30)
  livenessCheckIntervalSeconds?: number; // AGENTSPAN_LIVENESS_CHECK_INTERVAL_SECONDS (10)
}
```

`AgentConfig.fromEnv()` is an exported helper (equivalent to `new AgentConfig()`). See [Liveness monitoring](writing-agents.md#liveness-monitoring) for the liveness fields.

## Agent / agent()

```ts
new Agent(options: AgentOptions)
```

Key `AgentOptions` fields:

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | Required. `/^[a-zA-Z][a-zA-Z0-9_-]*$/`. |
| `model` | `string \| ClaudeCode` | e.g. `'anthropic/claude-sonnet-4-6'`. |
| `baseUrl` | `string` | Override LLM provider base URL. |
| `instructions` | `string \| PromptTemplate \| (() => string)` | Static / template / dynamic. |
| `tools` | `unknown[]` | `tool()` wrappers, built-in tool defs, framework tools. |
| `agents` | `Agent[]` | Sub-agents (multi-agent). |
| `strategy` | `Strategy` | `'sequential' \| 'parallel' \| 'handoff' \| 'router' \| 'round_robin' \| 'random' \| 'swarm' \| 'manual' \| 'plan_execute'`. |
| `router` | `Agent \| (() => string)` | Required for `strategy: 'router'`. |
| `outputType` | Zod schema or JSON Schema | Structured output. |
| `guardrails` | `unknown[]` | Guardrail defs / instances. |
| `handoffs` | `HandoffCondition[]` | `OnTextMention` / `OnToolResult` / `OnCondition`. |
| `allowedTransitions` | `Record<string, string[]>` | Constrain agent transitions. |
| `termination` | `TerminationCondition` | Stop condition. |
| `gate` | `GateCondition` | `TextGate` / `gate()`. |
| `callbacks` | `CallbackHandler[]` | Lifecycle hooks. |
| `memory` | `ConversationMemory` | Conversation history. |
| `maxTurns` | `number` | Default 25. |
| `maxTokens` / `temperature` / `timeoutSeconds` | `number` | LLM + execution tuning. |
| `credentials` | `string[]` | Secret names to resolve. |
| `stateful` | `boolean` | Per-execution worker isolation + shared state. |
| `planner` / `fallback` | `Agent` | PLAN_EXECUTE named slots. |
| `plannerContext` | `(string \| Context \| object)[]` | PLAN_EXECUTE reference docs. |
| `enablePlanning` | `boolean` | Plan-first preamble. |
| `prefillTools` | `PrefillToolCall[]` | Tools run before the first LLM turn. |
| `cliCommands` / `cliAllowedCommands` / `cliConfig` | — | Enable CLI command execution. |
| `codeExecutionConfig` | `CodeExecutionConfig` | Code execution. |
| `introduction` / `metadata` | — | Agent metadata. |

Methods: `agent.pipe(other)` builds a sequential pipeline (flattens chains). Getters: `isClaudeCode`, `claudeCodeConfig`.

Helpers:
- `agent(fn, options)` — functional form; `fn` is the dynamic-instructions callable.
- `scatterGather({ name, workers, model?, instructions?, retryCount?, retryDelaySeconds?, failFast?, timeoutSeconds? })` — coordinator that fans out to worker agents in parallel.
- `AgentDec(options)` + `agentsFrom(instance)` — define agents as decorated class methods.
- `PromptTemplate(name, variables?, version?)` — server-managed prompt reference.

## tool() and built-in tools

```ts
tool(fn: (args, ctx?: ToolContext) => Promise<T>, options: ToolOptions): ToolFunction
```

`ToolOptions`: `{ name?, description, inputSchema, outputSchema?, approvalRequired?, timeoutSeconds?, external?, credentials?, guardrails?, maxCalls?, retryCount?, retryDelaySeconds?, retryPolicy? }`. `inputSchema`/`outputSchema` accept a Zod schema or a JSON Schema object.

Built-in tool builders (all return a `ToolDef`):

| Builder | Required options | toolType |
|---|---|---|
| `httpTool` | `name, description, url` (`method?, headers?, inputSchema?, credentials?`) | `http` |
| `mcpTool` | `serverUrl` (`name?, headers?, toolNames?, maxTools?, credentials?`) | `mcp` |
| `apiTool` | `url` (`name?, headers?, toolNames?, maxTools?, credentials?`) | `api` |
| `agentTool` | `agent` (`name?, description?, retryCount?, retryDelaySeconds?, optional?`) | `agent_tool` |
| `humanTool` | `name, description` (`inputSchema?`) | `human` |
| `imageTool` | `name, description, llmProvider, model` (`style?, size?`) | `generate_image` |
| `audioTool` | `name, description, llmProvider, model` (`voice?, speed?, format?`) | `generate_audio` |
| `videoTool` | `name, description, llmProvider, model` (`duration?, resolution?, fps?, ...`) | `generate_video` |
| `pdfTool` | — (`name?, description?, pageSize?, theme?, fontSize?`) | `generate_pdf` |
| `waitForMessageTool` | `name, description` (`batchSize?` def 1, `blocking?` def true) | `pull_workflow_messages` |
| `searchTool` | `name, description, vectorDb, index, embeddingModelProvider, embeddingModel` (`namespace?, maxResults?, dimensions?`) | `rag_search` |
| `indexTool` | `name, description, vectorDb, index, embeddingModelProvider, embeddingModel` (`namespace?, chunkSize?, chunkOverlap?, dimensions?`) | `rag_index` |

Discovery / helpers: `Tool(options?)` decorator + `toolsFrom(instance)`; `getToolDef(obj)` / `normalizeToolInput(obj)` (extract a `ToolDef` from a `tool()` wrapper, Vercel AI tool, or raw def); `isZodSchema(obj)`.

### ToolContext

Passed as the second arg to a `tool()` function:

```ts
interface ToolContext {
  sessionId: string;
  executionId: string;
  agentName: string;
  metadata: Record<string, unknown>;
  dependencies: Record<string, unknown>;
  state: Record<string, unknown>;   // mutable; mutations propagate between tool calls
}
```

## Guardrails

- `guardrail(fn, { name, position?, onFail?, maxRetries? })` — custom guardrail from a function returning `{ passed, message?, fixedOutput? }`. `guardrail.external({ name, position?, onFail? })` for remote-worker guardrails.
- `new RegexGuardrail({ name, patterns, mode, position?, onFail?, message?, maxRetries? })` — `mode: 'block' | 'allow'`. `.toGuardrailDef()`.
- `new LLMGuardrail({ name, model, policy, position?, onFail?, maxRetries?, maxTokens? })` — server-side LLM judge. `.toGuardrailDef()`.
- `Guardrail(options?)` decorator + `guardrailsFrom(instance)`.

`position`: `'input' | 'output'` (default `'output'`). `onFail`: `'raise' | 'retry' | 'fix' | 'human'` (default `'raise'`). Attach via `agent.guardrails` or `tool(fn, { guardrails })`.

## Termination

All extend `TerminationCondition` and compose via `.and(other)` / `.or(other)` (or variadic `AndCondition(...)` / `OrCondition(...)`).

| Class | Constructor |
|---|---|
| `TextMention` | `(text, caseSensitive = false)` |
| `StopMessage` | `(stopMessage)` |
| `MaxMessage` | `(maxMessages)` |
| `TokenUsageCondition` | `({ maxTotalTokens?, maxPromptTokens?, maxCompletionTokens? })` |
| `AndCondition` / `OrCondition` | `(...conditions)` |

## Handoffs

- `new OnTextMention({ target, text })` — hand off when output mentions `text` (case-insensitive).
- `new OnToolResult({ target, toolName, resultContains? })` — hand off after a tool returns.
- `new OnCondition({ target, condition, agentName? })` — hand off when a predicate (runs as a worker) returns true.
- `new TextGate({ text, caseSensitive? })` — gate on text containment (`gate:` option).
- `gate(fn, { agentName? })` — custom gate from a function.

`HandoffContext` (passed to conditions): `{ result, toolName?, toolResult?, messages? }`.

## Callbacks

Subclass `CallbackHandler` and override hooks (each runs as a server worker):

```ts
abstract class CallbackHandler {
  onAgentStart?(agentName, prompt): Promise<void>;
  onAgentEnd?(agentName, result): Promise<void>;
  onModelStart?(agentName, messages): Promise<void>;
  onModelEnd?(agentName, response): Promise<void>;
  onToolStart?(agentName, toolName, args): Promise<void>;
  onToolEnd?(agentName, toolName, result): Promise<void>;
}
```

`CALLBACK_POSITIONS` maps hook names to wire positions; `getCallbackWorkerNames(agentName, handler)` lists registered worker names.

## Schedules / SchedulerClient

```ts
new Schedule({ name, cron, timezone?, input?, catchup?, paused?, startAt?, endAt?, description? })
```

Agent schedules ride the SDK `SchedulerClient` (also available via `OrkesClients.getSchedulerClient()`). Its typed lifecycle methods: `save(schedule, agentName)`, `get(wireName, agentName?)`, `listForAgent(agentName)`, `pause(wireName, reason?)`, `resume(wireName)`, `delete(wireName)`, `runNow(info)`, `previewNext(cron, { n?, startAt?, endAt? })`, `reconcile(agentName, desired)` — plus the endpoint-level wrappers (`saveSchedule`, `getSchedule`, `pauseSchedule`, ...). Pause/resume issue PUT first and fall back to GET on HTTP 405 (per-schedule verbs differ by Conductor server family), so one client works against both OSS/embedded and Orkes servers.

The `schedules` namespace is a convenience layer over the singleton runtime: `schedules.list({ agent })`, `.get(name, { runtime? })`, `.pause(name, { reason?, runtime? })`, `.resume`, `.delete`, `.runNow`, `.previewNext(cron, { n? })`, `.save(schedule, agent)`. Lifecycle calls key on the **wire name** (the prefixed `name` in `ScheduleInfo`).

Errors: `ScheduleError`, `ScheduleNameConflict`, `ScheduleNotFound`, `InvalidCronExpression`. `ScheduleInfo` includes `name`, `shortName`, `agent`, `cron`, `timezone`, `paused`, `pausedReason`, `nextRun`, ...

## AgentResult

Returned by `run()` / `wait()`.

```ts
interface AgentResult {
  output: Record<string, unknown>;   // text answer -> { result: "..." }
  executionId: string;
  correlationId?: string;
  messages: unknown[];
  toolCalls: unknown[];
  status: 'COMPLETED' | 'FAILED' | 'TERMINATED' | 'TIMED_OUT';
  finishReason: 'stop' | 'length' | 'tool_calls' | 'error' | 'cancelled' | 'timeout' | 'guardrail' | 'rejected';
  error?: string;
  tokenUsage?: { promptTokens; completionTokens; totalTokens };
  metadata?: Record<string, unknown>;
  events: AgentEvent[];
  subResults?: Record<string, unknown>;
  readonly isSuccess: boolean;   // status === 'COMPLETED'
  readonly isFailed: boolean;    // FAILED | TIMED_OUT
  readonly isRejected: boolean;  // finishReason === 'rejected'
  printResult(): void;
}
```

## AgentHandle

Returned by `runtime.start()`.

```ts
interface AgentHandle {
  executionId: string;
  correlationId: string;
  getStatus(): Promise<AgentStatus>;
  wait(pollIntervalMs?): Promise<AgentResult>;
  respond(output): Promise<void>;
  approve(output?): Promise<void>;
  reject(reason?): Promise<void>;
  send(message): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  cancel(): Promise<void>;
  stop(): Promise<void>;
  stream(): AgentStream;
}
```

`approve()` sends `{ approved: true, ...output }`; `reject(reason)` sends `{ approved: false, reason }`; `send(message)` sends `{ message }`. For a custom human-task response (shaped by `pendingTool.response_schema`), use `respond(body)`. `wait(pollIntervalMs?)` rejects once its deadline passes (`timeoutSeconds`-derived, or 10 min default) with an `AgentAPIError` naming the last known status — and, for a stateful (domain-routed) run with liveness enabled, rejects earlier with `WorkerStallError` if the local worker appears to have died (see [Liveness monitoring](writing-agents.md#liveness-monitoring)).

## AgentStream / AgentEvent

`AgentStream` implements `AsyncIterable<AgentEvent>` — iterate with `for await`. Methods: `respond(output)`, `approve(output?)`, `reject(reason?)`, `send(message)`, and `getResult(): Promise<AgentResult>` (drains the stream, polls for the terminal status, returns the result). Fields: `executionId`, `events` (accumulates).

```ts
interface AgentEvent {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'guardrail_pass' | 'guardrail_fail'
      | 'waiting' | 'handoff' | 'message' | 'error' | 'done' | string;
  content?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  target?: string;          // handoff target
  output?: unknown;         // on 'done'
  pendingTool?: PendingTool;// on 'waiting'
  guardrailName?: string;
}
```

`AgentStatus`: `{ executionId, isComplete, isRunning, isWaiting, output?, status, reason?, currentTask?, messages, pendingTool? }`. `PendingTool`: `{ taskRefName, toolCalls?: { name, args }[], response_schema?, ... }`. `EventTypes`, `Statuses`, `FinishReasons`, `TERMINAL_STATUSES` enums are exported.

## Errors

`AgentspanError` (base), `AgentAPIError`, `AgentNotFoundError`, `ConfigurationError`, `CredentialNotFoundError`, `CredentialAuthError`, `CredentialRateLimitError`, `CredentialServiceError`, `SSETimeoutError`, `TerminalToolError`, `WorkerStallError`, `GuardrailFailedError`.

## RunSettings

Per-run LLM overrides, passed as `RunOptions.runSettings` to `run`/`start`/`stream`. See [Advanced: RunSettings](advanced.md#runsettings--per-run-llm-overrides).

```ts
interface RunSettings {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: string;
  thinkingBudgetTokens?: number;
}
```

## Other exports

- **Memory:** `ConversationMemory`, `SemanticMemory`, `InMemoryStore`.
- **Plans:** `Plan`, `Step`, `Op`, `Generate`, `Validation`, `Action`, `Ref`, `Context`, `coercePlan`.
- **Skills:** `skill(path, options?)`, `loadSkills(dir, options?)`, `SkillLoadError`.
- **Credentials:** `getCredential`, `runWithCredentialContext`, `setCredentialContext`, `clearCredentialContext`. Values arrive wire-only on the polled task's `runtimeMetadata` (spec R6) — never fetched separately; see [Credentials and secrets](advanced.md#credentials-and-secrets).
- **Liveness:** `LivenessMonitor`, `LivenessMonitorOptions` — see [Liveness monitoring](writing-agents.md#liveness-monitoring).
- **Code execution:** `LocalCodeExecutor`, `DockerCodeExecutor`, `JupyterCodeExecutor`, `ServerlessCodeExecutor`, `CodeExecutor`, `CommandValidator`.
- **Claude Code:** `ClaudeCode(modelName?, permissionMode?)`, `PermissionMode`, `resolveClaudeCodeModel`.
- **Extended agents:** `GPTAssistantAgent({ name, assistantId, model?, instructions? })`.
- **Framework integration:** `detectFramework`, `serializeFrameworkAgent`, `serializeLangGraph`, `serializeLangChain`.
- **Subpath exports:** `@io-orkes/conductor-javascript/agents/vercel-ai`, `@io-orkes/conductor-javascript/agents/langgraph`, `@io-orkes/conductor-javascript/agents/langchain`, `@io-orkes/conductor-javascript/agents/testing`.
