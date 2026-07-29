# LangGraph

**Audience:** developers running LangGraph graphs on Conductor.

## Prerequisites

```bash
npm install @io-orkes/conductor-javascript @langchain/langgraph @langchain/core @langchain/openai
```

A reachable Conductor server with the agent runtime, and the provider configured
on that **server**. The `@langchain/*` packages are optional peer dependencies.

## Running a prebuilt graph

Pass a `createReactAgent` graph directly — detection handles it via `.invoke()`
plus graph shape.

```ts
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { AgentRuntime } from '@io-orkes/conductor-javascript/agents';

const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 });
const graph = createReactAgent({ llm, tools, name: 'math_agent' });

const runtime = new AgentRuntime();
try {
  const result = await runtime.run(graph, 'What is 12 * 9?');
  result.printResult();
} finally {
  await runtime.shutdown();
}
```

**Expected result:** `status=COMPLETED` with the computed answer.

**Common failure mode:** the serializer introspects the graph to find the model
and tools. On a complex or custom graph that introspection can fail or guess
wrong, producing an agent with no model or a missing tool.

## When introspection isn't enough

Import `createReactAgent` from the SDK wrapper instead. It stamps `._agentspan`
metadata onto the graph so the serializer skips introspection and reads the
metadata directly.

```ts
import { createReactAgent } from '@io-orkes/conductor-javascript/agents/langgraph';
```

That metadata key is a cross-SDK wire contract shared with the Python SDK — it is
deliberately not renamed, and you should not set it by hand.

You can also pass a model hint at call time when detection can't infer one:

```ts
await runtime.run(graph, prompt, { model: 'anthropic/claude-sonnet-4-6' });
```

## Detection rules

An object is treated as `langgraph` when it has `.invoke()` plus a graph shape:
`.getGraph()`, a `.nodes` Map, or `.nodes` together with `.builder`. LangGraph is
checked before LangChain, so a graph is never misread as an executor.

## Limitations

Framework-spawned agents never route through a per-run domain, so
[liveness monitoring](../concepts/stateful.md#liveness-monitoring) does not apply
to them.

## Next steps

[langchain.md](langchain.md) · [../concepts/tools.md](../concepts/tools.md) ·
[../concepts/deploy-serve-run.md](../concepts/deploy-serve-run.md)
