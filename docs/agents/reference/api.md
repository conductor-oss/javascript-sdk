# Conductor-agent API map

**Audience:** developers looking for which type owns a given operation.

## Prerequisites

None. Everything here is exported from
`@io-orkes/conductor-javascript/agents` unless a subpath is noted.

Import agent symbols from the `/agents` subpath, never the package root — the root
re-exports the generated OpenAPI surface, which contains a colliding `Action`
type.

## By goal

| I want to… | Use | Reference |
|---|---|---|
| Define an agent | `Agent`, `agent()` | [agent-definition.md](agent-definition.md#agent) |
| Run one and wait | `runtime.run()` | [runtime.md](runtime.md) |
| Run one and interact | `runtime.start()` → `AgentHandle` | [agent-definition.md](agent-definition.md#agenthandle) |
| Stream events | `runtime.stream()` → `AgentStream` | [../concepts/streaming-hitl.md](../concepts/streaming-hitl.md) |
| Register without running | `runtime.deploy()` | [../concepts/deploy-serve-run.md](../concepts/deploy-serve-run.md) |
| Run a long-lived worker process | `runtime.serve()` | [../concepts/deploy-serve-run.md](../concepts/deploy-serve-run.md) |
| Inspect the compiled definition | `runtime.plan()` | [agent-schema.md](agent-schema.md) |
| Trigger from another process | `runtime.client.run()` | [client.md](client.md) |
| Read an execution after the fact | `runtime.workflows` | [client.md](client.md#workflowclient) |
| Sum tokens across sub-workflows | `workflows.extractTokenUsage()` | [client.md](client.md#workflowclient) |
| Give the agent a local function | `tool()` | [../concepts/tools.md](../concepts/tools.md) |
| Call an HTTP endpoint / MCP server | `httpTool`, `mcpTool`, `apiTool` | [../concepts/tools.md](../concepts/tools.md#built-in-tools) |
| Use another agent as a tool | `agentTool()` | [../concepts/tools.md](../concepts/tools.md#agenttool--agent-as-a-tool) |
| Require human approval | `approvalRequired`, `humanTool` | [../concepts/streaming-hitl.md](../concepts/streaming-hitl.md) |
| Validate input or output | `guardrail`, `RegexGuardrail`, `LLMGuardrail` | [../concepts/guardrails.md](../concepts/guardrails.md) |
| Get typed output | `outputType` | [../concepts/structured-output.md](../concepts/structured-output.md) |
| Coordinate several agents | `agents` + `strategy` | [../concepts/multi-agent.md](../concepts/multi-agent.md) |
| Stop a loop | `termination` | [../concepts/termination.md](../concepts/termination.md) |
| Observe the lifecycle | `CallbackHandler` | [../concepts/callbacks.md](../concepts/callbacks.md) |
| Run on a cron | `Schedule`, `schedules` | [../concepts/scheduling.md](../concepts/scheduling.md) |
| Share state across tool calls | `stateful: true`, `ToolContext.state` | [../concepts/stateful.md](../concepts/stateful.md) |
| Run a plan deterministically | `strategy: 'plan_execute'`, `Plan` | [../concepts/multi-agent.md](../concepts/multi-agent.md#plan-execute) |
| Load a `SKILL.md` directory | `skill()`, `loadSkills()` | [../concepts/multi-agent.md](../concepts/multi-agent.md#skills) |
| Run a framework agent | same `runtime.run()` | [../frameworks/openai.md](../frameworks/openai.md) |

## By type

| Type | Role | Reference |
|---|---|---|
| `Agent` | The unit of authoring. | [agent-definition.md](agent-definition.md) |
| `AgentRuntime` | Execution + local tool workers. | [runtime.md](runtime.md) |
| `AgentConfig` / `AgentConfigOptions` | Behavior-only settings. | [runtime.md](runtime.md#agentconfigoptions) |
| `AgentClient` / `OrkesAgentClient` | Control plane (`/agent/*`). No local workers. | [client.md](client.md) |
| `WorkflowClient` | Read-only execution reads. | [client.md](client.md#workflowclient) |
| `SchedulerClient` | Cron lifecycle. | [agent-definition.md](agent-definition.md#schedules) |
| `AgentResult` | Terminal result. | [agent-definition.md](agent-definition.md#agentresult) |
| `AgentHandle` / `ClientHandle` | In-flight interaction. | [agent-definition.md](agent-definition.md#agenthandle) |
| `AgentStream` / `AgentEvent` | Incremental events. | [agent-definition.md](agent-definition.md#agentstream-and-agentevent) |
| `ToolContext` | Per-call context and per-run state. | [agent-definition.md](agent-definition.md#toolcontext) |
| `ConductorAgentError` | Base of the error hierarchy. | [agent-definition.md](agent-definition.md#errors) |

## Runtime vs client

The distinction that matters most:

| | `AgentRuntime` | `AgentClient` |
|---|---|---|
| Polls local `tool()` workers | **Yes** | **No** |
| Compiles and starts executions | Yes | Yes |
| Right for agents with local tools | Yes | Only with a separate `serve()` process |
| Right for LLM-only / server-side-tool agents | Yes | Yes |

## Next steps

[runtime.md](runtime.md) · [client.md](client.md) ·
[agent-definition.md](agent-definition.md) · [agent-schema.md](agent-schema.md)
