# Stateful agents

Set `stateful: true` on an agent (or `stateful: true` on a tool def) to
isolate tool workers per execution via a unique domain UUID. Within a single
run, tools share a mutable `context.state` object; mutations are captured and
propagated between tool calls.

```ts
import type { ToolContext } from '@io-orkes/conductor-javascript/agents';

const addItem = tool(
  async (args: { item: string }, ctx?: ToolContext) => {
    const items: string[] = (ctx?.state?.list as string[]) ?? [];
    items.push(args.item);
    if (ctx?.state) ctx.state.list = items;
    return { total: items.length };
  },
  { name: 'add_item', description: 'Add an item.', inputSchema: {
    type: 'object', properties: { item: { type: 'string' } }, required: ['item'],
  }},
);

const agent = new Agent({ name: 'list_agent', model, tools: [addItem], stateful: true });
```

Choose a stable session/correlation identifier up front when a session needs
to resume durable conversation state across multiple calls, and classify
which user data is appropriate to persist before enabling `memory` — an
unbounded history placed directly in prompts grows context and cost with no
retention policy; use `ConversationMemory`'s `maxMessages` windowing or a
condensation strategy instead.

## Memory

Two memory primitives are available for agents that need to remember things
across turns or across runs:

- **`ConversationMemory`** — an in-process chat-message log with optional
  `maxMessages` windowing. System messages are always preserved; only
  non-system messages are trimmed once the window fills. Attach it via
  `AgentOptions.memory` — the runtime serializes it onto the wire as part of
  the agent config (see [agent schema](../reference/agent-schema.md)).
- **`SemanticMemory`** — a similarity-search store (pluggable via the
  `MemoryStore` interface; `InMemoryStore` ships built in) for retrieving
  relevant prior content by keyword/semantic overlap rather than replaying
  the whole conversation. It isn't a first-class `AgentOptions` field —
  query it explicitly from inside a `tool()` handler, or call `getContext()`
  to format a result block for injection into instructions.

```ts
import {
  Agent, AgentRuntime, ConversationMemory, SemanticMemory, InMemoryStore, tool,
} from '@io-orkes/conductor-javascript/agents';

// ConversationMemory — windowed chat history, pre-populated with context
const conversationMem = new ConversationMemory({ maxMessages: 20 });
conversationMem.addSystemMessage('You are a helpful research assistant.');
conversationMem.addUserMessage('I need help researching quantum computing.');
conversationMem.addAssistantMessage('I can help with that! What specific aspect?');

// SemanticMemory — index prior content, retrieve it via a tool
const store = new InMemoryStore();
const semanticMem = new SemanticMemory({ store });
semanticMem.add('Quantum error correction is essential for practical quantum computers.');

const recallTool = tool(
  async (args: { query: string }) => ({ results: semanticMem.search(args.query, 3) }),
  {
    name: 'recall_articles',
    description: 'Search past articles by topic.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
);

const researchAgent = new Agent({
  name: 'research_agent',
  model,
  instructions: 'Use your memory and recall tool to answer questions.',
  tools: [recallTool],
  memory: conversationMem,
});
```

`ConversationMemory.toChatMessages()` returns the (possibly windowed) message
log at any point; `SemanticMemory.searchEntries()` returns full `MemoryEntry`
objects (`id`, `content`, `metadata`, `timestamp`) instead of bare content
strings when you need the metadata.

## Liveness monitoring

For a stateful run (one with a domain-isolated worker), `runtime.start()`/
`run()`/`stream()` also start a liveness monitor: it polls the execution's
workflow every `livenessCheckIntervalSeconds` and, if a `SCHEDULED`/
`IN_PROGRESS` task in that run's domain sits unpolled (`pollCount === 0`) for
longer than `livenessStallSeconds`, a blocking `wait()` rejects with
`WorkerStallError` instead of hanging forever — the signal that the local
worker process for this run's domain died. The monitor stops on terminal
status or handle disposal and never keeps the process alive on its own.
Configure via `AgentConfig`/env: `livenessEnabled`
(`CONDUCTOR_AGENT_LIVENESS_ENABLED`, default `true`), `livenessStallSeconds`
(`CONDUCTOR_AGENT_LIVENESS_STALL_SECONDS`, default `30`),
`livenessCheckIntervalSeconds`
(`CONDUCTOR_AGENT_LIVENESS_CHECK_INTERVAL_SECONDS`, default `10`).
Framework-spawned agents (LangGraph/LangChain/Vercel AI wrappers) never route
through a per-run domain, so liveness monitoring doesn't apply to them.

## Recovering after a worker process restart

`WorkerStallError` tells you the worker for a domain died; to actually
recover, the replacement worker process needs to start polling that domain's
tasks again. There's no execution-scoped "reattach" call — the recovery
pattern is a fresh `serve()` invocation (with no agents) in the new process,
which resumes polling for whatever tool workers are already registered on
the server, covering every in-flight stateful execution's domain at once,
not just one `executionId`. See
[deploy/serve/run/plan](deploy-serve-run.md#deploy-vs-serve-vs-run-vs-plan).

## Next steps

Read [streaming and approval](streaming-hitl.md) and
[runtime modes](deploy-serve-run.md).
