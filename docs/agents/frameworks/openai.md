# OpenAI Agents SDK

**Audience:** developers running `@openai/agents` agents on Conductor without
rewriting them.

## Prerequisites

```bash
npm install @io-orkes/conductor-javascript @openai/agents
```

A reachable Conductor server with the agent runtime, and the OpenAI provider
configured on that **server** — the SDK never reads your provider key.
`@openai/agents` is an optional peer dependency.

## Running one

Pass the agent straight to the runtime. Same entry point as a native `Agent`.

```ts
import { Agent, setTracingDisabled } from '@openai/agents';
import { AgentRuntime } from '@io-orkes/conductor-javascript/agents';

setTracingDisabled(true);

const agent = new Agent({
  name: 'greeter',
  instructions: 'You are a friendly assistant. Keep your responses concise and helpful.',
  model: 'gpt-4o-mini',
});

const runtime = new AgentRuntime();
try {
  const result = await runtime.run(agent, 'Say hello and tell me a fun fact about TypeScript.');
  result.printResult();
} finally {
  await runtime.shutdown();
}
```

**Expected result:** `status=COMPLETED` with the model's reply — the agent ran as
a durable Conductor execution rather than in-process.

**Common failure modes:** an "unrecognized agent" error means detection didn't
match; check the table below. Leaving OpenAI's own tracing enabled will try to
reach OpenAI's tracing endpoint from your process — call `setTracingDisabled(true)`.

## How detection works

`runtime.run(agent, ...)` calls `detectFramework(agent)`. Detection is pure
duck-typing; the SDK imports no framework.

An object is treated as `openai` when it has `name`, string-or-function
`instructions`, a string `model`, `tools[]`, **and** an OpenAI marker such as
`handoffs[]`, `inputGuardrails[]`, `asTool()`, or `toolUseBehavior`.

If nothing matches and the object isn't a native `Agent`, you get an explicit
error rather than a silent fallback.

## Deploying

Framework agents deploy like native ones: `runtime.deploy(agent)`. See
[../concepts/deploy-serve-run.md](../concepts/deploy-serve-run.md).

## Next steps

[../concepts/tools.md](../concepts/tools.md) — native tools are a superset ·
[google-adk.md](google-adk.md) · [langgraph.md](langgraph.md)
