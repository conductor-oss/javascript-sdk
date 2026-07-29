# Defining agents

Everything you author is an `Agent`. A simple LLM agent, a tool-using agent, and
a multi-agent orchestration are all the same `Agent` class with different
options.

All snippets import from `@io-orkes/conductor-javascript/agents` and assume a
runtime:

```ts
import { Agent, AgentRuntime, tool } from '@io-orkes/conductor-javascript/agents';
const runtime = new AgentRuntime();
```

## Defining an agent

```ts
const agent = new Agent({
  name: 'greeter',                 // required; must match /^[a-zA-Z][a-zA-Z0-9_-]*$/
  model: 'anthropic/claude-sonnet-4-6',     // provider/model string
  instructions: 'Keep answers short.',
  temperature: 0.7,
  maxTurns: 25,                    // default 25
  maxTokens: 2048,
  timeoutSeconds: 0,               // 0 = server default
});
```

There is also a functional form, `agent(fn, options)`, where `fn` is the
dynamic-instructions callable (see below):

```ts
import { agent } from '@io-orkes/conductor-javascript/agents';

const a = agent(() => 'You are a helpful assistant.', {
  name: 'helper',
  model: 'anthropic/claude-sonnet-4-6',
});
```

### Instructions

Instructions can be a plain string, a callable, or a server-managed prompt
template.

```ts
// Static
new Agent({ name: 'a', model, instructions: 'You are concise.' });

// Dynamic (callable) — evaluated to a string when the agent is serialized
new Agent({ name: 'a', model, instructions: () => `Today is ${new Date().toDateString()}.` });

// Server-managed prompt template (referenced by name + version)
import { PromptTemplate } from '@io-orkes/conductor-javascript/agents';
new Agent({
  name: 'a',
  model,
  instructions: new PromptTemplate('support_greeting', { brand: 'Acme' }, 1),
});
```

An omitted `model` is valid only for inherited-model designs (a sub-agent that
takes its model from its parent) or external-agent designs (`external: true`).

## Agent-from-method (`@AgentDec` / `agentsFrom`)

Define agents as decorated methods on a class and extract them:

```ts
import { AgentDec, agentsFrom } from '@io-orkes/conductor-javascript/agents';

class MyAgents {
  @AgentDec({ name: 'summarizer', model: 'anthropic/claude-sonnet-4-6', instructions: 'Summarize text.' })
  summarize() {}

  @AgentDec({ name: 'classifier', model: 'anthropic/claude-sonnet-4-6', instructions: 'Classify text.' })
  classify() {}
}

const [summarizer, classifier] = agentsFrom(new MyAgents());   // Agent[]
```

> `@AgentDec`/`@Tool` are TypeScript experimental decorators — set
> `"experimentalDecorators": true` in your `tsconfig.json`.

## Common failures

- A model error normally means the provider credential or model is missing on
  the **server**, not merely in the local process.
- A `name` that doesn't match `^[a-zA-Z][a-zA-Z0-9_-]*$` is rejected at
  serialization time.

## Next steps

Use [tools](tools.md) for capabilities, [multi-agent](multi-agent.md) for
composition, and [runtime modes](deploy-serve-run.md) for deployment. See the
[Agent definition reference](../reference/agent-definition.md) for the full
options table.
