# OpenAI Agents SDK

Pass an `@openai/agents` `Agent` straight to the runtime — no wrapper needed.
Detection: `.name` + a string/function `.instructions` + a string `.model` +
`.tools[]` + an OpenAI marker (`handoffs[]`, `inputGuardrails[]`, `asTool()`,
`toolUseBehavior`, ...). See [detection overview](../README.md#framework-bridges)
for how this compares to the other bridges.

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

`@openai/agents` is an optional peer dependency — install it only if you use
this bridge.

## Next steps

Framework agents can be deployed too: `runtime.deploy(frameworkAgent)`. See
[deploy/serve/run/plan](../concepts/deploy-serve-run.md).
