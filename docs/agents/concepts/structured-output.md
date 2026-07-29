# Structured output

**Audience:** developers who need typed data back from a Conductor agent rather
than prose.

## Prerequisites

A working agent and a model that supports structured output. `zod` is optional —
`outputType` accepts a Zod schema (converted to JSON Schema for you) or a plain
JSON Schema object.

## Declaring a schema

Set `outputType`. The model returns data conforming to it, and the structured
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

**Expected result:** `result.output.result` is an object matching the schema, not
a JSON string. `console.log` prints e.g. `science positive`.

**Common failure modes:**

- `output.result` is a string containing JSON. The model ignored the schema —
  usually a model that doesn't support structured output, or a schema too loose
  to constrain it. Tighten `required` and prefer `enum` over free strings.
- A missing property despite being listed in `required`. Schema adherence is
  enforced by the model, not the SDK; validate before relying on it.

The same schema shape works with Zod:

```ts
import { z } from 'zod';

const analyzer = new Agent({
  name: 'analyzer',
  model: 'openai/gpt-4o',
  instructions: 'Analyze the article.',
  outputType: z.object({
    title: z.string(),
    category: z.enum(['tech', 'business', 'science']),
  }),
});
```

## Structured output vs tools

`outputType` shapes the agent's **final answer**. Tool `inputSchema` shapes what
the model passes **into** a tool. They're independent — an agent can have both.

## Next steps

[tools](tools.md) · [agent definition reference](../reference/agent-definition.md) ·
[configuration contract](../reference/agent-schema.md)
