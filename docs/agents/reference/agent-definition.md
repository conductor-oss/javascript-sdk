# Agent definition fields

**Audience:** developers looking up an `AgentOptions` field, a tool builder
signature, or a result type.

## Prerequisites

None. This is a lookup page; the narrative lives in
[../concepts/agents.md](../concepts/agents.md).

## Agent

```ts
new Agent(options: AgentOptions)
```

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | Required. `/^[a-zA-Z][a-zA-Z0-9_-]*$/`. |
| `model` | `string \| ClaudeCode` | e.g. `'anthropic/claude-sonnet-4-6'`. |
| `baseUrl` | `string` | Override the LLM provider base URL. |
| `instructions` | `string \| PromptTemplate \| (() => string)` | Static, template, or dynamic. Callables evaluate at serialization time. |
| `tools` | `unknown[]` | `tool()` wrappers, built-in tool defs, framework tools. |
| `agents` | `Agent[]` | Sub-agents. |
| `strategy` | `Strategy` | `'sequential' \| 'parallel' \| 'handoff' \| 'router' \| 'round_robin' \| 'random' \| 'swarm' \| 'manual' \| 'plan_execute'`. |
| `router` | `Agent \| (() => string)` | Required for `strategy: 'router'`. |
| `outputType` | Zod or JSON Schema | Structured output. |
| `guardrails` | `unknown[]` | Guardrail defs or instances. |
| `handoffs` | `HandoffCondition[]` | `OnTextMention` / `OnToolResult` / `OnCondition`. |
| `allowedTransitions` | `Record<string, string[]>` | Constrain transitions. |
| `termination` | `TerminationCondition` | Stop condition. |
| `gate` | `GateCondition` | `TextGate` / `gate()`. |
| `callbacks` | `CallbackHandler[]` | Lifecycle hooks. |
| `memory` | `ConversationMemory` | Conversation history. |
| `maxTurns` | `number` | Default 25. |
| `maxTokens` / `temperature` / `timeoutSeconds` | `number` | Tuning. `timeoutSeconds: 0` = server default. |
| `credentials` | `string[]` | Secret names to resolve. |
| `stateful` | `boolean` | Per-execution worker isolation and shared state. |
| `planner` / `fallback` | `Agent` | `plan_execute` slots. `planner` required. |
| `plannerContext` | `(string \| Context \| object)[]` | Planner reference docs. |
| `enablePlanning` | `boolean` | Plan-first preamble. |
| `prefillTools` | `PrefillToolCall[]` | Tools run before the first LLM turn. |
| `cliCommands` / `cliAllowedCommands` / `cliConfig` | — | CLI command execution. |
| `codeExecutionConfig` | `CodeExecutionConfig` | Code execution. |
| `introduction` / `metadata` | — | Agent metadata. |

Methods: `agent.pipe(other)` builds a sequential pipeline, flattening chains.
Getters: `isClaudeCode`, `claudeCodeConfig`.

Helpers: `agent(fn, options)`, `scatterGather({ name, workers, model?, instructions?, retryCount?, retryDelaySeconds?, failFast?, timeoutSeconds? })`,
`AgentDec(options)` + `agentsFrom(instance)`,
`PromptTemplate(name, variables?, version?)`.

## tool()

```ts
tool(fn: (args, ctx?: ToolContext) => Promise<T>, options: ToolOptions): ToolFunction
```

`ToolOptions`: `{ name?, description, inputSchema, outputSchema?, approvalRequired?, timeoutSeconds?, external?, credentials?, guardrails?, maxCalls?, retryCount?, retryDelaySeconds?, retryPolicy? }`.
Schemas accept Zod or JSON Schema.

