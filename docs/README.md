# JavaScript SDK documentation

Build durable workflow workers and Conductor agents with TypeScript or
JavaScript. These guides cover OSS and Orkes; pages call out capabilities that
require Orkes.

- **Package:** `@io-orkes/conductor-javascript`
- **Runtime:** Node.js >= 18 (CI covers 20, 22, 24)
- **Modules:** ESM and CommonJS — `import` and `require` both work

## Start here

| Goal | Guide | Expected result |
|---|---|---|
| Connect to a server | [Server setup](server-setup.md) and [connection/authentication](connection-authentication.md) | The SDK can reach an OSS or Orkes API endpoint. |
| Build a workflow and worker | [Core quickstart](core-quickstart.md) | The hello-world workflow prints its result. |
| Build a Conductor agent | [Agent quickstart](agents/README.md) | An LLM-backed agent completes through Conductor. |
| Find the right client method | [API map](api-map.md) | You know which of the 14 clients owns the call. |
| Run the repository examples | [Examples](examples.md) | A curated example runs end to end. |

## Core SDK

| Guide | Covers |
|---|---|
| [server-setup.md](server-setup.md) | Running a server locally, OSS vs Orkes, version support. |
| [connection-authentication.md](connection-authentication.md) | `createConductorClient`, env vars, key/secret auth, TLS, proxies. |
| [core-quickstart.md](core-quickstart.md) | First workflow, first worker, first execution. |
| [workflows.md](workflows.md) | Authoring workflows with the `ConductorWorkflow` DSL and task builders. |
| [workflow-lifecycle.md](workflow-lifecycle.md) | Register, start, pause, resume, terminate, retry, rerun. |
| [workers.md](workers.md) | The worker framework, `@worker`, `TaskHandler`, polling, lease extension. |
| [schedules-events.md](schedules-events.md) | Cron schedules and event handlers. |
| [schema-client.md](schema-client.md) | Schema registration and task-def schema enforcement. |
| [observability.md](observability.md) | Metrics, the Prometheus surface, logging. |
| [reliability.md](reliability.md) | Lease extension, retries, idempotency, failure semantics. |
| [deployment-scaling.md](deployment-scaling.md) | Worker sizing, concurrency, containerization. |
| [security.md](security.md) | Credential handling, secrets, least privilege. |
| [debugging.md](debugging.md) | Diagnosing stuck workflows, failed tasks, worker silence. |
| [workflow-testing.md](workflow-testing.md) | Unit and integration testing strategies. |
| [compatibility.md](compatibility.md) | Server version matrix, OSS vs Orkes feature gates. |
| [upgrading.md](upgrading.md) | Migrating across SDK major versions. |

## Conductor agents

Durable, LLM-backed agents. Start at [agents/README.md](agents/README.md).

| Area | Pages |
|---|---|
| Concepts | [agents](agents/concepts/agents.md), [tools](agents/concepts/tools.md), [multi-agent](agents/concepts/multi-agent.md), [guardrails](agents/concepts/guardrails.md), [termination](agents/concepts/termination.md), [callbacks](agents/concepts/callbacks.md), [streaming & HITL](agents/concepts/streaming-hitl.md), [structured output](agents/concepts/structured-output.md), [scheduling](agents/concepts/scheduling.md), [stateful](agents/concepts/stateful.md), [deploy · serve · run · plan](agents/concepts/deploy-serve-run.md) |
| Frameworks | [OpenAI](agents/frameworks/openai.md), [Google ADK](agents/frameworks/google-adk.md), [LangChain](agents/frameworks/langchain.md), [LangGraph](agents/frameworks/langgraph.md), [Vercel AI SDK](agents/frameworks/vercel-ai.md) |
| Reference | [API map](agents/reference/api.md), [AgentRuntime](agents/reference/runtime.md), [AgentClient](agents/reference/client.md), [agent definition](agents/reference/agent-definition.md), [configuration contract](agents/reference/agent-schema.md) |

## Meta

- [documentation-standard.md](documentation-standard.md) — how these pages are written.
- [documentation-parity.md](documentation-parity.md) — how this set maps to the Python and Java SDKs.
