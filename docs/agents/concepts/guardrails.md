# Guardrails

Guardrails validate input or output. Attach them at the agent level
(`guardrails: [...]`) or per-tool (`tool(fn, { guardrails: [...] })`). Each has
a `position` (`'input'` | `'output'`, default `'output'`) and an `onFail`
policy (`'raise'` | `'retry'` | `'fix'` | `'human'`, default `'raise'`).

```ts
import { guardrail, RegexGuardrail, LLMGuardrail } from '@io-orkes/conductor-javascript/agents';

// Regex (runs on the server, no worker)
const noSecrets = new RegexGuardrail({
  name: 'no_api_keys',
  patterns: ['sk-[A-Za-z0-9]{20,}'],
  mode: 'block',          // 'block' fails if any pattern matches; 'allow' fails if none match
  onFail: 'raise',
  message: 'Output contained a secret.',
});

// LLM (server-side LLM judge)
const policy = new LLMGuardrail({
  name: 'safety',
  model: 'anthropic/claude-sonnet-4-6',
  policy: 'Reject any content that gives medical dosage advice.',
  position: 'output',
  onFail: 'retry',
  maxRetries: 2,
});

// Custom (your function, runs locally as a worker)
const minLength = guardrail(
  (content: string) => ({ passed: content.length >= 10, message: 'Too short' }),
  { name: 'min_length', position: 'output', onFail: 'fix' },
);

const agent = new Agent({
  name: 'safe_agent',
  model,
  instructions: '…',
  guardrails: [noSecrets.toGuardrailDef?.() ?? noSecrets, policy.toGuardrailDef?.() ?? policy, minLength],
});
```

`RegexGuardrail` / `LLMGuardrail` are class instances; the serializer accepts
the instance directly. There is also a `guardrail.external({ name, position?,
onFail? })` form for guardrails handled by a remote worker, and a
`@Guardrail` decorator with `guardrailsFrom(instance)`.

## Patterns

Use `RegexGuardrail` for deterministic format checks, `LLMGuardrail` for
semantic policy checks, and a custom `guardrail()` only when the rule needs
application state. Apply a tool-level guardrail closest to the side effect it
protects; use an agent-level guardrail for broad input/output policy. An
`onFail: 'retry'` policy is appropriate only when a new model response can
plausibly pass — don't retry on a guardrail whose failure reason can't change
between calls. Never send secrets or raw sensitive records into an
`LLMGuardrail`'s prompt; validate a redacted representation instead.

## Next steps

Use [termination](termination.md) conditions alongside guardrails to bound
retry loops, and see the [guardrails reference](../reference/api.md#guardrails)
for the complete option list.
