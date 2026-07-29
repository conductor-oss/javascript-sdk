# Upgrading

**Audience:** developers moving an existing project to a newer SDK version.

## Prerequisites

None. `../BREAKING_CHANGES.md` carries the per-change impact tables; this page is
the migration narrative.

## Agentspan → Conductor

The agent layer was merged in from the Agentspan TypeScript SDK, which has since
been rebranded to Conductor. Names changed to match; the old ones still work.

### Environment variables

Every `AGENTSPAN_<NAME>` is now `CONDUCTOR_AGENT_<NAME>`:

```shell
# Before
export AGENTSPAN_SERVER_URL=http://localhost:8080/api
export AGENTSPAN_LLM_MODEL=openai/gpt-4o-mini

# After
export CONDUCTOR_AGENT_SERVER_URL=http://localhost:8080/api
export CONDUCTOR_AGENT_LLM_MODEL=openai/gpt-4o-mini
```

Affected: `SERVER_URL`, `AUTH_KEY`, `AUTH_SECRET`, `LLM_MODEL`, `LOG_LEVEL`,
`CLI_PATH`, `WORKER_POLL_INTERVAL`, `WORKER_THREADS`, `AUTO_START_WORKERS`,
`STREAMING_ENABLED`, and the three `LIVENESS_*` knobs.

**The old names still resolve** as deprecated fallbacks, warning once per name per
process the first time each supplies a value. Setting both is safe —
`CONDUCTOR_AGENT_*` wins. `AGENTSPAN_LOG_LEVEL` falls back silently, because warning
there would mean logging through the logger whose level is still being resolved.

Precedence (spec R3), unchanged except for the new tier:

```
CONDUCTOR_* env → explicit config → CONDUCTOR_AGENT_* env
  → AGENTSPAN_* env (deprecated) → http://localhost:8080
```

### Error class

`AgentspanError` is now `ConductorAgentError`.

```ts
// Both work; prefer the first
import { ConductorAgentError } from "@io-orkes/conductor-javascript/agents";
import { AgentspanError } from "@io-orkes/conductor-javascript/agents"; // @deprecated
```

The alias is the **same class object**, not a subclass, so `instanceof` works in
both directions and existing `catch` blocks keep working. Both the value and the
type are exported, so `const e: AgentspanError` still compiles.

**One behavior change:** `error.name` on a base-class instance now reports
`"ConductorAgentError"`. If you assert on that string, update the assertion.

`AgentspanMetadata` (from `/agents/langchain` and `/agents/langgraph`) is likewise
aliased to `ConductorAgentMetadata`.

### What did not change

Names owned by something other than this SDK were deliberately left alone.
Renaming them would point at flags that don't exist or break interop:

| Name | Owner |
|---|---|
| `__agentspan_ctx__`, `__agentspan_sdk__.cjs`, `_agentspan.llm`/`.model`/`.framework`/`.tools`, `_agentspan_human_task`, `_agentspan_human_prompt` | Cross-SDK wire keys, shared with the Python SDK and compiled by the same server path. |
| `agentspan.embedded`, `agentspan.default-context-window` | orkes-conductor server boot properties. |
| `agentspan-ai/agentspan`, `agentspan-ai/codingexamples`, `@agentspan-ai`, `agentspan-server` | External repos, npm scope, container image. |
| The `agentspan` CLI binary, `~/.agentspan/config.json`, `agentspan_linux_amd64`, `agentspan deploy`/`credentials`/`login`/`import` | The external CLI's release asset and command surface. |
| `agentspan <= 0.4.2`, `agentspan server > 0.4.2` | Version-qualified references to the upstream product — renaming makes them false. |

Every cross-SDK wire key is underscore-prefixed. That invariant is the quickest way
to tell a wire contract from prose.

If you set `_agentspan` metadata by hand on a LangGraph graph, keep the key as-is.
Prefer the SDK's `createReactAgent` wrapper, which sets it for you — see
[agents/frameworks/langgraph.md](agents/frameworks/langgraph.md).

### E2E bundle consumers

The released e2e bundle documents `CONDUCTOR_AGENT_*` as its interface. The
`AGENTSPAN_*` spelling still resolves inside the harness, so existing downstream
runs keep working while you migrate.

## v3.x — worker architecture

`TaskHandler.startWorkers()` became `async`, because it now registers task
definitions before polling starts.

```ts
await handler.startWorkers();
```

Fire-and-forget still works; the only hard break is an explicit
`const r: void = handler.startWorkers()` annotation. Awaiting it means task-def
registration completes before your first execution rather than racing it.

## Documentation layout

Documentation moved to the canonical structure shared with the Java and Python SDKs:
`docs/*.md` plus `docs/agents/{concepts,frameworks,reference}/`. The previous
`docs/agents/*.md` pages and `docs/api-reference/*.md` remain as redirect stubs, so
existing links keep resolving. Start at [README.md](README.md).

## Next steps

[../BREAKING_CHANGES.md](../BREAKING_CHANGES.md) ·
[compatibility.md](compatibility.md) · [README.md](README.md)
