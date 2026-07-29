# Structured output

Set `outputType` to a JSON Schema object (or a Zod schema — it is converted to
JSON Schema). The model returns data conforming to the schema; the structured
object lands under `result.output.result`.

```ts
const ArticleAnalysis = {
  type: 'object',
  properties: {
    title:     { type: 'string' },
    category:  { type: 'string', enum: ['tech', 'business', 'science'] },
    sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
    keyTopics: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'category', 'sentiment', 'keyTopics'],
};

const analyzer = new Agent({
  name: 'analyzer',
  model: 'openai/gpt-4o',
  instructions: 'Analyze the article and return structured data.',
  outputType: ArticleAnalysis,
});

const result = await runtime.run(analyzer, 'Analyze: "Quantum Error Correction Hits 99.9% Fidelity"');
const structured = result.output['result'] as Record<string, unknown>;
console.log(structured.category, structured.sentiment);
```

Keep the schema small and make optional fields explicit — a schema that's
larger or more ambiguous than what the prompt actually asks for tends to
produce more validation failures, not fewer. Treat a validation failure as
retryable only when a different model response could plausibly satisfy the
schema; otherwise it means the instructions and the schema disagree about
what's being asked for.

## Next steps

See [agent schema](../reference/agent-schema.md), [guardrails](guardrails.md),
and [runtime reference](../reference/runtime.md).
