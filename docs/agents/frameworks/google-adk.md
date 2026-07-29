# Google ADK

Pass a `@google/adk` agent (`LlmAgent`, or the `Sequential`/`Parallel`/`Loop`
orchestration agents) straight to the runtime — no wrapper needed. Detection:
`subAgents[]` (orchestration agents), or a string `.model` + ADK markers
(`.instruction`, `.outputKey`, `.generateContentConfig`,
`.beforeModelCallback`, ...). See
[detection overview](../README.md#framework-bridges) for how this compares
to the other bridges.

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

`@google/adk` is an optional peer dependency — install it only if you use
this bridge.

## Next steps

Framework agents can be deployed too: `runtime.deploy(frameworkAgent)`. See
[deploy/serve/run/plan](../concepts/deploy-serve-run.md).
