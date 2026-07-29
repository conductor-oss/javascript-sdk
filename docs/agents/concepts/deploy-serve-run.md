# Deploy · serve · run · plan

**Audience:** developers deciding how a Conductor agent reaches production.

## Prerequisites

An agent that runs locally. This page is about the split between *registering* a
definition and *executing* it — the distinction that decides your deployment
topology.

## The four verbs

| Method | What it does | Local workers? |
|---|---|---|
| `runtime.run(agent, prompt, opts?)` | Compile + start + stream + return an `AgentResult`. | Yes — registers and polls local `tool()` workers for the run. |
| `runtime.start(agent, prompt, opts?)` | Same as `run`, but returns an `AgentHandle` for async interaction. | Yes. |
| `runtime.stream(agent, prompt, opts?)` | `start` + return its `AgentStream`. | Yes. |
| `runtime.deploy(agent, { schedules? })` | Compile + register the workflow definition. No execution, no workers. Returns `DeploymentInfo`. | No. |
| `runtime.deploy(...agents)` | Variadic: register multiple agents, no schedule reconciliation. Returns `DeploymentInfo[]`. | No. |
| `runtime.serve(...agents, { blocking? })` | Deploy the agents, register their local tool workers, start polling. Blocks until SIGINT/SIGTERM by default. | Yes, and keeps them alive when blocking. |
| `runtime.plan(agent)` | Compile to a workflow definition and return it, without executing. | No. |
| `runtime.shutdown()` | Stop worker polling. | — |

**Expected result:** `deploy` returns a `DeploymentInfo` and the definition is
visible on the server with no execution started. `serve` blocks with workers
polling.

## Choosing a topology

`serve()` already deploys, so a standalone `deploy()` beforehand is optional —
worth it only when you want registration decoupled from worker startup, such as a
dedicated CI/CD step.

The typical production split is a long-lived `serve` process for the tool workers,
with executions triggered through the control plane or on a schedule:

```ts
// Long-lived worker process — deploys, registers workers, starts polling
await runtime.serve(myAgent);   // blocks

// Trigger from elsewhere (no local workers needed for LLM-only or remote-tool agents)
const result = await runtime.client.run(myAgent, 'do the thing');
```

**Common failure mode — the one that bites hardest:** triggering an agent with
local `tool()` functions via `runtime.client.run()` when no `serve` process is
running. The execution starts, reaches the tool call, and waits forever, because
the control plane does not poll workers. Either use `runtime.run()` (which polls
for the duration of the call) or keep a `serve` process alive.

Pass `{ blocking: false }` to `serve()` to return once deploy, registration, and
polling have started — useful inside a larger process that has its own lifecycle.
With no agents, `serve()` just restarts polling for already-registered workers.

## Inspecting the compiled definition

`runtime.plan(agent)` returns the workflow definition without executing it —
useful in tests and for diffing what a change to an agent actually alters on the
server.

## Cleanup

A `serve()` process exits on SIGINT/SIGTERM. In non-blocking mode, call
`runtime.shutdown()` yourself. Deployed definitions and schedules persist on the
server until removed — see [scheduling.md](scheduling.md#cleanup).

## Next steps

[../reference/runtime.md](../reference/runtime.md) ·
[../reference/client.md](../reference/client.md) ·
[../../deployment-scaling.md](../../deployment-scaling.md)
