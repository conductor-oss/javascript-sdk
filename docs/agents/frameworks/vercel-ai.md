# Vercel AI SDK

**Audience:** developers using the Vercel AI SDK who want durable execution on
Conductor.

This bridge is specific to the JavaScript SDK — the Python and Java SDKs have no
equivalent.

## Prerequisites

```bash
npm install @io-orkes/conductor-javascript ai zod
```

A reachable Conductor server with the agent runtime, and the provider configured
on that **server**. `ai` and `zod` are optional peer dependencies.

## Recommended: AI SDK tools on a native agent

The native tool system is a superset. It auto-detects AI SDK `tool()` objects — a
Zod `parameters` schema plus `execute` — and converts them to native tool defs. No
wrapper needed.

```ts
import { tool as aiTool } from 'ai';
import { z } from 'zod';
import { Agent, AgentRuntime } from '@io-orkes/conductor-javascript/agents';

const weatherTool = aiTool({
  description: 'Get current weather for a city',
  parameters: z.object({ city: z.string().describe('City name') }),
  execute: async ({ city }) => ({ city, tempF: 62, condition: 'Foggy' }),
});

const agent = new Agent({
  name: 'weather_agent',
  model: 'anthropic/claude-sonnet-4-6',
  instructions: 'Use available tools to answer questions.',
  tools: [weatherTool],
});

const runtime = new AgentRuntime();
try {
  const result = await runtime.run(agent, 'What is the weather in San Francisco?');
  result.printResult();
} finally {
  await runtime.shutdown();
}
```

**Expected result:** the model calls the tool, `execute` runs in this process as a
Conductor worker, and the answer includes the weather.

**Common failure mode:** the run hangs at the tool call — `execute` runs locally,
so it needs a polling process. Use `runtime.run()` or keep a `serve()` alive; the
control-plane client won't poll it.

This path gets you the full native feature set — guardrails, approval gates,
stateful runs — on top of AI SDK tools.

## Drop-in `generateText` / `streamText`

The `/agents/vercel-ai` subpath exports AI-SDK-shaped `generateText` and
`streamText` that internally build an `Agent` and `AgentRuntime`, then map the
result back into the AI SDK response shape.

```ts
import { generateText } from '@io-orkes/conductor-javascript/agents/vercel-ai';

const { text } = await generateText({
  model: 'anthropic/claude-sonnet-4-6',
  prompt: 'Write a haiku about durable execution.',
});
```

**Expected result:** `text` holds the haiku, having executed durably on Conductor.

Use this to retrofit durability into existing AI SDK call sites with a one-line
import change. Prefer the native-agent path above for anything new — the drop-in
surface intentionally mirrors the AI SDK rather than exposing Conductor features.

## Limitations

Framework-spawned agents never route through a per-run domain, so
[liveness monitoring](../concepts/stateful.md#liveness-monitoring) does not apply
to the drop-in path.

## Next steps

[../concepts/tools.md](../concepts/tools.md) ·
[../concepts/streaming-hitl.md](../concepts/streaming-hitl.md) ·
[langchain.md](langchain.md)
