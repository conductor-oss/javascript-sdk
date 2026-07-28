# JS SDK documentation

This is a minimal hub, not a full doc index — the JS SDK doesn't yet have the
core/operations guide split Java and Python have. See
[documentation-parity.md](documentation-parity.md) for exactly what exists
today vs. what's tracked as a gap.

## Agent layer

[docs/agents/README.md](agents/README.md) — `Agent`, `AgentRuntime`, tools,
guardrails, handoffs, memory, schedules, streaming, and HITL.

## Workers

[LEASE_EXTENSION.md](../LEASE_EXTENSION.md) — lease extension (heartbeat) for
long-running workers.

## Reference and parity

- [docs/api-reference/](api-reference/) — one reference page per client
  (`application-client.md`, `task-client.md`, `workflow-executor.md`, ...)
- [JS/Java/Python documentation parity](documentation-parity.md) — intentional
  JS-only pages and tracked structural gaps against Java/Python
