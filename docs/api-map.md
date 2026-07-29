# Core API map

| Need | JS/TS type | Reference |
|---|---|---|
| Configure transport and auth | `OrkesClients` / `createConductorClient` | [connection/authentication](connection-authentication.md) |
| Run workflow executions | `WorkflowExecutor` | [workflow-executor.md](api-reference/workflow-executor.md) |
| Poll and update tasks | `TaskHandler` / `TaskClient` / `TaskManager` | [task-client.md](api-reference/task-client.md), [task-manager.md](api-reference/task-manager.md) |
| Manage definitions | `MetadataClient` | [metadata-client.md](api-reference/metadata-client.md) |
| Schedule workflows | `SchedulerClient` | [scheduler-client.md](api-reference/scheduler-client.md) |
| Manage schemas | `SchemaClient` | [schema client](schema-client.md) (no dedicated reference page yet) |
| Manage secrets, auth, integrations | `SecretClient` / `AuthorizationClient` / `IntegrationClient` | [security](security.md) (no dedicated reference pages yet) |
| Human-in-the-loop tasks | `HumanExecutor` / `TemplateClient` | [human-executor.md](api-reference/human-executor.md), [template-client.md](api-reference/template-client.md) |
| Events | `EventClient` | [event-client.md](api-reference/event-client.md) |
| Service discovery | `ServiceRegistryClient` | [service-registry-client.md](api-reference/service-registry-client.md) |
| Applications/access keys | `ApplicationClient` | [application-client.md](api-reference/application-client.md) |
| Compile, deploy, run, signal agents | `AgentClient` / `AgentRuntime` | [agent control plane](agents/reference/client.md) |
| Consume the workflow message queue (WMQ) | `pullWorkflowMessages` / `waitForMessageTool` | [workflow-message-queue.md](workflow-message-queue.md) |

JS does not currently expose a public workflow-scoped `FileClient`; use the
server and task capabilities appropriate to your deployment instead — see
[compatibility](compatibility.md).
