# Agent definition fields

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

Methods: `agent.pipe(other)` builds a sequential pipeline (flattens chains).
Getters: `isClaudeCode`, `claudeCodeConfig`.

Helpers:
- `agent(fn, options)` — functional form; `fn` is the dynamic-instructions
  callable.
- `scatterGather({ name, workers, model?, instructions?, retryCount?,
  retryDelaySeconds?, failFast?, timeoutSeconds? })` — coordinator that fans
  out to worker agents in parallel.
- `AgentDec(options)` + `agentsFrom(instance)` — define agents as decorated
  class methods.
- `PromptTemplate(name, variables?, version?)` — server-managed prompt
  reference.

Names must match `^[a-zA-Z][a-zA-Z0-9_-]*$`. An omitted `model` is valid only
for inherited-model or external-agent (`external: true`) designs. The
complete constructor and serialization semantics are maintained in
[`agent.ts`](../../../src/agents/agent.ts) and
[`serializer.ts`](../../../src/agents/serializer.ts); use those sources when
adding a newly supported field, and update the
[agent schema](agent-schema.md) alongside.

## Next steps

See [agents](../concepts/agents.md) for authoring patterns, the
[agent schema](agent-schema.md) for the wire contract this maps to, and the
[API reference](api.md) for everything else in the public surface.
