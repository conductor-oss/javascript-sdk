# Advanced

Runtime configuration, the control-plane and workflow clients, the deploy/serve/run/plan lifecycle, structured output, credentials, plans (PLAN_EXECUTE), and skills.

## Runtime configuration

`new AgentRuntime(configuration?, settings?)` takes two independent, optional arguments:

- `configuration` — connection/auth, the same shape every other Conductor client takes (`OrkesApiConfig`, or a pre-built `ConductorClient` from `createConductorClient()`/`OrkesClients` to share one client — and one token mint — across control-plane and worker-plane calls). Falls back to `CONDUCTOR_SERVER_URL`/`CONDUCTOR_AUTH_KEY`/`CONDUCTOR_AUTH_SECRET`, then `AGENTSPAN_SERVER_URL`/`AGENTSPAN_AUTH_KEY`/`AGENTSPAN_AUTH_SECRET` (agent-layer fallback), then `http://localhost:8080`.
- `settings` — `AgentConfigOptions`, purely behavioral (no connection fields — those live on `configuration` now). Every field falls back to an env var, then a default; explicit values take precedence.

```ts
import { AgentRuntime } from '@io-orkes/conductor-javascript/agents';

const runtime = new AgentRuntime(
  { serverUrl: 'http://localhost:8080/api', keyId: '…', keySecret: '…' }, // connection (OrkesApiConfig)
  {
    workerPollIntervalMs: 100,              // AGENTSPAN_WORKER_POLL_INTERVAL
    workerThreadCount: 1,                   // AGENTSPAN_WORKER_THREADS
    streamingEnabled: true,                 // AGENTSPAN_STREAMING_ENABLED
    livenessEnabled: true,                  // AGENTSPAN_LIVENESS_ENABLED
    livenessStallSeconds: 30,               // AGENTSPAN_LIVENESS_STALL_SECONDS
    livenessCheckIntervalSeconds: 10,       // AGENTSPAN_LIVENESS_CHECK_INTERVAL_SECONDS
  },
);

// Both args are optional -- this reads connection + behavior entirely from env:
const defaultRuntime = new AgentRuntime();
```

