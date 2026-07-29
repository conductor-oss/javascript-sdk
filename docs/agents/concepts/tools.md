# Tools

**Audience:** developers giving Conductor agents the ability to call code, HTTP
endpoints, MCP servers, and other agents.

## Prerequisites

An agent that runs (see [agents.md](agents.md)). Local tools additionally need
the process to stay alive while the run is in flight, because they execute as
Conductor workers this process polls. `zod` is optional — `inputSchema` accepts
a Zod schema or a plain JSON Schema object.

**Security note:** tools are arbitrary code reachable by model output. Treat tool
arguments as untrusted input, scope credentials per tool rather than per agent,
and set `approvalRequired: true` on anything destructive. See
[../../security.md](../../security.md).

## Local tools — `tool()`

`tool()` wraps an async function. It runs locally as a Conductor worker the
runtime polls; `run()` and `serve()` register and poll it for you.

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

**Expected result:** the model calls `get_weather`, your function runs in this
process, and the result feeds back into the conversation.

**Common failure mode:** the run hangs at the tool call. That means no worker is
polling — you used `AgentClient.run()` (control plane only) instead of
`runtime.run()`, or the process exited early.

Options: `name`, `description`, `inputSchema`, `outputSchema?`,
`approvalRequired?`, `timeoutSeconds?`, `external?`, `credentials?`,
`guardrails?`, `maxCalls?`, `retryCount?`, `retryDelaySeconds?`, `retryPolicy?`.

The function receives an optional second argument, the `ToolContext`
(`sessionId`, `executionId`, `agentName`, `metadata`, `dependencies`, and a
mutable `state`). See [stateful.md](stateful.md).

### No per-run mutable capture

A `tool()` handler is registered **once** and its worker is reused across
concurrent runs — never re-created per run. Don't close over per-run mutable
state: a module-level counter, an array pushed to across calls, a captured `let`
reassigned mid-run. Two runs executing the same tool concurrently would corrupt
each other's state.

Anything that varies per run belongs in `ToolContext` — `state` for durable
per-execution data, `dependencies` for injected collaborators — or in the
function's own arguments. Never in a closure variable mutated across invocations.

## Tool discovery — `@Tool` / `toolsFrom`

```ts
import { Tool, toolsFrom } from '@io-orkes/conductor-javascript/agents';

class MathTools {
  @Tool({ description: 'Add two numbers.', inputSchema: {
    type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'],
  }})
  async add(args: { a: number; b: number }) { return { sum: args.a + args.b }; }
}

const tools = toolsFrom(new MathTools());     // ToolFunction[], bound to the instance
new Agent({ name: 'calc', model, tools });
```

Requires `"experimentalDecorators": true`.

## Built-in tools

These return a `ToolDef` that runs **server-side** — no local worker, so they
work with the control-plane client too. Add them to `tools: [...]`.

| Builder | Tool type | Purpose |
|---|---|---|
| `httpTool({ name, description, url, method?, headers?, inputSchema?, credentials? })` | `http` | Call an HTTP endpoint. |
| `mcpTool({ serverUrl, name?, description?, headers?, toolNames?, maxTools?, credentials? })` | `mcp` | Expose an MCP server's tools. |
| `apiTool({ url, name?, description?, headers?, toolNames?, maxTools?, credentials? })` | `api` | Expose an OpenAPI/API as tools. |
| `agentTool(agent, { name?, description?, retryCount?, retryDelaySeconds?, optional? })` | `agent_tool` | Call another `Agent` as a tool. |
| `humanTool({ name, description, inputSchema? })` | `human` | Pause for human input. |
| `imageTool({ name, description, llmProvider, model, style?, size? })` | `generate_image` | Generate images. |
| `audioTool({ name, description, llmProvider, model, voice?, speed?, format? })` | `generate_audio` | Text-to-speech. |
| `videoTool({ name, description, llmProvider, model, duration?, resolution?, fps?, ... })` | `generate_video` | Generate video. |
| `pdfTool({ name?, description?, pageSize?, theme?, fontSize? })` | `generate_pdf` | Render markdown to PDF. |
| `waitForMessageTool({ name, description, batchSize?, blocking? })` | `pull_workflow_messages` | Dequeue workflow messages. |
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

Lets a running agent dequeue messages pushed into its workflow message queue
(Conductor `PULL_WORKFLOW_MESSAGES`). No worker needed. In blocking mode
(default) the task stays in progress until a message arrives.

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

## Credentials

Declare credential names per tool. The server resolves them when it polls the
task and delivers them wire-only on that task's `runtimeMetadata`; the SDK
injects them into `process.env` for the duration of the call
(mutate-invoke-restore, serialized so concurrent calls don't clobber each other).

```ts
const dbLookup = tool(
  async () => ({ ok: (process.env.DB_API_KEY ?? '') !== '' }),
  {
    name: 'db_lookup',
    description: 'Look up data.',
    inputSchema: { type: 'object', properties: {}, required: [] },
    credentials: ['DB_API_KEY'],
  },
);
```

For HTTP and MCP tools, reference them inline with `${NAME}` substitution:

```ts
httpTool({
  name: 'search_api',
  description: 'Search.',
  url: 'https://api.example.com/search',
  headers: { Authorization: 'Bearer ${SEARCH_API_KEY}' },
  credentials: ['SEARCH_API_KEY'],
});
```

`getCredential('NAME')` fetches one explicitly inside a tool.

**Fail-closed, no fallback.** If a tool declares `credentials: [...]` and the
server didn't deliver one, the task fails non-retryably naming the missing
credential. There is deliberately no ambient-env fallback that would silently
read a locally-set variable instead. Servers that predate
`TaskDef.runtimeMetadata` support (conductor-oss without PR #1255,
agentspan server > 0.4.2) can't deliver credentials at all.

You can also pass credentials at call time:
`runtime.run(agent, prompt, { credentials: ['X'] })`.

## Cleanup

`runtime.shutdown()` stops the tool workers. A process with registered tools will
not exit without it.

## Next steps

[guardrails](guardrails.md) — validate tool output ·
[streaming & HITL](streaming-hitl.md) — gate tools on approval ·
[stateful](stateful.md) — share state across calls
