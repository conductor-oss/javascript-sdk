# Breaking Changes

## Unreleased (Agentspan → Conductor rebrand)

### `AGENTSPAN_*` environment variables renamed to `CONDUCTOR_AGENT_*`

**Change:** every `AGENTSPAN_<NAME>` env var is now `CONDUCTOR_AGENT_<NAME>` —
`AGENTSPAN_SERVER_URL` → `CONDUCTOR_AGENT_SERVER_URL`, and likewise for
`AUTH_KEY`, `AUTH_SECRET`, `LLM_MODEL`, `LOG_LEVEL`, `CLI_PATH`,
`WORKER_POLL_INTERVAL`, `WORKER_THREADS`, `AUTO_START_WORKERS`,
`STREAMING_ENABLED`, and the three `LIVENESS_*` knobs.

**Why:** the agent layer was merged in from the Agentspan TS SDK, which has
since been rebranded to Conductor. This aligns the config surface with the
Python and Java SDKs.

**Impact:**

| Scenario | Before | After | Breaks? |
|----------|--------|-------|---------|
| `CONDUCTOR_AGENT_SERVER_URL` set | Ignored | Used | **No** |
| `AGENTSPAN_SERVER_URL` set | Used | Used, warns once per process | **No** |
| Both set | — | `CONDUCTOR_AGENT_*` wins | **No** |
| Custom `ConductorLogger` without `warn` | — | Deprecation goes to `info` | **No** |

**Migration:** rename the variables. The old names keep working as deprecated
fallbacks and will be removed in a future release; each one warns once per
process the first time it actually supplies a value. `AGENTSPAN_LOG_LEVEL`
falls back silently — warning there would mean logging through the logger whose
level is still being resolved.

The precedence chain (spec R3) is unchanged apart from the new tier:
`CONDUCTOR_*` env → explicit config → `CONDUCTOR_AGENT_*` env →
`AGENTSPAN_*` env (deprecated) → `http://localhost:8080`.

### `AgentspanError` renamed to `ConductorAgentError`

**Change:** the base class of the agent error hierarchy is now
`ConductorAgentError`. `AgentspanError` remains exported as a deprecated alias.
`AgentspanMetadata` (from `./agents/langchain` and `./agents/langgraph`) is
likewise aliased to `ConductorAgentMetadata`.

**Impact:**

| Scenario | Before | After | Breaks? |
|----------|--------|-------|---------|
| `import { AgentspanError }` | Works | Works, marked `@deprecated` | **No** |
| `catch (e) { e instanceof AgentspanError }` | Works | Works — alias is the same class object, not a subclass | **No** |
| `const e: AgentspanError` (type position) | Works | Works — value and type alias both exported | **No** |
| `err.name` on a base-class instance | `"AgentspanError"` | `"ConductorAgentError"` | **Yes** if asserted on |

**Migration:** switch to `ConductorAgentError`. The only observable change for
existing code is `error.name` on a base-class instance, which now reports the
canonical name — assertions on that string need updating.

### Names deliberately NOT renamed

Cross-SDK wire keys (`__agentspan_ctx__`, `_agentspan.llm`, …), orkes-conductor
server boot properties (`agentspan.embedded`), the external `agentspan` CLI and
its subcommands, external repos/npm scopes (`agentspan-ai/agentspan`,
`@agentspan-ai`), and version-qualified references to the upstream product
(`agentspan <= 0.4.2`) are unchanged. See the table in `AGENTS.md`.

## v3.x (Worker Architecture Parity Release)

### `TaskHandler.startWorkers()` is now `async`

**Change:** `startWorkers(): void` → `startWorkers(): Promise<void>`

**Why:** `startWorkers()` now registers task definitions (via `registerTaskDef: true`) before starting the polling loop. This requires async API calls to the Conductor server.

**Impact:**

| Scenario | Before | After | Breaks? |
|----------|--------|-------|---------|
| `handler.startWorkers()` (fire-and-forget) | Works | Works — promise created, workers start, task def registration runs in background | **No** |
| `await handler.startWorkers()` | TypeScript error (void not awaitable) | Works — waits for task def registration to complete before returning | **No** |
| `const r: void = handler.startWorkers()` | `r` is `void` | TypeScript error — `r` is `Promise<void>` | **Yes (type-level only)** |

**Migration:** Add `await` before `handler.startWorkers()` to get the full benefit of task definition registration. Without `await`, everything still works — workers start immediately, and task definition registration completes asynchronously in the background. The only scenario that breaks is explicit `void` type annotation on the return value.

```typescript
// Before (still works, no change needed)
handler.startWorkers();

// Recommended (ensures task defs are registered before polling)
await handler.startWorkers();
```

---

### `ConductorWorker.execute` return type widened

**Change:** `execute` return type expanded from `Promise<Omit<TaskResult, ...>>` to `Promise<Omit<TaskResult, ...> | TaskInProgressResult>`.

**Impact:** Existing workers returning `{ status: "COMPLETED", outputData: {...} }` continue to work unchanged. The new `TaskInProgressResult` type (`{ status: "IN_PROGRESS", callbackAfterSeconds: number }`) is an additive option for long-running tasks.

**Breaks?** No — union types are backward compatible. Existing code compiles and runs without changes.
