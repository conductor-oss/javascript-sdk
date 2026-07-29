# Termination

**Audience:** developers bounding multi-turn and multi-agent Conductor agent
loops.

## Prerequisites

A multi-turn or multi-agent agent (see [multi-agent.md](multi-agent.md)). Every
agent already has `maxTurns` (default 25) as a backstop; termination conditions
are for stopping on *meaning* rather than on count alone.

## Conditions

Pass one to `termination:`. They compose with `.and()` / `.or()`, or the variadic
`AndCondition` / `OrCondition`.

```ts
import { TextMention, MaxMessage, TokenUsageCondition, StopMessage } from '@io-orkes/conductor-javascript/agents';

const agent = new Agent({
  name: 'debate',
  model,
  agents: [a, b],
  strategy: 'round_robin',
  termination: new TextMention('TERMINATE')                  // stop when output mentions text
    .or(new MaxMessage(10))                                  // …or after 10 messages
    .or(new TokenUsageCondition({ maxTotalTokens: 50000 })),
});
```

| Condition | Stops when |
|---|---|
| `TextMention(text, caseSensitive?)` | Output mentions `text`. |
| `StopMessage(stopMessage)` | Output equals the stop message. |
| `MaxMessage(maxMessages)` | The conversation reaches N messages. |
| `TokenUsageCondition({ maxTotalTokens?, maxPromptTokens?, maxCompletionTokens? })` | A token budget is exhausted. |
| `AndCondition(...)` / `OrCondition(...)` | Composites. |

**Expected result:** the loop ends and `result.finishReason` reflects the cause.

**Common failure mode:** a `TextMention` that never matches, leaving `maxTurns`
to end the run — which reads as a successful completion with a truncated answer.
Always pair a semantic condition with a `MaxMessage` or token bound, as above.

## Gates

`TextGate` and `gate()` gate transitions rather than ending the run:

```ts
import { TextGate } from '@io-orkes/conductor-javascript/agents';

new Agent({ name: 'a', model, gate: new TextGate({ text: 'APPROVED', caseSensitive: false }) });
```

## Next steps

[multi-agent](multi-agent.md) · [callbacks](callbacks.md) ·
[guardrails](guardrails.md)