Full `AgentConfigOptions`: `workerPollIntervalMs`, `workerThreadCount`, `autoStartWorkers`, `streamingEnabled`, `livenessEnabled`, `livenessStallSeconds`, `livenessCheckIntervalSeconds` (see [Liveness monitoring](writing-agents.md#liveness-monitoring)).

There is also a module-level singleton API for convenience — `configure(configuration?, settings?)`, `run`, `start`, `stream`, `deploy`, `plan`, `serve`, `shutdown` — that operate on a shared runtime:

```ts
import { configure, run, shutdown } from '@io-orkes/conductor-javascript/agents';
configure({ serverUrl: 'http://localhost:8080/api' });
const result = await run(agent, 'hi');
await shutdown();
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

`serve()` already deploys, so a standalone `deploy()` call beforehand is optional — only worth doing when you want registration decoupled from worker start-up (e.g. a dedicated CI/CD step). The typical production split: run a `serve` process for the tool workers (it registers on the server for you), and trigger executions via the control plane (`runtime.client.run(...)`) or schedules.

```ts
// Long-lived worker process -- deploys + registers workers + starts polling
await runtime.serve(myAgent);   // blocks

// Trigger (control plane, no local workers needed for LLM-only / remote-tool agents)
const result = await runtime.client.run(myAgent, 'do the thing');
```

## `AgentClient` — control plane

`runtime.client` is an [`AgentClient`](api-reference.md#agentclient): the control-plane client for the `/agent/*` HTTP surface. `OrkesAgentClient` is the Conductor/Orkes implementation; obtain one directly via `OrkesClients.getAgentClient()`, or use `runtime.client`, which shares the same underlying Conductor client (and its single token mint) as the runtime's worker plane — no bespoke auth/transport lives behind this interface.

**Control-plane only:** `AgentClient.run/start` compile + start an agent and poll, but do **not** register or poll local tool workers. Use it for LLM-only agents, agents whose tools are remote (HTTP/MCP), or pre-deployed workflows. For agents with local `tool()` functions, use `runtime.run()` instead.

```ts
const client = runtime.client;   // or: orkesClients.getAgentClient()

// Compile + start + poll to result
const result = await client.run(agent, 'summarize this', { timeoutSeconds: 120 });

// Start and interact via a ClientHandle
const handle = await client.start(agent, 'do work');
const status = await handle.getStatus();
const final  = await handle.wait();       // deadline: timeoutSeconds + 30s, or 10 min default
await handle.approve();          // / reject(reason) / send(message) / respond(body)
await handle.stop();             // stop the execution

// Compile + register one or more agents (no execution)
const infos = await client.deploy(agentA, agentB);   // DeploymentInfo[]

// Deploy + reconcile cron schedules in one call
import { Schedule } from '@io-orkes/conductor-javascript/agents';
await client.schedule(agent, [new Schedule({ name: 'nightly', cron: '0 0 0 * * *' })]);
```

Low-level endpoints are available too: `startAgent`, `deployAgent`, `compile`, `status`, `respond`, `getExecution`, `stream`. The `client.schedules` accessor is the SDK `SchedulerClient` (shared with `OrkesClients.getSchedulerClient()`); `client.workflows` is a `WorkflowClient` (below).

## `WorkflowClient` — execution reads

`runtime.workflows` (also `runtime.client.workflows`) is a read-only [`WorkflowClient`](api-reference.md#workflowclient) over the underlying Conductor workflow API.

```ts
const wf = await runtime.workflows.getWorkflow(executionId);          // full execution (with tasks)
const status = await runtime.workflows.getStatus(executionId);        // 'RUNNING' | 'COMPLETED' | ...
const usage  = await runtime.workflows.extractTokenUsage(executionId);// aggregated across sub-workflows
// usage -> { promptTokens, completionTokens, totalTokens } | null
```

`extractTokenUsage` walks the execution tree (recursing into `SUB_WORKFLOW` tasks) and sums token usage — useful for multi-agent runs where tokens are spread across sub-workflows. Note: `result.tokenUsage` is already populated for you on a normal `run()`; this is for inspecting an execution by id after the fact.

## Structured output

Set `outputType` to a JSON Schema object (or a Zod schema — it is converted to JSON Schema). The model returns data conforming to the schema; the structured object lands under `result.output.result`.

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

## Credentials and secrets

Pass credential names with `credentials: [...]` at the agent level and/or per tool. The server resolves secrets when it polls each task and delivers them **wire-only**, on that task's `runtimeMetadata` — never persisted, never fetched by the worker separately. The SDK injects them into the worker's `process.env` for the duration of the call (mutate-invoke-restore, serialized so concurrent calls don't clobber each other's env). For HTTP/MCP tools, reference them inline in headers with `${NAME}` substitution.

**Fail-closed, no fallback:** if a tool declares `credentials: [...]` and the server didn't deliver one of them on `runtimeMetadata` (e.g. an older server that predates `TaskDef.runtimeMetadata` support — conductor-oss PR #1255 / agentspan server > 0.4.2), the task fails with a non-retryable error naming the missing credential. There is no ambient-env fallback to silently read a locally-set variable instead.

```ts
import { Agent, tool, httpTool, getCredential } from '@io-orkes/conductor-javascript/agents';

// A worker tool: the secret is injected into the worker's process.env for the call
const dbLookup = tool(
  async (args: { query: string }) => {
    const key = process.env.DB_API_KEY ?? '';
    return { ok: key !== '' };
  },
  {
    name: 'db_lookup',
    description: 'Look up data.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    credentials: ['DB_API_KEY'],
  },
);

// Or fetch a credential explicitly inside a tool
const analytics = tool(
  async (args: { topic: string }) => {
    const key = await getCredential('ANALYTICS_KEY');
    return { topic: args.topic, ok: !!key };
  },
  { name: 'analytics', description: 'Query analytics.', inputSchema: {
    type: 'object', properties: { topic: { type: 'string' } }, required: ['topic'],
  }, credentials: ['ANALYTICS_KEY'] },
);

// HTTP tool with ${CRED} header substitution
const searchApi = httpTool({
  name: 'search_api',
  description: 'Search.',
  url: 'https://api.example.com/search',
  headers: { Authorization: 'Bearer ${SEARCH_API_KEY}' },
  credentials: ['SEARCH_API_KEY'],
});

const agent = new Agent({
  name: 'credentialed_agent',
  model: 'anthropic/claude-sonnet-4-6',
  instructions: '…',
  tools: [dbLookup, analytics, searchApi],
  credentials: ['DB_API_KEY', 'ANALYTICS_KEY', 'SEARCH_API_KEY'],
});
```

You can also pass `credentials` at call time: `runtime.run(agent, prompt, { credentials: ['X'] })`.

## RunSettings — per-run LLM overrides

`RunOptions.runSettings` overrides the LLM call for a single `run`/`start`/`stream`, without touching the agent's own config. Only set fields override; unset fields keep the agent's own serialized values, and the override doesn't cascade to sub-agents (each keeps its own settings).

```ts
import type { RunSettings } from '@io-orkes/conductor-javascript/agents';

const result = await runtime.run(agent, prompt, {
  runSettings: {
    model: 'anthropic/claude-sonnet-4-6', // overrides agent.model for this run
    temperature: 0.2,
    maxTokens: 4096,
    reasoningEffort: 'high',
    thinkingBudgetTokens: 8000,           // maps to the wire thinkingConfig shape
  },
});

// RunOptions.model is sugar for runSettings.model -- an explicit runSettings.model wins:
await runtime.run(agent, prompt, { model: 'openai/gpt-4o-mini' });
```

## Plans / PLAN_EXECUTE

`strategy: 'plan_execute'` runs a planner sub-agent to produce a JSON plan, then executes it deterministically as a sub-workflow. You **must** provide a `planner` agent (and may provide a `fallback`):

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

You can also supply a **deterministic static plan** with the typed builders and pass it via `RunOptions.plan` — it wins over the planner's output (the planner still runs, but its output is discarded):

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

Builders: `Plan({ steps, validation?, onSuccess?, onFailure? })`, `Step(id, { operations?, dependsOn?, parallel? })`, `Op(tool, { args? | generate? })`, `Generate({ instructions, outputSchema, maxTokens?, context? })`, `Validation(tool, { args?, successCondition? })`, `Action(tool, { args? })`, `Ref(stepId)`, `Context({ text? | url?, headers?, required?, maxBytes? })`.

For planner reference docs, set `plannerContext: [...]` on the agent (strings or `Context` instances; URLs are fetched at runtime, no recompile).

## Skills

`skill(path, options?)` loads a `SKILL.md` skill directory as an `Agent`; `loadSkills(dir)` loads every skill subdirectory keyed by name. Skills are framework agents (`_framework: "skill"`) and run via the same `run()` path; they can be wrapped with `agentTool` and used inside other agents.

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

## See also

- [api-reference.md](api-reference.md) — the full public surface.
- [writing-agents.md](writing-agents.md) — schedules, HITL, guardrails, callbacks.
