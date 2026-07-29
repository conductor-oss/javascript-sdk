# LangChain

**Audience:** developers running LangChain agent executors on Conductor.

## Prerequisites

```bash
npm install @io-orkes/conductor-javascript langchain @langchain/core
```

A reachable Conductor server with the agent runtime, and the provider configured
on that **server**. The LangChain packages are optional peer dependencies.

## Running an executor

A real `AgentExecutor` is detected via `.invoke()` plus an `lc_namespace` array.
To make the model and tools unambiguous, use the SDK's drop-in builder, which
attaches `._agentspan` metadata:

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

**Expected result:** `status=COMPLETED` with the summary.

**Common failure mode:** passing a bare `AgentExecutor` whose model isn't
introspectable, which yields an agent with no model. Prefer
`createAgentExecutor` — or pass `{ model: '…' }` in the run options.

That metadata key is a cross-SDK wire contract shared with the Python SDK. Don't
set it by hand.

## Also exported

The `@io-orkes/conductor-javascript/agents/langchain` subpath also exports:

- `createRunnableWithMetadata(...)` — a runnable-like object with `invoke`,
  `lc_namespace`, and metadata.
- `getLangChainModule()` — lazy access to the underlying module.
- `ConductorAgentMetadata` — the metadata type. (`AgentspanMetadata` remains
  exported as a deprecated alias.)

## Detection rules

`langchain` matches on `.invoke()` plus `lc_namespace`. LangGraph is checked
first, so a graph is never misread as an executor — see
[langgraph.md](langgraph.md).

## Limitations

Framework-spawned agents never route through a per-run domain, so
[liveness monitoring](../concepts/stateful.md#liveness-monitoring) does not apply.

## Next steps

[langgraph.md](langgraph.md) · [vercel-ai.md](vercel-ai.md) ·
[../concepts/tools.md](../concepts/tools.md)
