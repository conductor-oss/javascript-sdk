# Conductor agents

**Audience:** TypeScript developers defining agents and their instructions.

Everything you author is an `Agent`. A simple LLM agent, a tool-using agent, and
a multi-agent orchestration are all the same class with different options.

## Prerequisites

The SDK installed, a reachable Conductor server with the agent runtime, and a
model configured on that server. See [../README.md](../README.md).

All snippets assume:

```ts
import { Agent, AgentRuntime, tool } from '@io-orkes/conductor-javascript/agents';
const runtime = new AgentRuntime();
```

## Define an agent

```ts
const agent = new Agent({
  name: 'greeter',                      // required; must match /^[a-zA-Z][a-zA-Z0-9_-]*$/
  model: 'anthropic/claude-sonnet-4-6', // provider/model string
  instructions: 'Keep answers short.',
  temperature: 0.7,
  maxTurns: 25,                         // default 25
  maxTokens: 2048,
  timeoutSeconds: 0,                    // 0 = server default
});
```

**Expected result:** `runtime.run(agent, 'hi')` completes with the model's reply
under `result.output.result`.

**Common failure mode:** a name that doesn't match the pattern is rejected at
compile time. Names become workflow definition names on the server, so they must
be identifier-shaped.

There is also a functional form, `agent(fn, options)`, where `fn` is the
dynamic-instructions callable:

```ts
import { agent } from '@io-orkes/conductor-javascript/agents';

const a = agent(() => 'You are a helpful assistant.', {
  name: 'helper',
  model: 'anthropic/claude-sonnet-4-6',
});
```

## Instructions

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

A callable is evaluated **once, at serialization time** — not per turn. If you
need per-turn values, pass them in the prompt or a tool result instead.

## Agents from decorated methods

Define agents as methods on a class and extract them:

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

`@AgentDec` and `@Tool` are TypeScript experimental decorators — set
`"experimentalDecorators": true` in your `tsconfig.json`.

## Reading the result

`run()` returns an `AgentResult`:

```ts
result.printResult();                  // formatted summary to stdout
const ok      = result.isSuccess;      // status === 'COMPLETED'
const output  = result.output;         // Record<string, unknown>; text is usually output.result
const tokens  = result.tokenUsage;     // { promptTokens, completionTokens, totalTokens } | undefined
const finish  = result.finishReason;   // 'stop' | 'length' | 'guardrail' | 'rejected' | ...
const execId  = result.executionId;    // durable execution id on the server
```

`output` is always a `Record`. Plain text arrives as `{ result: "..." }`;
[structured output](structured-output.md) arrives under `output.result` as an
object.

## Cleanup

Always `await runtime.shutdown()` in a `finally`. It stops worker polling; without
it a process with local tools will not exit.

## Next steps

[tools](tools.md) · [multi-agent](multi-agent.md) ·
[agent definition reference](../reference/agent-definition.md)
