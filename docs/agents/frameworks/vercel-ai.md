# Vercel AI SDK

There is no equivalent of this bridge in java-sdk/python-sdk — it exists
because the Vercel AI SDK is a Node/JS-ecosystem-specific tool convention.
Two ways to use it:

**1. AI SDK tools on a native Agent (recommended).** The tool system is a
superset — it auto-detects AI SDK `tool()` objects (Zod `parameters` +
`execute`) and converts them to native tool defs. No wrapper needed.

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

**2. Drop-in `generateText` / `streamText`.** The
`@io-orkes/conductor-javascript/agents/vercel-ai` subpath exports
AI-SDK-shaped `generateText` and `streamText` that internally build an
`Agent` + `AgentRuntime` and map the result back into the AI SDK response
shape:

```ts
import { generateText } from '@io-orkes/conductor-javascript/agents/vercel-ai';

const { text } = await generateText({
  model: 'anthropic/claude-sonnet-4-6',
  prompt: 'Write a haiku about durable execution.',
});
```

`ai` and `zod` are optional peer dependencies — install them only if you use
this bridge.

## Next steps

Framework agents can be deployed too: `runtime.deploy(frameworkAgent)`. See
[deploy/serve/run/plan](../concepts/deploy-serve-run.md).
