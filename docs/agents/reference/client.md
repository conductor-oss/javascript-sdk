# AgentClient reference

**Audience:** applications triggering and inspecting Conductor-agent executions
without owning local tool workers.

## Prerequisites

A configured connection. `AgentClient` is the interface for the `/agent/*`
control-plane HTTP surface; `OrkesAgentClient` is the Conductor/Orkes
implementation.

```ts
new OrkesAgentClient(configuration?: OrkesApiConfig | ConductorClient)
```

Obtain one via `runtime.client` (shares the runtime's client and token mint) or
`OrkesClients.getAgentClient()`. Every operation rides the shared
`ConductorClient`'s authenticated call path — no bespoke auth or transport lives
behind this interface, and it never mints a token independently.

## Control plane only

`AgentClient.run` and `start` compile, start, and poll an agent, but do **not**
register or poll local tool workers.

Use it for LLM-only agents, agents whose tools are all server-side (HTTP, MCP,
API, RAG), or pre-deployed workflows. For agents with local `tool()` functions,
use `runtime.run()` or keep a `serve()` process alive — otherwise the execution
reaches the tool call and waits indefinitely. This is the single most common
misconfiguration; see
[../concepts/deploy-serve-run.md](../concepts/deploy-serve-run.md).

## Usage

```ts
const client = runtime.client;   // or: orkesClients.getAgentClient()

// Compile + start + poll to result
const result = await client.run(agent, 'summarize this', { timeoutSeconds: 120 });

// Start and interact via a ClientHandle
const handle = await client.start(agent, 'do work');
const status = await handle.getStatus();
const final  = await handle.wait();
await handle.approve();          // or reject(reason) / send(message) / respond(body)
await handle.stop();

// Compile + register one or more agents (no execution)
const infos = await client.deploy(agentA, agentB);   // DeploymentInfo[]

// Deploy + reconcile cron schedules in one call
import { Schedule } from '@io-orkes/conductor-javascript/agents';
await client.schedule(agent, [new Schedule({ name: 'nightly', cron: '0 0 0 * * *' })]);
```

## Members

| Member | Signature | Notes |
|---|---|---|
| `workflows` | `WorkflowClient` | Read-only workflow client. |
| `schedules` | `SchedulerClient` | Cron lifecycle over the shared Conductor client. |
| `run` | `(agent, prompt, opts?) => Promise<AgentResult>` | Compile, start, poll to result. |
| `start` | `(agent, prompt, opts?) => Promise<ClientHandle>` | Compile, start, return a handle. |
| `deploy` | `(agent, { schedules? }?) => Promise<DeploymentInfo>` or `(...agents) => Promise<DeploymentInfo[]>` | Register agent(s). |
| `schedule` | `(agent, schedules) => Promise<DeploymentInfo>` | Deploy and reconcile schedules. |
| `startAgent` / `deployAgent` / `compile` | `(payload, signal?) => Promise<Record>` | Low-level POST endpoints. |
| `status` | `(executionId, signal?) => Promise<AgentStatus>` | GET status. |
| `getExecution` | `(executionId, signal?) => Promise<Record \| null>` | Full execution data. |
| `listExecutions` | `(params?, signal?) => Promise<Record>` | List, optionally filtered. |
| `respond` | `(executionId, body, signal?) => Promise<void>` | Complete a pending human task. |
| `stop` | `(executionId, signal?) => Promise<void>` | Stop a running execution. |
| `signal` | `(executionId, message, signal?) => Promise<void>` | Inject persistent context into a running execution. |
| `stream` | `(executionId, lastEventId?, signal?) => Promise<AgentStream>` | SSE stream. |
| `close` | `() => Promise<void>` | Release this client's open streams. |

## ClientHandle

Returned by `AgentClient.start`:

```ts
{ executionId, getStatus(), wait(pollIntervalMs?), respond(output),
  approve(output?), reject(reason?), send(message), stop(), stream() }
```

`wait()` rejects once its deadline passes — derived from `timeoutSeconds`, or 10
minutes by default — with an `AgentAPIError` naming the last known status. A
rejection from `wait()` does **not** stop the execution; call `stop()` if that's
what you want.

## WorkflowClient

Read-only client for Conductor workflow executions. Available as
`runtime.workflows` or `client.workflows`.

| Method | Signature | Notes |
|---|---|---|
| `getWorkflow` | `(executionId, includeTasks = true) => Promise<WorkflowExecution>` | Full execution. |
| `getStatus` | `(executionId) => Promise<string>` | `'RUNNING'`, `'COMPLETED'`, … or `''`. |
| `extractTokenUsage` | `(executionId) => Promise<WorkflowTokenUsage \| null>` | Aggregated across sub-workflows. |

```ts
const wf     = await runtime.workflows.getWorkflow(executionId);
const status = await runtime.workflows.getStatus(executionId);
const usage  = await runtime.workflows.extractTokenUsage(executionId);
```

`extractTokenUsage` walks the execution tree, recursing into `SUB_WORKFLOW` tasks,
and sums usage — the reason it exists is that multi-agent runs spread tokens across
sub-workflows, so reading the parent alone undercounts.

`result.tokenUsage` is already populated on a normal `run()`; use this to inspect
an execution by id after the fact.

## Cleanup

`client.close()` releases open `AgentStream`s. A client obtained from
`runtime.client` is closed by `runtime.shutdown()`.

## Next steps

[runtime.md](runtime.md) · [api.md](api.md) ·
[../concepts/streaming-hitl.md](../concepts/streaming-hitl.md)
