# Agent configuration contract

The canonical wire contract is the object emitted by
[`AgentConfigSerializer.serializeAgent()`](../../../src/agents/serializer.ts)
under the `agentConfig` request field sent to `/agent/*` control-plane
endpoints. Its unit tests validate the supported agent, tool, guardrail,
handoff, memory, termination, callback, planning, and framework-passthrough
shapes.

All keys are camelCase; `null`/`undefined` fields are omitted rather than
sent as `null`. Nested `agents`, `router`, `planner`, and `fallback` serialize
recursively via the same function. The published
[JSON Schema](agent-schema.json) rejects unknown root agent fields while
allowing intentionally open JSON payloads (tool `inputSchema`/`outputSchema`,
`metadata`, guardrail/termination/handoff objects, and per-toolType `config`).

## Framework-passthrough shapes

Two agent kinds bypass the general shape above and emit a minimal
passthrough payload instead, since their real work happens entirely inside a
local worker closure rather than being compiled by the server:

- **Skill agents** (`agent._framework === 'skill'`) emit `{ name, model,
  _framework: "skill", ...rawSkillConfig }` — the raw `SKILL.md`-derived
  config, spread onto the payload, so the server's skill normalizer can
  compile it. This can include fields outside the schema's declared property
  list; the schema's `additionalProperties: false` is a statement about the
  native-agent shape, not a promise that every skill payload validates
  against it.
- **Claude Agent SDK passthrough** (`agent.isClaudeCode`) emits `{ name,
  model, metadata: { _framework_passthrough: true }, tools: [{ name,
  toolType: "worker", description: "Claude Agent SDK passthrough worker" }]
  }` — every other option on the agent is consumed locally by the worker
  closure and never reaches the wire.

## Compatibility

The schema describes payloads emitted by the *current* serializer; it isn't
a promise that arbitrary server-side fields can be supplied by callers.
Extend the serializer, the schema, this reference, and `serializer.test.ts`
together when adding a new public agent field.

## Next steps

Read [agent definition fields](agent-definition.md) for the authoring-side
options this maps from, and [runtime](runtime.md) for how a compiled
`agentConfig` gets submitted and executed.
