# LangChain

A real `langchain` `AgentExecutor` is detected via `.invoke()` +
`lc_namespace` (e.g. an array present on the object). See
[detection overview](../README.md#framework-bridges) for how this compares to
the other bridges. To make the model/tools unambiguous, use the SDK's
drop-in builder, which attaches `._agentspan` metadata:

```ts
import { createAgentExecutor } from '@io-orkes/conductor-javascript/agents/langchain';
import { AgentRuntime } from '@io-orkes/conductor-javascript/agents';

const executor = createAgentExecutor({ agent, tools, llm });

const runtime = new AgentRuntime();
try {
  const result = await runtime.run(executor, 'Summarize the latest release notes.');
  result.printResult();
} finally {
  await runtime.shutdown();
}
```

The `@io-orkes/conductor-javascript/agents/langchain` subpath also exports
`createRunnableWithMetadata(...)` (a runnable-like object with `invoke` +
`lc_namespace` + metadata) and `getLangChainModule()`.

`@langchain/core` (and whichever `@langchain/*` model/tool packages you use)
are optional peer dependencies — install them only if you use this bridge.

## Next steps

Framework agents can be deployed too: `runtime.deploy(frameworkAgent)`. See
[deploy/serve/run/plan](../concepts/deploy-serve-run.md).
