# Examples

**Audience:** developers looking for a runnable starting point.

## Prerequisites

A running server ([server-setup.md](server-setup.md)) and credentials in the
environment or a `.env` file:

```shell
export CONDUCTOR_SERVER_URL=http://localhost:8080
```

Core examples run straight from the repository:

```shell
npx tsx examples/quickstart.ts
```

Agent examples resolve the package name to `src/agents` sources via
`examples/agents/tsconfig.json`:

```shell
npx tsx examples/agents/01-basic-agent.ts
```

Framework subdirectories install their own dependencies:

```shell
./scripts/install-example-deps.sh
```

## Core

| Example | Covers |
|---|---|
| [quickstart.ts](../examples/quickstart.ts) | `@worker` + workflow + `execute`. The 60-second intro. |
| [helloworld.ts](../examples/helloworld.ts) | Smallest possible workflow. |
| [workers-e2e.ts](../examples/workers-e2e.ts) | Three chained workers with verification. |
| [kitchensink.ts](../examples/kitchensink.ts) | HTTP tasks, waits, switch branching. |
| [dynamic-workflow.ts](../examples/dynamic-workflow.ts) | Building a workflow at runtime. |
| [workflow-ops.ts](../examples/workflow-ops.ts) | Full lifecycle: pause, resume, terminate, retry, restart. |
| [worker-configuration.ts](../examples/worker-configuration.ts) | Concurrency, poll interval, domains. |
| [task-configure.ts](../examples/task-configure.ts) | Task definition fields. |
| [task-context.ts](../examples/task-context.ts) | `IN_PROGRESS`, callbacks, task logs. |
| [metrics.ts](../examples/metrics.ts) | Prometheus collector and scrape server. |
| [event-listeners.ts](../examples/event-listeners.ts) | `TaskHandler` event listeners. |
| [express-worker-service.ts](../examples/express-worker-service.ts) | Workers inside an HTTP service. |
| [perf-test.ts](../examples/perf-test.ts) | Throughput harness. |
| [test-workflows.ts](../examples/test-workflows.ts) | Testing patterns. |

`examples/advanced/` covers fork/join and human tasks; `examples/api-journeys/`
walks the application, authorization, and event-handler APIs.

## Agents

`examples/agents/` holds 113 numbered examples, roughly in increasing complexity —
basic agents, tools, multi-agent strategies, guardrails, streaming, HITL, memory,
credentials, code execution, plans, and schedules.

| Start with | Covers |
|---|---|
| [01-basic-agent.ts](../examples/agents/01-basic-agent.ts) | Smallest agent. |
| [02a-simple-tools.ts](../examples/agents/02a-simple-tools.ts) | One local tool. |
| [03-multi-agent.ts](../examples/agents/03-multi-agent.ts) | Multi-agent orchestration. |
| [04-guardrails.ts](../examples/agents/04-guardrails.ts) | Input and output validation. |
| [05-streaming.ts](../examples/agents/05-streaming.ts) | Event streaming. |
| [06-hitl.ts](../examples/agents/06-hitl.ts) | Approval gates. |

Framework subdirectories — `adk/`, `langgraph/`, `openai/`, `vercel-ai/`, and
`quickstart/` — each carry their own `package.json` and README. See
[agents/frameworks/openai.md](agents/frameworks/openai.md) and its siblings.

## Common failure modes

- **Connection refused.** `CONDUCTOR_SERVER_URL` unset or pointing at the UI port.
- **An agent example completing with an error in the output.** The model isn't
  configured on the server. Provider keys belong to the **server** process.
- **A framework example failing to import.** Run
  `./scripts/install-example-deps.sh`; framework peer dependencies are optional and
  not installed by default.
- **An example hanging.** A local tool with nothing polling it, or a missing
  `shutdown()`.

## Next steps

[core-quickstart.md](core-quickstart.md) · [agents/README.md](agents/README.md) ·
[../examples/README.md](../examples/README.md) — the full catalog
