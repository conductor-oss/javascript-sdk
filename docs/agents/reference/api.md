# Agent API map

| Need | JS API | Guide |
|---|---|---|
| Define an agent | `Agent`, `agent()`, `AgentDec`/`agentsFrom` | [Agents](../concepts/agents.md), [Agent definition](agent-definition.md) |
| Define tools | `tool()`, built-in tool factories, `Tool`/`toolsFrom` | [Tools](../concepts/tools.md) |
| Run lifecycle operations | `AgentRuntime`, module-level helpers | [Runtime](runtime.md), [Deploy/serve/run/plan](../concepts/deploy-serve-run.md) |
| Control an execution | `AgentClient`, `AgentHandle`, `ClientHandle` | [Control plane](client.md) |
| Add safety controls | guardrail and termination classes | [Guardrails](../concepts/guardrails.md), [Termination](../concepts/termination.md) |
| Compose agents | `Strategy`, handoffs, `plan_execute` | [Multi-agent](../concepts/multi-agent.md) |
| Bridge frameworks | framework detection + subpath wrappers | [Framework bridges](../README.md#framework-bridges) |

The public surface of `@io-orkes/conductor-javascript/agents`. Everything
below is exported from the package root unless noted.

## tool() and built-in tools

```ts
tool(fn: (args, ctx?: ToolContext) => Promise<T>, options: ToolOptions): ToolFunction
```

`ToolOptions`: `{ name?, description, inputSchema, outputSchema?,
approvalRequired?, timeoutSeconds?, external?, credentials?, guardrails?,
maxCalls?, retryCount?, retryDelaySeconds?, retryPolicy? }`.
`inputSchema`/`outputSchema` accept a Zod schema or a JSON Schema object.

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

Discovery / helpers: `Tool(options?)` decorator + `toolsFrom(instance)`;
`getToolDef(obj)` / `normalizeToolInput(obj)` (extract a `ToolDef` from a
`tool()` wrapper, Vercel AI tool, or raw def); `isZodSchema(obj)`.

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

- `guardrail(fn, { name, position?, onFail?, maxRetries? })` — custom
  guardrail from a function returning `{ passed, message?, fixedOutput? }`.
  `guardrail.external({ name, position?, onFail? })` for remote-worker
  guardrails.
- `new RegexGuardrail({ name, patterns, mode, position?, onFail?, message?,
  maxRetries? })` — `mode: 'block' | 'allow'`. `.toGuardrailDef()`.
- `new LLMGuardrail({ name, model, policy, position?, onFail?, maxRetries?,
  maxTokens? })` — server-side LLM judge. `.toGuardrailDef()`.
- `Guardrail(options?)` decorator + `guardrailsFrom(instance)`.

`position`: `'input' | 'output'` (default `'output'`). `onFail`: `'raise' |
'retry' | 'fix' | 'human'` (default `'raise'`). Attach via `agent.guardrails`
or `tool(fn, { guardrails })`.

## Termination

All extend `TerminationCondition` and compose via `.and(other)` /
`.or(other)` (or variadic `AndCondition(...)` / `OrCondition(...)`).

| Class | Constructor |
|---|---|
| `TextMention` | `(text, caseSensitive = false)` |
| `StopMessage` | `(stopMessage)` |
| `MaxMessage` | `(maxMessages)` |
| `TokenUsageCondition` | `({ maxTotalTokens?, maxPromptTokens?, maxCompletionTokens? })` |
| `AndCondition` / `OrCondition` | `(...conditions)` |

## Handoffs

- `new OnTextMention({ target, text })` — hand off when output mentions
  `text` (case-insensitive).
- `new OnToolResult({ target, toolName, resultContains? })` — hand off after
  a tool returns.
- `new OnCondition({ target, condition, agentName? })` — hand off when a
  predicate (runs as a worker) returns true.
- `new TextGate({ text, caseSensitive? })` — gate on text containment
  (`gate:` option).
- `gate(fn, { agentName? })` — custom gate from a function.

`HandoffContext` (passed to conditions): `{ result, toolName?, toolResult?,
messages? }`.

## Callbacks

Subclass `CallbackHandler` and override hooks (each runs as a server
worker):

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

`CALLBACK_POSITIONS` maps hook names to wire positions;
`getCallbackWorkerNames(agentName, handler)` lists registered worker names.

## Schedules / SchedulerClient

```ts
new Schedule({ name, cron, timezone?, input?, catchup?, paused?, startAt?, endAt?, description? })
```

Agent schedules ride the SDK `SchedulerClient` (also available via
`OrkesClients.getSchedulerClient()`). Its typed lifecycle methods:
`save(schedule, agentName)`, `get(wireName, agentName?)`,
`listForAgent(agentName)`, `pause(wireName, reason?)`, `resume(wireName)`,
`delete(wireName)`, `runNow(info)`, `previewNext(cron, { n?, startAt?,
endAt? })`, `reconcile(agentName, desired)` — plus the endpoint-level
wrappers (`saveSchedule`, `getSchedule`, `pauseSchedule`, ...). Pause/resume
issue PUT first and fall back to GET on HTTP 405 (per-schedule verbs differ
by Conductor server family), so one client works against both OSS/embedded
and Orkes servers.

The `schedules` namespace is a convenience layer over the singleton runtime:
`schedules.list({ agent })`, `.get(name, { runtime? })`, `.pause(name, {
reason?, runtime? })`, `.resume`, `.delete`, `.runNow`, `.previewNext(cron, {
n? })`, `.save(schedule, agent)`. Lifecycle calls key on the **wire name**
(the prefixed `name` in `ScheduleInfo`).

Errors: `ScheduleError`, `ScheduleNameConflict`, `ScheduleNotFound`,
`InvalidCronExpression`. `ScheduleInfo` includes `name`, `shortName`,
`agent`, `cron`, `timezone`, `paused`, `pausedReason`, `nextRun`, ...

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

`approve()` sends `{ approved: true, ...output }`; `reject(reason)` sends `{
approved: false, reason }`; `send(message)` sends `{ message }`. For a custom
human-task response (shaped by `pendingTool.response_schema`), use
`respond(body)`. `wait(pollIntervalMs?)` rejects once its deadline passes
(`timeoutSeconds`-derived, or 10 min default) with an `AgentAPIError` naming
the last known status — and, for a stateful (domain-routed) run with
liveness enabled, rejects earlier with `WorkerStallError` if the local
worker appears to have died (see
[Liveness monitoring](../concepts/stateful.md#liveness-monitoring)).

`pause()`/`resume()` here pause/resume a running execution (distinct from
[schedule pause/resume](#schedules--schedulerclient), which pauses a cron
definition, not a live run).

## AgentStream / AgentEvent

`AgentStream` implements `AsyncIterable<AgentEvent>` — iterate with `for
await`. Methods: `respond(output)`, `approve(output?)`, `reject(reason?)`,
`send(message)`, and `getResult(): Promise<AgentResult>` (drains the stream,
polls for the terminal status, returns the result). Fields: `executionId`,
`events` (accumulates).

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

`AgentStatus`: `{ executionId, isComplete, isRunning, isWaiting, output?,
status, reason?, currentTask?, messages, pendingTool? }`. `PendingTool`: `{
taskRefName, toolCalls?: { name, args }[], response_schema?, ... }`.
`EventTypes`, `Statuses`, `FinishReasons`, `TERMINAL_STATUSES` enums are
exported.

## Errors

`ConductorAgentError` (base), `AgentAPIError`, `AgentNotFoundError`,
`ConfigurationError`, `CredentialNotFoundError`, `CredentialAuthError`,
`CredentialRateLimitError`, `CredentialServiceError`, `SSETimeoutError`,
`TerminalToolError`, `WorkerStallError`, `GuardrailFailedError`.

`SSEUnavailableError` also extends `ConductorAgentError` but isn't exported
from the package root — it's thrown internally when an SSE connection can't
be established and caught by `AgentStream` itself to trigger the automatic
polling fallback (see [SSE fallback](../concepts/streaming-hitl.md#sse-fallback));
there's no caller-visible error for this case since the fallback is
transparent.

## RunSettings

Per-run LLM overrides, passed as `RunOptions.runSettings` to
`run`/`start`/`stream`.

```ts
interface RunSettings {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: string;
  thinkingBudgetTokens?: number;
}
```

`RunOptions.runSettings` overrides the LLM call for a single
`run`/`start`/`stream`, without touching the agent's own config. Only set
fields override; unset fields keep the agent's own serialized values, and
the override doesn't cascade to sub-agents (each keeps its own settings).

```ts
const result = await runtime.run(agent, prompt, {
  runSettings: {
    model: 'anthropic/claude-sonnet-4-6', // overrides agent.model for this run
    temperature: 0.2,
    maxTokens: 4096,
    reasoningEffort: 'high',
    thinkingBudgetTokens: 8000,           // maps to the wire thinkingConfig shape
  },
});

// RunOptions.model is sugar for runSettings.model -- an explicit runSettings.model wins:
await runtime.run(agent, prompt, { model: 'openai/gpt-4o-mini' });
```

## Credentials and secrets

Pass credential names with `credentials: [...]` at the agent level and/or
per tool. The server resolves secrets when it polls each task and delivers
them **wire-only**, on that task's `runtimeMetadata` — never persisted,
never fetched by the worker separately. The SDK injects them into the
worker's `process.env` for the duration of the call (mutate-invoke-restore,
serialized so concurrent calls don't clobber each other's env). For
HTTP/MCP tools, reference them inline in headers with `${NAME}`
substitution.

**Fail-closed, no fallback:** if a tool declares `credentials: [...]` and the
server didn't deliver one of them on `runtimeMetadata` (e.g. an older server
that predates `TaskDef.runtimeMetadata` support), the task fails with a
non-retryable error naming the missing credential. There is no ambient-env
fallback to silently read a locally-set variable instead.

```ts
import { Agent, tool, httpTool, getCredential } from '@io-orkes/conductor-javascript/agents';

// A worker tool: the secret is injected into the worker's process.env for the call
const dbLookup = tool(
  async (args: { query: string }) => {
    const key = process.env.DB_API_KEY ?? '';
    return { ok: key !== '' };
  },
  {
    name: 'db_lookup',
    description: 'Look up data.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    credentials: ['DB_API_KEY'],
  },
);

// Or fetch a credential explicitly inside a tool
const analytics = tool(
  async (args: { topic: string }) => {
    const key = await getCredential('ANALYTICS_KEY');
    return { topic: args.topic, ok: !!key };
  },
  { name: 'analytics', description: 'Query analytics.', inputSchema: {
    type: 'object', properties: { topic: { type: 'string' } }, required: ['topic'],
  }, credentials: ['ANALYTICS_KEY'] },
);

// HTTP tool with ${CRED} header substitution
const searchApi = httpTool({
  name: 'search_api',
  description: 'Search.',
  url: 'https://api.example.com/search',
  headers: { Authorization: 'Bearer ${SEARCH_API_KEY}' },
  credentials: ['SEARCH_API_KEY'],
});

const agent = new Agent({
  name: 'credentialed_agent',
  model: 'anthropic/claude-sonnet-4-6',
  instructions: '…',
  tools: [dbLookup, analytics, searchApi],
  credentials: ['DB_API_KEY', 'ANALYTICS_KEY', 'SEARCH_API_KEY'],
});
```

You can also pass `credentials` at call time: `runtime.run(agent, prompt, {
credentials: ['X'] })`.

## Skills

`skill(path, options?)` loads a `SKILL.md` skill directory as an `Agent`;
`loadSkills(dir)` loads every skill subdirectory keyed by name. Skills are
framework agents (`_framework: "skill"`) and run via the same `run()` path;
they can be wrapped with `agentTool` and used inside other agents.

```ts
import { skill, loadSkills, agentTool, Agent } from '@io-orkes/conductor-javascript/agents';

const reviewer = skill('./skills/code-review', { model: 'openai/gpt-4o' });
const all = loadSkills('./skills');          // Record<string, Agent>

const orchestrator = new Agent({
  name: 'lead',
  model: 'anthropic/claude-sonnet-4-6',
  instructions: 'Delegate reviews to the code-review skill.',
  tools: [agentTool(reviewer)],
});
```

## Other exports

- **Memory:** `ConversationMemory`, `SemanticMemory`, `InMemoryStore` — see
  [Stateful agents: Memory](../concepts/stateful.md#memory).
- **Plans:** `Plan`, `Step`, `Op`, `Generate`, `Validation`, `Action`, `Ref`,
  `Context`, `coercePlan` — see
  [Plans / PLAN_EXECUTE](../concepts/deploy-serve-run.md#plans--plan_execute).
- **Liveness:** `LivenessMonitor`, `LivenessMonitorOptions` — see
  [Liveness monitoring](../concepts/stateful.md#liveness-monitoring).
- **Code execution:** `LocalCodeExecutor`, `DockerCodeExecutor`,
  `JupyterCodeExecutor`, `ServerlessCodeExecutor`, `CodeExecutor`,
  `CommandValidator`.
- **Claude Code:** `ClaudeCode(modelName?, permissionMode?)`,
  `PermissionMode`, `resolveClaudeCodeModel`.
- **Extended agents:** `GPTAssistantAgent({ name, assistantId, model?,
  instructions? })`.
- **Framework integration:** `detectFramework`, `serializeFrameworkAgent`,
  `serializeLangGraph`, `serializeLangChain` — see
  [Framework bridges](../README.md#framework-bridges).
- **Subpath exports:** `@io-orkes/conductor-javascript/agents/vercel-ai`,
  `@io-orkes/conductor-javascript/agents/langgraph`,
  `@io-orkes/conductor-javascript/agents/langchain`,
  `@io-orkes/conductor-javascript/agents/testing`.

## Next steps

See [agent definition](agent-definition.md) for `Agent`/`AgentOptions`, and
[runtime](runtime.md)/[client](client.md) for the two ways to execute one.
