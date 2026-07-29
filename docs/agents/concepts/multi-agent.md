# Multi-agent orchestration

**Audience:** developers coordinating several Conductor agents in one execution.

## Prerequisites

Two or more agents that work individually (see [agents.md](agents.md)). Each
sub-agent runs as its own sub-workflow on the server, so multi-agent runs are
durable across restarts but spread token usage across sub-workflows — see
[../reference/client.md](../reference/client.md) for aggregating it.

## Strategies

Set `agents: [...]` and a `strategy`. Available: `'sequential'`, `'parallel'`,
`'handoff'`, `'router'`, `'round_robin'`, `'random'`, `'swarm'`, `'manual'`,
`'plan_execute'`.

```ts
// Sequential — agents run in order. .pipe() is sugar for strategy: 'sequential'.
const pipeline = writer.pipe(editor);
// equivalent to:
// new Agent({ name: 'writer_editor', agents: [writer, editor], strategy: 'sequential' });

// Parallel — agents run concurrently, results gathered
const team = new Agent({
  name: 'research_team',
  agents: [webResearcher, dataAnalyst],
  strategy: 'parallel',
});

// Handoff — the parent LLM delegates to sub-agents, which appear as callable tools
const support = new Agent({
  name: 'support',
  model,
  instructions: 'Route to the right specialist.',
  agents: [billingAgent, technicalAgent, salesAgent],
  strategy: 'handoff',
});

// Router — a router agent (or function) picks the sub-agent
const routed = new Agent({
  name: 'router',
  agents: [a, b],
  strategy: 'router',
  router: routerAgent,   // an Agent, or (…) => string returning a sub-agent name
});
```

**Expected result:** `result.output.result` holds the orchestration's final
output. For `parallel`, results are gathered rather than reduced — the parent's
instructions decide how they're combined.

**Common failure mode:** `strategy: 'router'` without a `router`, or
`strategy: 'plan_execute'` without a `planner`, fails at compile time.

`scatterGather` is a convenience builder returning a coordinator that fans a
problem out to workers in parallel and synthesizes the results:

```ts
import { scatterGather } from '@io-orkes/conductor-javascript/agents';
const coordinator = scatterGather({ name: 'fanout', workers: [worker], retryCount: 2 });
```

## Handoffs

For `swarm` and `handoff` strategies, declare explicit transitions with
`handoffs: [...]`. Each condition has a `target` naming a sub-agent.

```ts
import { OnTextMention, OnToolResult, OnCondition } from '@io-orkes/conductor-javascript/agents';

const team = new Agent({
  name: 'coding_team',
  model,
  agents: [pythonExpert, jsExpert],
  strategy: 'swarm',
  handoffs: [
    // Hand off when the output mentions text (case-insensitive)
    new OnTextMention({ target: 'python_expert', text: 'Python' }),

    // Hand off when a specific tool returns, optionally only if the result contains text
    new OnToolResult({ target: 'escalation', toolName: 'detect_severity', resultContains: 'critical' }),

    // Hand off when a custom predicate returns true (runs as a worker task)
    new OnCondition({ target: 'fallback', condition: (ctx) => ctx.result.length > 1000 }),
  ],
});
```

`OnCondition` runs as a **local worker task**, so it needs a polling process —
the same constraint as any local tool. `OnTextMention` and `OnToolResult` are
evaluated server-side.

Constrain which transitions are legal with
`allowedTransitions: { agentName: ['otherAgent', ...] }`.

## Plan-execute

`strategy: 'plan_execute'` runs a planner sub-agent to produce a JSON plan, then
executes it deterministically as a sub-workflow. A `planner` is required; a
`fallback` is optional.

```ts
const harness = new Agent({
  name: 'plan_harness',
  model: 'openai/gpt-4o',
  strategy: 'plan_execute',
  planner: plannerAgent,     // required — produces the JSON plan
  fallback: agenticAgent,    // optional — runs agentically if the plan can't compile or run
  tools: [/* tools the plan steps call */],
});
const result = await runtime.run(harness, 'Build a release report.');
```

You can supply a **deterministic static plan** with the typed builders and pass it
via `RunOptions.plan`. It wins over the planner's output — the planner still runs,
but its result is discarded.

```ts
import { Plan, Step, Op, Generate, Ref } from '@io-orkes/conductor-javascript/agents';

const plan = new Plan({
  steps: [
    new Step('fetch', { operations: [new Op('fetch_data', { args: { source: 'db' } })] }),
    new Step('summarize', {
      dependsOn: ['fetch'],
      operations: [new Op('summarize', {
        generate: new Generate({
          instructions: 'Summarize the fetched data.',
          outputSchema: '{"type":"object","properties":{"summary":{"type":"string"}}}',
          context: new Ref('fetch'),     // reference a prior step's output
        }),
      })],
    }),
  ],
});

const result = await runtime.run(harness, 'Run the pipeline.', { plan });
```

Builders: `Plan({ steps, validation?, onSuccess?, onFailure? })`,
`Step(id, { operations?, dependsOn?, parallel? })`,
`Op(tool, { args? | generate? })`,
`Generate({ instructions, outputSchema, maxTokens?, context? })`,
`Validation(tool, { args?, successCondition? })`, `Action(tool, { args? })`,
`Ref(stepId)`, `Context({ text? | url?, headers?, required?, maxBytes? })`.

The wire format is identical to the Python SDK's `conductor.ai.agents.plans`
dataclasses — same JSON shape, same field names, same `Ref` marker
(`{"$ref": "step_id"}`). The server compiler is the same path for both SDKs.

For planner reference material, set `plannerContext: [...]` on the agent (strings
or `Context` instances; URLs are fetched at runtime, with no recompile).

## Skills

`skill(path, options?)` loads a `SKILL.md` directory as an `Agent`;
`loadSkills(dir)` loads every skill subdirectory keyed by name. Skills run via
the same `run()` path and compose with `agentTool`.

```ts
import { skill, loadSkills, agentTool, Agent } from '@io-orkes/conductor-javascript/agents';

const reviewer = skill('./skills/code-review', { model: 'openai/gpt-4o' });
const all = loadSkills('./skills');          // Record<string, Agent>

const orchestrator = new Agent({
  name: 'lead',
  model: 'anthropic/claude-sonnet-4-6',
  instructions: 'Delegate reviews to the code-review skill.',
  tools: [agentTool(reviewer)],
});
```

## Next steps

[termination](termination.md) — stop a multi-agent loop ·
[deploy · serve · run · plan](deploy-serve-run.md) ·
[client reference](../reference/client.md) — aggregate token usage
