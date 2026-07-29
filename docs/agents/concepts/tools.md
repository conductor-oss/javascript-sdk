# Tools

## Local tools — `tool()`

`tool()` wraps an async function. Pass a Zod schema **or** a plain JSON Schema
object for `inputSchema`. The function runs locally as a Conductor worker that
the runtime polls; the runtime registers and polls it automatically on
`run()` / `serve()`.

```ts
const getWeather = tool(
  async (args: { city: string }) => {
    return { city: args.city, tempC: 21, conditions: 'sunny' };
  },
  {
    name: 'get_weather',
    description: 'Get the current weather for a city.',
    inputSchema: {
      type: 'object',
      properties: { city: { type: 'string', description: 'City name' } },
      required: ['city'],
    },
  },
);

const agent = new Agent({
  name: 'weather_agent',
  model: 'anthropic/claude-sonnet-4-6',
  instructions: 'Answer weather questions using the tool.',
  tools: [getWeather],
});
```

`tool()` options: `name`, `description`, `inputSchema`, `outputSchema?`,
`approvalRequired?`, `timeoutSeconds?`, `external?`, `credentials?`,
`guardrails?`, `maxCalls?`, `retryCount?`, `retryDelaySeconds?`, `retryPolicy?`.

The tool function receives an optional second argument, the
[`ToolContext`](../reference/api.md#toolcontext) (`sessionId`, `executionId`,
`agentName`, `metadata`, `dependencies`, and a mutable `state`). See
[Stateful agents](stateful.md).

**No per-run mutable capture.** A `tool()` handler is registered once and its
Conductor worker is reused across concurrent runs and (for framework-spawned
agents) concurrent process-local executors — never re-created per run. Don't
close over per-run mutable state in the handler itself (a module-level
counter, an array pushed to across calls, a captured `let` reassigned
mid-run); two runs executing the same tool concurrently would corrupt each
other's state. Everything a handler needs that varies per run belongs in
`ToolContext` (`state` for durable per-execution data, `dependencies` for
injected collaborators) or in the function's own arguments — never in a
closure variable mutated across invocations. Tool and agent factories
otherwise take plain data (JSON-serializable configs), so building one is
always safe to repeat.

## Tool discovery — `@Tool` / `toolsFrom`

Decorate methods on a class and extract them, bound to the instance:

```ts
import { Tool, toolsFrom } from '@io-orkes/conductor-javascript/agents';

class MathTools {
  @Tool({ description: 'Add two numbers.', inputSchema: {
    type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'],
  }})
  async add(args: { a: number; b: number }) { return { sum: args.a + args.b }; }
}

const tools = toolsFrom(new MathTools());     // ToolFunction[]
new Agent({ name: 'calc', model, tools });
```

## Built-in tools

These return a `ToolDef` that runs server-side (no local worker). Add them to
`tools: [...]`.

| Builder | Tool type | Purpose |
|---|---|---|
| `httpTool({ name, description, url, method?, headers?, inputSchema?, credentials? })` | `http` | Call an HTTP endpoint. |
| `mcpTool({ serverUrl, name?, description?, headers?, toolNames?, maxTools?, credentials? })` | `mcp` | Expose an MCP server's tools. |
| `apiTool({ url, name?, description?, headers?, toolNames?, maxTools?, credentials? })` | `api` | Expose an OpenAPI/API as tools. |
| `agentTool(agent, { name?, description?, retryCount?, retryDelaySeconds?, optional? })` | `agent_tool` | Call another `Agent` as a tool (sub-agent). |
| `humanTool({ name, description, inputSchema? })` | `human` | Pause for human input (HITL). |
| `imageTool({ name, description, llmProvider, model, style?, size? })` | `generate_image` | Generate images. |
| `audioTool({ name, description, llmProvider, model, voice?, speed?, format? })` | `generate_audio` | Text-to-speech. |
| `videoTool({ name, description, llmProvider, model, duration?, resolution?, fps?, ... })` | `generate_video` | Generate video. |
| `pdfTool({ name?, description?, pageSize?, theme?, fontSize? })` | `generate_pdf` | Render markdown to PDF. |
| `waitForMessageTool({ name, description, batchSize?, blocking? })` | `pull_workflow_messages` | Dequeue messages from the workflow message queue. |
| `searchTool({ name, description, vectorDb, index, embeddingModelProvider, embeddingModel, namespace?, maxResults? })` | `rag_search` | RAG vector search. |
| `indexTool({ name, description, vectorDb, index, embeddingModelProvider, embeddingModel, namespace?, chunkSize?, chunkOverlap? })` | `rag_index` | RAG index/ingest. |

```ts
import { httpTool, mcpTool } from '@io-orkes/conductor-javascript/agents';

const agent = new Agent({
  name: 'researcher',
  model: 'anthropic/claude-sonnet-4-6',
  tools: [
    httpTool({
      name: 'get_user',
      description: 'Fetch a user by id.',
      url: 'https://api.example.com/users/{id}',
      method: 'GET',
    }),
    mcpTool({ serverUrl: 'https://mcp.example.com/sse', toolNames: ['search'] }),
  ],
});
```

### `waitForMessageTool` — workflow message queue

`waitForMessageTool` lets a running agent dequeue messages pushed into its
workflow message queue (Conductor `PULL_WORKFLOW_MESSAGES`). No worker is
needed — the server handles it. In blocking mode (default) the task stays in
progress until a message arrives. For plain (non-agent) workflows, use the
`pullWorkflowMessages` task builder instead — see
[workflow-message-queue.md](../../workflow-message-queue.md).

```ts
import { waitForMessageTool } from '@io-orkes/conductor-javascript/agents';

const agent = new Agent({
  name: 'inbox_agent',
  model: 'anthropic/claude-sonnet-4-6',
  instructions: 'When asked to wait, call wait_for_message and process what arrives.',
  tools: [waitForMessageTool({
    name: 'wait_for_message',
    description: 'Wait for the next inbound message.',
    batchSize: 1,       // up to 100; default 1
    blocking: true,     // default true
  })],
});
```

### `agentTool` — agent as a tool

```ts
import { agentTool } from '@io-orkes/conductor-javascript/agents';

const translator = new Agent({ name: 'translator', model, instructions: 'Translate to French.' });

const orchestrator = new Agent({
  name: 'orchestrator',
  model,
  instructions: 'Use the translator tool when asked to translate.',
  tools: [agentTool(translator, { description: 'Translate text to French.' })],
});
```

## Next steps

See [multi-agent](multi-agent.md) for composing agents as tools via
`agentTool`, [guardrails](guardrails.md) for tool-level validation, and the
[tool reference](../reference/api.md#tool-and-built-in-tools) for the complete
option and type list.