| Builder | Required options | `toolType` |
|---|---|---|
| `httpTool` | `name, description, url` (`method?, headers?, inputSchema?, credentials?`) | `http` |
| `mcpTool` | `serverUrl` (`name?, headers?, toolNames?, maxTools?, credentials?`) | `mcp` |
| `apiTool` | `url` (`name?, headers?, toolNames?, maxTools?, credentials?`) | `api` |
| `agentTool` | `agent` (`name?, description?, retryCount?, retryDelaySeconds?, optional?`) | `agent_tool` |
| `humanTool` | `name, description` (`inputSchema?`) | `human` |
| `imageTool` | `name, description, llmProvider, model` (`style?, size?`) | `generate_image` |
| `audioTool` | `name, description, llmProvider, model` (`voice?, speed?, format?`) | `generate_audio` |
| `videoTool` | `name, description, llmProvider, model` (`duration?, resolution?, fps?, …`) | `generate_video` |
| `pdfTool` | — (`name?, description?, pageSize?, theme?, fontSize?`) | `generate_pdf` |
| `waitForMessageTool` | `name, description` (`batchSize?` = 1, `blocking?` = true) | `pull_workflow_messages` |
| `searchTool` | `name, description, vectorDb, index, embeddingModelProvider, embeddingModel` (`namespace?, maxResults?, dimensions?`) | `rag_search` |
| `indexTool` | `name, description, vectorDb, index, embeddingModelProvider, embeddingModel` (`namespace?, chunkSize?, chunkOverlap?, dimensions?`) | `rag_index` |

Discovery and helpers: `Tool(options?)` + `toolsFrom(instance)`;
`getToolDef(obj)` / `normalizeToolInput(obj)`; `isZodSchema(obj)`.

### ToolContext

```ts
interface ToolContext {
  sessionId: string;
  executionId: string;
  agentName: string;
  metadata: Record<string, unknown>;
  dependencies: Record<string, unknown>;
  state: Record<string, unknown>;   // mutable; propagates between tool calls
}
```

## Guardrails

- `guardrail(fn, { name, position?, onFail?, maxRetries? })` — `fn` returns
  `{ passed, message?, fixedOutput? }`. `guardrail.external({ … })` for remote workers.
- `new RegexGuardrail({ name, patterns, mode, position?, onFail?, message?, maxRetries? })` — `mode: 'block' | 'allow'`.
- `new LLMGuardrail({ name, model, policy, position?, onFail?, maxRetries?, maxTokens? })`.
- `Guardrail(options?)` + `guardrailsFrom(instance)`.

`position`: `'input' | 'output'` (default `'output'`). `onFail`:
`'raise' | 'retry' | 'fix' | 'human'` (default `'raise'`).

## Termination and handoffs

| Class | Constructor |
|---|---|
| `TextMention` | `(text, caseSensitive = false)` |
| `StopMessage` | `(stopMessage)` |
| `MaxMessage` | `(maxMessages)` |
| `TokenUsageCondition` | `({ maxTotalTokens?, maxPromptTokens?, maxCompletionTokens? })` |
| `AndCondition` / `OrCondition` | `(...conditions)` |

Compose with `.and(other)` / `.or(other)`.

- `new OnTextMention({ target, text })`
- `new OnToolResult({ target, toolName, resultContains? })`
- `new OnCondition({ target, condition, agentName? })` — runs as a worker
- `new TextGate({ text, caseSensitive? })`, `gate(fn, { agentName? })`

`HandoffContext`: `{ result, toolName?, toolResult?, messages? }`.

## Callbacks

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

`CALLBACK_POSITIONS` maps hooks to wire positions;
`getCallbackWorkerNames(agentName, handler)` lists registered worker names.

## Schedules

```ts
new Schedule({ name, cron, timezone?, input?, catchup?, paused?, startAt?, endAt?, description? })
```

`SchedulerClient` methods: `save(schedule, agentName)`, `get(wireName, agentName?)`,
`listForAgent(agentName)`, `pause(wireName, reason?)`, `resume(wireName)`,
`delete(wireName)`, `runNow(info)`, `previewNext(cron, { n?, startAt?, endAt? })`,
`reconcile(agentName, desired)`.

