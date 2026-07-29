# AgentRuntime reference

**Audience:** applications owning local tool workers and Conductor-agent
lifecycle.

## Prerequisites

Create one runtime per application lifetime with a configured server connection,
and shut it down on exit. A runtime owns connection-facing clients, local tool
workers, and execution lifecycle.

```ts
new AgentRuntime(configuration?: OrkesApiConfig | ConductorClient, settings?: AgentConfigOptions)
```

Both arguments are optional and independent:

- **`configuration`** — connection and auth, the same shape every other Conductor
  client takes. Pass a pre-built `ConductorClient` (from `createConductorClient()`
  or `OrkesClients`) to share one client, and one token mint, across control-plane
  and worker-plane calls.
- **`settings`** — `AgentConfigOptions`, purely behavioral. No connection fields.

```ts
import { AgentRuntime } from '@io-orkes/conductor-javascript/agents';

const runtime = new AgentRuntime(
  { serverUrl: 'http://localhost:8080/api', keyId: '…', keySecret: '…' },
  {
    workerPollIntervalMs: 100,
    workerThreadCount: 1,
    streamingEnabled: true,
    livenessEnabled: true,
    livenessStallSeconds: 30,
    livenessCheckIntervalSeconds: 10,
  },
);

// Both optional — reads connection and behavior entirely from env:
const defaultRuntime = new AgentRuntime();
```

## Members

| Member | Signature | Notes |
|---|---|---|
| `config` | `AgentConfig` | Resolved behavior config (readonly). |
| `client` | `AgentClient` | Control plane (`/agent/*`), sharing the runtime's Conductor client. |
| `workflows` | `WorkflowClient` | Read-only execution reads. |
| `run` | `(agent, prompt, options?) => Promise<AgentResult>` | Compile, start, stream, return. Registers local workers. |
| `start` | `(agent, prompt, options?) => Promise<AgentHandle>` | Async interaction handle. |
| `stream` | `(agent, prompt, options?) => Promise<AgentStream>` | Event stream. |
| `deploy` | `(agent, { schedules? }?) => Promise<DeploymentInfo>` or `(...agents) => Promise<DeploymentInfo[]>` | Register definitions. No execution, no workers. |
| `plan` | `(agent) => Promise<object>` | Compile to a workflow definition without executing. |
| `serve` | `(...agents, options?: ServeOptions) => Promise<void>` | Deploy, register workers, poll. Blocks until SIGINT/SIGTERM unless `{ blocking: false }`. |
| `getStatus` | `(executionId, signal?) => Promise<AgentStatus>` | Current status. |
| `schedulesClient` | `() => SchedulerClient` | Schedule lifecycle. |
| `shutdown` | `() => Promise<void>` | Stop worker polling. |

`agent` is an `Agent` or a detected framework object. See
[../concepts/deploy-serve-run.md](../concepts/deploy-serve-run.md) for which verb to
use.

## Connection resolution

Precedence (spec R3):

1. `CONDUCTOR_SERVER_URL` / `CONDUCTOR_AUTH_KEY` / `CONDUCTOR_AUTH_SECRET`
2. explicit `configuration` values
3. `CONDUCTOR_AGENT_SERVER_URL` / `CONDUCTOR_AGENT_AUTH_KEY` / `CONDUCTOR_AGENT_AUTH_SECRET`
4. the deprecated `AGENTSPAN_*` spelling of (3), which warns once per name
5. `http://localhost:8080`

Note that the core `CONDUCTOR_*` env vars outrank an explicit `configuration` —
that is deliberate, so an operator can redirect a deployed application without a
code change.

## AgentConfigOptions

Behavior only. Every field falls back to an env var, then a default; explicit
values win.

```ts
interface AgentConfigOptions {
  workerPollIntervalMs?: number;         // CONDUCTOR_AGENT_WORKER_POLL_INTERVAL (100)
  workerThreadCount?: number;            // CONDUCTOR_AGENT_WORKER_THREADS (1)
  autoStartWorkers?: boolean;            // CONDUCTOR_AGENT_AUTO_START_WORKERS (true)
  streamingEnabled?: boolean;            // CONDUCTOR_AGENT_STREAMING_ENABLED (true)
  livenessEnabled?: boolean;             // CONDUCTOR_AGENT_LIVENESS_ENABLED (true)
  livenessStallSeconds?: number;         // CONDUCTOR_AGENT_LIVENESS_STALL_SECONDS (30)
  livenessCheckIntervalSeconds?: number; // CONDUCTOR_AGENT_LIVENESS_CHECK_INTERVAL_SECONDS (10)
}
```

`AgentConfig.fromEnv()` is equivalent to `new AgentConfig()`. The `AGENTSPAN_*`
spelling of each var still resolves as a deprecated fallback — see
[../../upgrading.md](../../upgrading.md).

## Module-level singleton

For scripts, a shared runtime is exposed as module functions: `configure`, `run`,
`start`, `stream`, `deploy`, `plan`, `serve`, `shutdown`.

```ts
import { configure, run, shutdown } from '@io-orkes/conductor-javascript/agents';

configure({ serverUrl: 'http://localhost:8080/api' });
const result = await run(agent, 'hi');
await shutdown();
```

Convenient for one-file scripts. Prefer an explicit `AgentRuntime` in a service,
where two components sharing hidden global state is a liability.

## RunOptions

Passed to `run` / `start` / `stream`:

| Field | Notes |
|---|---|
| `runSettings` | Per-run LLM overrides — see below. |
| `model` | Sugar for `runSettings.model`. An explicit `runSettings.model` wins. |
| `plan` | A deterministic static `Plan`, which overrides the planner's output. |
| `credentials` | Extra secret names for this run. |
| `timeoutSeconds` | Execution deadline. |

`RunSettings` overrides the LLM call for a single run without touching the agent's
config. Only set fields override, and the override does **not** cascade to
sub-agents — each keeps its own settings.

```ts
const result = await runtime.run(agent, prompt, {
  runSettings: {
    model: 'anthropic/claude-sonnet-4-6',
    temperature: 0.2,
    maxTokens: 4096,
    reasoningEffort: 'high',
    thinkingBudgetTokens: 8000,   // maps to the wire thinkingConfig shape
  },
});
```

## Cleanup

`await runtime.shutdown()` in a `finally`. It stops worker polling; a process with
registered tools will not exit without it. Stateful runs create domain-scoped
workers, so leaking runtimes leaks workers.

## Next steps

[client.md](client.md) — the control plane ·
[agent-definition.md](agent-definition.md) ·
[../concepts/deploy-serve-run.md](../concepts/deploy-serve-run.md)
