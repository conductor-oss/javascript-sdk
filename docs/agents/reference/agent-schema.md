# Agent configuration contract

**Audience:** developers who need to know exactly what the SDK sends to the
server, or who generate agent configs from something other than the `Agent`
class.

The machine-readable contract is [agent-schema.json](agent-schema.json), a
draft-07 JSON Schema. CI validates it against every fixture in `e2e/_configs/`
(see `scripts/verify-agent-schema.mjs`).

## Prerequisites

None to read. To regenerate or check it:

```bash
npm run verify:agent-schema
```

## What it describes

`AgentConfigSerializer` turns an `Agent` — or a detected framework object — into a
plain JSON object, which the server's agent compiler turns into a workflow
definition. That JSON is the contract. It is shared with the Python and Java SDKs:
same field names, same nesting, same compiler on the server side.

The simplest valid config is a name and a model:

```json
{
  "name": "greeter",
  "model": "openai/gpt-4o-mini"
}
```

`name` is the only required field, and it must match
`^[a-zA-Z][a-zA-Z0-9_-]*$` because it becomes a workflow definition name.

## Shape

| Field | Notes |
|---|---|
| `name` | Required. Identifier-shaped. |
| `model`, `baseUrl`, `temperature`, `maxTokens`, `maxTurns`, `timeoutSeconds` | LLM and execution tuning. `maxTurns` defaults to 25; `timeoutSeconds: 0` means the server default. |
| `instructions` | A string, or a prompt-template reference `{ name, variables?, version? }`. A callable is evaluated to a string **at serialization time**. |
| `tools[]` | Each has `name` + `toolType`. See below. |
| `agents[]` | Sub-agent configs — the schema is recursive (`$ref: "#"`). |
| `strategy` | One of the nine orchestration strategies. |
| `router`, `planner`, `fallback` | Named agent slots. `router` is required for `strategy: 'router'`, `planner` for `'plan_execute'`. |
| `guardrails[]`, `handoffs[]`, `termination`, `gate` | Validation and control flow. |
| `outputType` | JSON Schema for structured output. A Zod schema is converted before serialization. |
| `credentials[]` | Secret names, resolved server-side at poll time. |
| `stateful` | Domain-isolated workers plus shared tool state. |
| `callbacks[]` | One entry per implemented lifecycle hook. |
| `_framework` | Present only when serialized from a framework object: `openai`, `google_adk`, `langchain`, `langgraph`, `vercel-ai`, or `skill`. |

`additionalProperties` is `true` throughout. The server accepts fields this SDK
version doesn't know about, so a newer server feature doesn't break an older SDK.

## Tool types

`toolType` discriminates how the server executes a tool:

| `toolType` | Runs where | Builder |
|---|---|---|
| `worker` | Your process, polled as a Conductor worker | `tool()` |
| `http` | Server | `httpTool` |
| `mcp` | Server | `mcpTool` |
| `api` | Server | `apiTool` |
| `agent_tool` | Server, as a sub-agent | `agentTool` |
| `human` | Pauses for a person | `humanTool` |
| `generate_image` / `generate_audio` / `generate_video` / `generate_pdf` | Server | `imageTool` / `audioTool` / `videoTool` / `pdfTool` |
| `pull_workflow_messages` | Server | `waitForMessageTool` |
| `rag_search` / `rag_index` | Server | `searchTool` / `indexTool` |

Only `worker` needs a polling process. That single distinction explains most
"my run hangs at the tool call" reports — see
[../concepts/deploy-serve-run.md](../concepts/deploy-serve-run.md).

Tool-type-specific settings (a URL, headers, a vector DB) live under `config`.

## Inspecting a real config

`runtime.plan(agent)` returns the compiled workflow definition;
`AgentConfigSerializer` gives you the config that produced it:

```ts
import { AgentConfigSerializer } from '@io-orkes/conductor-javascript/agents';

console.log(JSON.stringify(new AgentConfigSerializer().serialize(agent), null, 2));
```

**Expected result:** JSON matching this schema. Useful for diffing what an agent
change actually alters, and for filing a bug against the compiler.

## Next steps

[agent-definition.md](agent-definition.md) — the authoring-side fields ·
[api.md](api.md) · [../concepts/structured-output.md](../concepts/structured-output.md)
