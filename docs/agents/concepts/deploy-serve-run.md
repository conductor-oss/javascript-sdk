# Deploy · Serve · Run · Plan

`new AgentRuntime(configuration?, settings?)` takes two independent, optional
arguments — `configuration` (connection/auth, same shape as every other
Conductor client) and `settings` (behavior-only: worker/streaming/liveness
tuning). Both fall back to env vars, then defaults; see the
[runtime reference](../reference/runtime.md) for the full option list.

```ts
import { AgentRuntime } from '@io-orkes/conductor-javascript/agents';

const runtime = new AgentRuntime();   // reads connection + behavior entirely from env
```

## deploy vs serve vs run vs plan

| Method | What it does | Local workers? |
|---|---|---|
| `runtime.run(agent, prompt, opts?)` | Compile + start + stream + return an `AgentResult`. | Yes — registers and polls local `tool()` workers for the run. |
| `runtime.start(agent, prompt, opts?)` | Same as `run` but returns an `AgentHandle` for async interaction (stream, approve, pause, ...). | Yes. |
| `runtime.stream(agent, prompt, opts?)` | `start` + return its `AgentStream`. | Yes. |
| `runtime.deploy(agent, { schedules? })` | Compile + register the workflow definition on the server. No execution, no workers. CI/CD step. Returns `DeploymentInfo`. | No. |
| `runtime.deploy(...agents)` | Variadic form: compile + register multiple agents in one call, no schedules reconciliation. Returns `DeploymentInfo[]`. | No. |
| `runtime.serve(...agents, { blocking? })` | Deploys the given agents (same registration as `deploy`), registers their local tool workers, and starts polling. Blocks until SIGINT/SIGTERM by default; pass a trailing `{ blocking: false }` to return once deploy + registration + polling have started. With no agents, just (re)starts polling for workers already registered. | Yes (and keeps them alive when blocking). |
| `runtime.plan(agent)` | Compile to a workflow definition and return it, without executing. | No. |
| `runtime.shutdown()` | Stop worker polling. | — |

`serve()` already deploys, so a standalone `deploy()` call beforehand is
optional — only worth doing when you want registration decoupled from worker
start-up (e.g. a dedicated CI/CD step).

## Production pattern

Compile/register with `deploy()` during a release step (or let `serve()` do
it), then run one or more long-lived `serve()` worker processes for the tool
workers. Trigger executions via the control plane
(`runtime.client.run(...)`/`start(...)`) or schedules — not by calling
`run()` from inside the worker process itself. Use `plan()` in CI to inspect
the compiled workflow definition before it's deployed.

```ts
// Long-lived worker process -- deploys + registers workers + starts polling
await runtime.serve(myAgent);   // blocks

// Trigger (control plane, no local workers needed for LLM-only / remote-tool agents)
const result = await runtime.client.run(myAgent, 'do the thing');
```

Always call `shutdown()` (or dispose cleanly) for short-lived scripts so
worker polling actually stops; a long-lived `serve()` process is expected to
run until `SIGINT`/`SIGTERM`.

### Recovering after a worker process restart

There's no execution-scoped reattach call (no `resume(executionId)`).
Recovery is process-level: start a fresh `serve()` with no agents in the
replacement process — it resumes polling for whatever tool workers are
already registered on the server, covering every affected execution's domain
at once. See [stateful agents](stateful.md#recovering-after-a-worker-process-restart)
for how `WorkerStallError`/liveness monitoring surfaces the need to do this.

## Plans / PLAN_EXECUTE

`strategy: 'plan_execute'` runs a planner sub-agent to produce a JSON plan,
then executes it deterministically as a sub-workflow. You **must** provide a
`planner` agent (and may provide a `fallback`):

```ts
const harness = new Agent({
  name: 'plan_harness',
  model: 'openai/gpt-4o',
  strategy: 'plan_execute',
  planner: plannerAgent,     // required — produces the JSON plan
  fallback: agenticAgent,    // optional — runs agentically if the plan can't compile/run
  tools: [/* tools the plan steps call */],
});
const result = await runtime.run(harness, 'Build a release report.');
```

You can also supply a **deterministic static plan** with the typed builders
and pass it via `RunOptions.plan` — it wins over the planner's output (the
planner still runs, but its output is discarded):

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
`Step(id, { operations?, dependsOn?, parallel? })`, `Op(tool, { args? |
generate? })`, `Generate({ instructions, outputSchema, maxTokens?, context?
})`, `Validation(tool, { args?, successCondition? })`, `Action(tool, {
args? })`, `Ref(stepId)`, `Context({ text? | url?, headers?, required?,
maxBytes? })`.

For planner reference docs, set `plannerContext: [...]` on the agent
(strings or `Context` instances; URLs are fetched at runtime, no recompile).

## Next steps

- [Runtime reference](../reference/runtime.md) — the full `AgentRuntime`/
  `AgentConfig` API.
- [Control plane](../reference/client.md) — `AgentClient`/`WorkflowClient`
  for callers without local tool workers.
- [Multi-agent](multi-agent.md) — the other composition strategies.
