# API map

**Audience:** developers looking for which client owns a given operation.

## Prerequisites

A client ([connection-authentication.md](connection-authentication.md)).
`OrkesClients` is the factory — build it once and take the domain clients you
need, so they share one underlying client and one token mint.

```ts
const clients = await OrkesClients.from();
```

## Clients

| Getter | Client | Owns |
|---|---|---|
| `getWorkflowClient()` | Workflow | Start, execute, pause, resume, terminate, retry, restart, search, signal. |
| `getTaskClient()` | Task | Poll, update, task logs, queue sizes. |
| `getMetadataClient()` | Metadata | Register and read workflow and task definitions. |
| `getSchedulerClient()` | Scheduler | Cron schedule lifecycle. |
| `getEventClient()` | Event | Event handlers. |
| `getHumanClient()` | Human task | Human task claim, complete, search. |
| `getSchemaClient()` | Schema | Schema registration and lookup. |
| `getSecretClient()` | Secret | Secret store CRUD. |
| `getApplicationClient()` | Application | Applications, access keys, roles. |
| `getAuthorizationClient()` | Authorization | Grants and permissions. |
| `getIntegrationClient()` | Integration | LLM and vector-DB integrations. |
| `getPromptClient()` | Prompt | Server-managed prompt templates. |
| `getTemplateClient()` | Template | Workflow templates. |
| `getServiceRegistryClient()` | Service registry | Registered services. |
| `getAgentClient()` | Agent | The `/agent/*` control plane. See [agents/reference/client.md](agents/reference/client.md). |
| `getAgentWorkflowClient()` | Agent workflow | Read-only agent execution reads. |

`getClient()` returns the underlying `ConductorClient` — pass it to
`new TaskHandler({ client })` or `new AgentRuntime(client)`.

## By goal

| I want to… | Use |
|---|---|
| Register a workflow definition | `ConductorWorkflow.register()` or `getMetadataClient()` |
| Register a task definition | `getMetadataClient().registerTask()` |
| Start a workflow and not wait | `getWorkflowClient().startWorkflow()` |
| Start a workflow and wait | `workflow.execute()` |
| Control a running execution | `getWorkflowClient()` — pause / resume / terminate / retry |
| Read an execution with tasks | `getWorkflowClient().getExecution()` |
| Search executions | `getWorkflowClient().search()` |
| Run workers | `TaskHandler` + `@worker` — see [workers.md](workers.md) |
| Complete a WAIT task | `getWorkflowClient().signal()` |
| Manage a cron schedule | `getSchedulerClient()` |
| Store a secret | `getSecretClient()` |
| Enforce a task input schema | `getSchemaClient()` — see [schema-client.md](schema-client.md) |
| Run a Conductor agent | `AgentRuntime` — see [agents/README.md](agents/README.md) |

## Per-client reference

Detailed per-client method documentation lives under `docs/api-reference/`, which
now forwards here. The generated TypeDoc surface is the authoritative signature
reference:

```shell
npm run generate-docs
```

## Two pairs worth not confusing

- **`getWorkflow()` vs `getExecution()`** on the workflow client hit different
  endpoints and return different shapes. Use `getExecution()` when you need
  task-level detail.
- **`getAgentClient()` vs `AgentRuntime`** — the client is control plane only and
  does not poll local tool workers. See
  [agents/reference/api.md](agents/reference/api.md#runtime-vs-client).

## Next steps

[workflows.md](workflows.md) · [workers.md](workers.md) ·
[agents/reference/api.md](agents/reference/api.md)
