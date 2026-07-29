# Guardrails

**Audience:** developers validating what goes into and comes out of a Conductor
agent.

## Prerequisites

A working agent. Custom guardrails run as local workers, so they need a polling
process; regex and LLM guardrails run server-side and do not.

**Security note:** guardrails are a mitigation, not a boundary. A regex that
blocks a secret pattern reduces accidental disclosure; it does not make an agent
safe to hand untrusted input. Pair them with scoped credentials
([tools.md](tools.md#credentials)) and approval gates
([streaming-hitl.md](streaming-hitl.md)).

## Attaching guardrails

Attach at the agent level (`guardrails: [...]`) or per tool
(`tool(fn, { guardrails: [...] })`). Each has a `position` (`'input'` or
`'output'`, default `'output'`) and an `onFail` policy (`'raise'`, `'retry'`,
`'fix'`, or `'human'`, default `'raise'`).

```ts
import { guardrail, RegexGuardrail, LLMGuardrail } from '@io-orkes/conductor-javascript/agents';

// Regex — runs on the server, no worker
const noSecrets = new RegexGuardrail({
  name: 'no_api_keys',
  patterns: ['sk-[A-Za-z0-9]{20,}'],
  mode: 'block',          // 'block' fails if any pattern matches; 'allow' fails if none match
  onFail: 'raise',
  message: 'Output contained a secret.',
});

// LLM — server-side judge
const policy = new LLMGuardrail({
  name: 'safety',
  model: 'anthropic/claude-sonnet-4-6',
  policy: 'Reject any content that gives medical dosage advice.',
  position: 'output',
  onFail: 'retry',
  maxRetries: 2,
});

// Custom — your function, runs locally as a worker
const minLength = guardrail(
  (content: string) => ({ passed: content.length >= 10, message: 'Too short' }),
  { name: 'min_length', position: 'output', onFail: 'fix' },
);

const agent = new Agent({
  name: 'safe_agent',
  model,
  instructions: '…',
  guardrails: [noSecrets, policy, minLength],
});
```

`RegexGuardrail` and `LLMGuardrail` are class instances; the serializer accepts
them directly.

**Expected result:** a run whose output trips a `'raise'` guardrail completes with
`result.finishReason === 'guardrail'` rather than throwing — check
`finishReason`, not just `isSuccess`.

**Common failure mode:** a custom `guardrail()` never firing usually means no
worker is polling. Like local tools, it needs `runtime.run()` or a live
`serve()`, not the control-plane client.

## onFail policies

| Policy | Behavior |
|---|---|
| `'raise'` | Fail the run. `finishReason` becomes `'guardrail'`. |
| `'retry'` | Re-run the model up to `maxRetries`, then raise. |
| `'fix'` | Ask the model to repair the output to satisfy the guardrail. |
| `'human'` | Pause and wait for a human verdict — see [streaming-hitl.md](streaming-hitl.md). |

## Other forms

- `guardrail.external({ name, position?, onFail? })` — handled by a remote worker
  you run elsewhere.
- The `@Guardrail` decorator with `guardrailsFrom(instance)`, mirroring
  `@Tool`/`toolsFrom`.

## Next steps

[termination](termination.md) · [tools](tools.md) ·
[streaming & HITL](streaming-hitl.md)
