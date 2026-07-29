# AgentClient — control plane

`AgentClient` is the interface for the `/agent/*` control-plane HTTP surface
(11 ops + `close()`); `OrkesAgentClient` is the Conductor/Orkes
implementation, which also carries the agent-level convenience methods below
(`run`, `start`, `deploy`, `schedule`) and the `workflows`/`schedules`
accessors. **Does not run local tool workers.** Every op rides the shared
`ConductorClient`'s authenticated call path — no bespoke auth/transport logic
lives behind this interface, so it never mints a token independently.

```ts
new OrkesAgentClient(configuration?: OrkesApiConfig | ConductorClient)
```

Obtain one via `runtime.client` (shares the runtime's client, and its single
token mint, across control- and worker-plane calls) or
`OrkesClients.getAgentClient()` (shares whatever `Client` the `OrkesClients`
instance was built with).

**Control-plane only:** `AgentClient.run`/`start` compile + start an agent
and poll, but do **not** register or poll local tool workers. Use it for
LLM-only agents, agents whose tools are remote (HTTP/MCP), or pre-deployed
workflows. For agents with local `tool()` functions, use `runtime.run()`
instead — see [deploy/serve/run/plan](../concepts/deploy-serve-run.md).

```ts
const client = runtime.client;   // or: orkesClients.getAgentClient()

// Compile + start + poll to result
const result = await client.run(agent, 'summarize this', { timeoutSeconds: 120 });

// Start and interact via a ClientHandle
const handle = await client.start(agent, 'do work');
const status = await handle.getStatus();
const final  = await handle.wait();       // deadline: timeoutSeconds + 30s, or 10 min default
await handle.approve();          // / reject(reason) / send(message) / respond(body)
await handle.stop();             // stop the execution

// Compile + register one or more agents (no execution)
const infos = await client.deploy(agentA, agentB);   // DeploymentInfo[]

// Deploy + reconcile cron schedules in one call
import { Schedule } from '@io-orkes/conductor-javascript/agents';
await client.schedule(agent, [new Schedule({ name: 'nightly', cron: '0 0 0 * * *' })]);
```

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
| `stream` | `(executionId, lastEventId?, signal?) => Promise<AgentStream>` | SSE stream for an execution, falling back to status polling automatically if the SSE connection can't be established — see [streaming](../concepts/streaming-hitl.md#sse-fallback). |
| `close` | `() => Promise<void>` | Release this client's open `AgentStream`s. |

### ClientHandle

Returned by `AgentClient.start`. `{ executionId, getStatus(), wait(pollIntervalMs?),
respond(output), approve(output?), reject(reason?), send(message), stop(),
stream() }`. `wait()` rejects once its deadline passes
(`timeoutSeconds`-derived, or 10 min default) with an `AgentAPIError` naming
the last known status.

`stop`, `signal`, and `respond` change a durable execution — authorize
callers before exposing them, and make externally triggered calls (e.g. an
approval webhook) idempotent, since a retried request should be safe to
replay.

## WorkflowClient — execution reads

`runtime.workflows` (also `runtime.client.workflows`) is a read-only
`WorkflowClient` over the underlying Conductor workflow API.

```ts
const wf = await runtime.workflows.getWorkflow(executionId);          // full execution (with tasks)
const status = await runtime.workflows.getStatus(executionId);        // 'RUNNING' | 'COMPLETED' | ...
const usage  = await runtime.workflows.extractTokenUsage(executionId);// aggregated across sub-workflows
// usage -> { promptTokens, completionTokens, totalTokens } | null
```

| Method | Signature | Notes |
|---|---|---|
| `getWorkflow` | `(executionId, includeTasks = true) => Promise<WorkflowExecution>` | Full execution (with tasks). |
| `getStatus` | `(executionId) => Promise<string>` | `'RUNNING'` / `'COMPLETED'` / ... or `''`. |
| `extractTokenUsage` | `(executionId) => Promise<WorkflowTokenUsage \| null>` | Aggregated across sub-workflows. |

`extractTokenUsage` walks the execution tree (recursing into `SUB_WORKFLOW`
tasks) and sums token usage — useful for multi-agent runs where tokens are
spread across sub-workflows. Note: `result.tokenUsage` is already populated
for you on a normal `run()`; this is for inspecting an execution by id after
the fact. `WorkflowTokenUsage` = `{ promptTokens, completionTokens,
totalTokens }`.

## Next steps

See [runtime](runtime.md) for the local-worker-owning `AgentRuntime`, and
[streaming and approval](../concepts/streaming-hitl.md) for the
human-in-the-loop control flow these endpoints back.
