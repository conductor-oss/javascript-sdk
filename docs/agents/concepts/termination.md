# Termination + TextGate

Termination conditions decide when a multi-turn / multi-agent loop should
stop. Pass one to `termination:`. They compose with `.and()` / `.or()` (or the
variadic `AndCondition` / `OrCondition`).

```ts
import { TextMention, MaxMessage, TokenUsageCondition, StopMessage } from '@io-orkes/conductor-javascript/agents';

const agent = new Agent({
  name: 'debate',
  model,
  agents: [a, b],
  strategy: 'round_robin',
  termination: new TextMention('TERMINATE')               // stop when output mentions text
    .or(new MaxMessage(10))                                // …or after 10 messages
    .or(new TokenUsageCondition({ maxTotalTokens: 50000 })),
});
```

Available conditions: `TextMention(text, caseSensitive?)`,
`StopMessage(stopMessage)`, `MaxMessage(maxMessages)`,
`TokenUsageCondition({ maxTotalTokens?, maxPromptTokens?,
maxCompletionTokens? })`, and the composites `AndCondition(...)` /
`OrCondition(...)`.

`TextGate` and `gate()` gate transitions (e.g. on `gate:`):

```ts
import { TextGate } from '@io-orkes/conductor-javascript/agents';
new Agent({ name: 'a', model, gate: new TextGate({ text: 'APPROVED', caseSensitive: false }) });
```

## Bounding cost and stopping safely

Set a meaningful `maxTurns` in addition to any termination condition — it's
the backstop when a text/token condition never triggers. Stop a live
execution through `AgentHandle.stop()` / `AgentClient.stop()`: make the call
safe to repeat, and don't assume an in-flight external tool call is
reversible — if a tool has already started, stopping the agent doesn't undo
its side effect. Design compensating work where a stopped execution can leave
external state partially applied.

## Next steps

Continue with [multi-agent](multi-agent.md) and
[agent client control](../reference/client.md).
