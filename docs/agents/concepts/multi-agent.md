# Multi-agent composition

Set `agents: [...]` and a `strategy`. Strategies: `'sequential'`, `'parallel'`,
`'handoff'`, `'router'`, `'round_robin'`, `'random'`, `'swarm'`, `'manual'`,
`'plan_execute'`. `'plan_execute'` runs a planner sub-agent that compiles a
typed, inspectable `Plan` into a durable sub-workflow instead of delegating
turn-by-turn — see [deploy/serve/run/plan](deploy-serve-run.md#plans--plan_execute)
for the planner/fallback setup and the `Plan`/`Step`/`Op` builders.

```ts
// Sequential — agents run in order. .pipe() is sugar for strategy: 'sequential'.
const pipeline = writer.pipe(editor);
// equivalent to:
// new Agent({ name: 'writer_editor', agents: [writer, editor], strategy: 'sequential' });

// Parallel — agents run concurrently, results gathered
const team = new Agent({ name: 'research_team', agents: [webResearcher, dataAnalyst], strategy: 'parallel' });

// Handoff — the parent LLM delegates to sub-agents (they appear as callable tools)
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
  router: routerAgent,   // an Agent or (…) => string returning a sub-agent name
});
```

`scatterGather({ name, workers, ... })` is a convenience builder that returns a
coordinator agent which fans a problem out to worker agents in parallel and
synthesizes the results:

```ts
import { scatterGather } from '@io-orkes/conductor-javascript/agents';
const coordinator = scatterGather({ name: 'fanout', workers: [worker], retryCount: 2 });
```

## Handoffs

For `swarm`/`handoff` strategies you can declare explicit handoff transitions
with `handoffs: [...]`. Each condition has a `target` (a sub-agent name).

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

    // Hand off when a specific tool returns (optionally only if result contains text)
    new OnToolResult({ target: 'escalation', toolName: 'detect_severity', resultContains: 'critical' }),

    // Hand off when a custom predicate returns true (runs as a worker task)
    new OnCondition({ target: 'fallback', condition: (ctx) => ctx.result.length > 1000 }),
  ],
});
```

You can also constrain which transitions are allowed with
`allowedTransitions: { agentName: ['otherAgent', ...] }`.

## Expected result and failures

Every child of `agents: [...]` is a durable sub-workflow, visible in
execution history on its own. Set a termination condition and a `maxTurns`
limit for every open-ended design (`handoff`/`router`/`swarm`) — an
unrestricted graph that loops has no other backstop. Use
`allowedTransitions` to restrict which specialists a handoff/swarm can reach,
so an unexpected model output can't route to an unsafe agent.

## Next steps

Use [termination](termination.md) to bound multi-agent loops (e.g.
`round_robin` debates), [stateful agents](stateful.md) for shared
per-execution state, [guardrails](guardrails.md) for per-agent/per-tool
validation, and the [handoffs reference](../reference/api.md#handoffs) for the
full condition-class list.
