# LangGraph

Pass a prebuilt `createReactAgent` graph directly — detection handles it via
`.invoke()` + graph shape (`.getGraph()`, a `.nodes` Map, or `.nodes` +
`.builder`). See [detection overview](../README.md#framework-bridges) for how
this compares to the other bridges.

```ts
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
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

For a complex graph where automatic introspection of the model/tools could
fail, import `createReactAgent` from the SDK wrapper instead. It stamps
`._agentspan` metadata onto the graph so the serializer skips introspection:

```ts
import { createReactAgent } from '@io-orkes/conductor-javascript/agents/langgraph';
```

You can also pass a model hint at call time when detection can't infer it:
`runtime.run(graph, prompt, { model: 'anthropic/claude-sonnet-4-6' })`.

The `@io-orkes/conductor-javascript/agents/langgraph` subpath is an optional
peer-dependent wrapper — `@langchain/langgraph` is only required if you use
this bridge.

## Next steps

Framework agents can be deployed too: `runtime.deploy(frameworkAgent)`. See
[deploy/serve/run/plan](../concepts/deploy-serve-run.md).
