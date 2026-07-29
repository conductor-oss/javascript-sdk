# Google ADK

**Audience:** developers running `@google/adk` agents on Conductor.

## Prerequisites

```bash
npm install @io-orkes/conductor-javascript @google/adk
```

A reachable Conductor server with the agent runtime, and the Gemini provider
configured on that **server**. `@google/adk` is an optional peer dependency.

## Running one

Pass an `LlmAgent`, or one of the `Sequential` / `Parallel` / `Loop`
orchestration agents.

```ts
import { LlmAgent } from '@google/adk';
import { AgentRuntime } from '@io-orkes/conductor-javascript/agents';

const agent = new LlmAgent({
  name: 'greeter',
  model: 'gemini-2.5-flash',
  instruction: 'You are a friendly assistant. Keep your responses concise and helpful.',
});

const runtime = new AgentRuntime();
try {
  const result = await runtime.run(agent, 'Say hello and tell me a fun fact about ML.');
  result.printResult();
} finally {
  await runtime.shutdown();
}
```

**Expected result:** `status=COMPLETED` with the model's reply.

**Common failure mode:** ADK uses `instruction` (singular); the native `Agent` and
the OpenAI SDK use `instructions`. Passing the wrong one leaves the agent with no
system prompt rather than erroring.

## How detection works

An object is treated as `google_adk` when it has `subAgents[]` (the orchestration
agents), or a string `model` plus an ADK marker such as `instruction`,
`outputKey`, `generateContentConfig`, or `beforeModelCallback`.

## Deploying

`runtime.deploy(agent)` works the same as for native agents. See
[../concepts/deploy-serve-run.md](../concepts/deploy-serve-run.md).

## Next steps

[openai.md](openai.md) · [langgraph.md](langgraph.md) ·
[../concepts/multi-agent.md](../concepts/multi-agent.md)