Pause and resume issue PUT first and fall back to GET on HTTP 405, because
per-schedule verbs differ by Conductor server family — one client works against
both OSS/embedded and Orkes.

The `schedules` namespace is a convenience layer over the singleton runtime.
**Lifecycle calls key on the wire name** (the prefixed `name` in `ScheduleInfo`),
not the short name you supplied.

Errors: `ScheduleError`, `ScheduleNameConflict`, `ScheduleNotFound`,
`InvalidCronExpression`.

## AgentResult

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

A guardrail block yields `status: 'COMPLETED'` with
`finishReason: 'guardrail'` — check `finishReason`, not only `isSuccess`.

## AgentHandle

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

`approve()` sends `{ approved: true, ...output }`; `reject(reason)` sends
`{ approved: false, reason }`; `send(message)` sends `{ message }`. For a custom
human-task response shaped by `pendingTool.response_schema`, use `respond(body)`.

`wait(pollIntervalMs?)` rejects on deadline with an `AgentAPIError` naming the last
known status — and for a stateful, domain-routed run with liveness enabled, rejects
earlier with `WorkerStallError` if the local worker appears to have died. See
[../concepts/stateful.md](../concepts/stateful.md#liveness-monitoring).

## AgentStream and AgentEvent

`AgentStream` implements `AsyncIterable<AgentEvent>`. Methods: `respond`,
`approve`, `reject`, `send`, and `getResult()` (drains, polls for terminal status,
returns the result). Fields: `executionId`, `events`.

```ts
interface AgentEvent {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'guardrail_pass' | 'guardrail_fail'
      | 'waiting' | 'handoff' | 'message' | 'error' | 'done' | string;
  content?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  target?: string;            // handoff target
  output?: unknown;           // on 'done'
  pendingTool?: PendingTool;  // on 'waiting'
  guardrailName?: string;
}
```

`AgentStatus`: `{ executionId, isComplete, isRunning, isWaiting, output?, status, reason?, currentTask?, messages, pendingTool? }`.
`PendingTool`: `{ taskRefName, toolCalls?: { name, args }[], response_schema?, … }`.
`EventTypes`, `Statuses`, `FinishReasons`, `TERMINAL_STATUSES` are exported.

## Errors

`ConductorAgentError` (base), `AgentAPIError`, `AgentNotFoundError`,
`ConfigurationError`, `CredentialNotFoundError`, `CredentialAuthError`,
`CredentialRateLimitError`, `CredentialServiceError`, `SSETimeoutError`,
`SSEUnavailableError`, `TerminalToolError`, `WorkerStallError`,
`GuardrailFailedError`.

`AgentspanError` remains exported as a deprecated alias of `ConductorAgentError` —
the same class object, so `instanceof` works in both directions. See
[../../upgrading.md](../../upgrading.md).

## RunSettings

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
- **Credentials:** `getCredential`, `runWithCredentialContext`, `setCredentialContext`, `clearCredentialContext`.
- **Liveness:** `LivenessMonitor`, `LivenessMonitorOptions`.
- **Code execution:** `LocalCodeExecutor`, `DockerCodeExecutor`, `JupyterCodeExecutor`, `ServerlessCodeExecutor`, `CodeExecutor`, `CommandValidator`.
- **Claude Code:** `ClaudeCode(modelName?, permissionMode?)`, `PermissionMode`, `resolveClaudeCodeModel`.
- **Extended agents:** `GPTAssistantAgent({ name, assistantId, model?, instructions? })`.
- **Framework integration:** `detectFramework`, `serializeFrameworkAgent`, `serializeLangGraph`, `serializeLangChain`.
- **Subpaths:** `/agents/vercel-ai`, `/agents/langgraph`, `/agents/langchain`, `/agents/testing`.

## Next steps

[api.md](api.md) · [runtime.md](runtime.md) · [agent-schema.md](agent-schema.md)
