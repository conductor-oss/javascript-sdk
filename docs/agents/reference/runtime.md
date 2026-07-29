# AgentRuntime reference

```ts
new AgentRuntime(configuration?: OrkesApiConfig | ConductorClient, settings?: AgentConfigOptions)
```

`configuration` is connection/auth — the same shape every other Conductor
client takes (`OrkesApiConfig`, or a pre-built `ConductorClient` from
`createConductorClient()`/`OrkesClients` to share one client — and one token
mint — across control-plane and worker-plane calls). Falls back to
`CONDUCTOR_SERVER_URL`/`CONDUCTOR_AUTH_KEY`/`CONDUCTOR_AUTH_SECRET`, then
`http://localhost:8080`. `settings` is `AgentConfigOptions` — purely
behavioral (no connection fields); every field falls back to an env var,
then a default; explicit values take precedence. Both arguments are
optional.

```ts
import { AgentRuntime } from '@io-orkes/conductor-javascript/agents';

const runtime = new AgentRuntime(
  { serverUrl: 'http://localhost:8080/api', keyId: '…', keySecret: '…' }, // connection (OrkesApiConfig)
  {
    workerPollIntervalMs: 100,              // CONDUCTOR_AGENT_WORKER_POLL_INTERVAL
    workerThreadCount: 1,                   // CONDUCTOR_AGENT_WORKER_THREADS
    streamingEnabled: true,                 // CONDUCTOR_AGENT_STREAMING_ENABLED
    livenessEnabled: true,                  // CONDUCTOR_AGENT_LIVENESS_ENABLED
    livenessStallSeconds: 30,               // CONDUCTOR_AGENT_LIVENESS_STALL_SECONDS
    livenessCheckIntervalSeconds: 10,       // CONDUCTOR_AGENT_LIVENESS_CHECK_INTERVAL_SECONDS
  },
);

// Both args are optional -- this reads connection + behavior entirely from env:
const defaultRuntime = new AgentRuntime();
```

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
| `serve` | `(...agents, options?: ServeOptions) => Promise<void>` | Deploys the given agents, registers workers, starts polling. Blocks until SIGINT/SIGTERM by default; `{ blocking: false }` returns once deploy + registration + polling have started. With no agents, resumes polling for whatever workers are already registered — the crash-recovery pattern (see below). |
| `getStatus` | `(executionId, signal?) => Promise<AgentStatus>` | Current execution status. |
| `schedulesClient` | `() => SchedulerClient` | Schedule lifecycle client (the SDK scheduler client). |
| `shutdown` | `() => Promise<void>` | Stop worker polling. |

`agent` is an `Agent` or a detected framework object.  `options?: RunOptions`
on `run`/`start`/`stream` includes `runSettings` (see
[RunSettings](api.md#runsettings)). Module-level helpers
`configure(configuration?, settings?)`, `run`, `start`, `stream`, `deploy`,
`plan`, `serve`, `shutdown` operate on a shared singleton runtime.

```ts
import { configure, run, shutdown } from '@io-orkes/conductor-javascript/agents';
configure({ serverUrl: 'http://localhost:8080/api' });
const result = await run(agent, 'hi');
await shutdown();
```

Share one runtime for an application's lifetime rather than constructing one
per request — each runtime owns its own worker-polling loop and token mint.

## AgentConfig / AgentConfigOptions

Behavior-only — no connection/auth fields (those live on `OrkesApiConfig`,
the `AgentRuntime`/`OrkesAgentClient` constructors' first argument).

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

Each falls back to its `CONDUCTOR_AGENT_*` env var, then the default above.
`AgentConfig.fromEnv()` is an exported helper (equivalent to `new
AgentConfig()`). See [liveness monitoring](../concepts/stateful.md#liveness-monitoring)
for the liveness fields.

## Reattaching after a process restart

There's no `resume(executionId, agent)` method on `AgentRuntime` — recovery
after a worker process crash is process-level, not execution-level: call
`serve()` with no agents in the replacement process, which resumes polling
for whatever tool workers are already registered on the server. See
[stateful agents](../concepts/stateful.md#recovering-after-a-worker-process-restart)
for how a stalled execution surfaces (`WorkerStallError`) in the first place.

## Cleanup and next steps

Call `shutdown()` to stop local worker polling. Continue with
[deploy/serve/run/plan](../concepts/deploy-serve-run.md) and
[control plane](client.md).
