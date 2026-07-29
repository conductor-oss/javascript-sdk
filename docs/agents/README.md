# Durable AI Agents — Documentation

The agent layer of the Conductor JavaScript SDK — long-running, dynamic
plan-execute, and event-driven AI agents.

- **Package:** `@io-orkes/conductor-javascript` — agent layer imported from
  the `/agents` subpath
- **Runtime:** Node.js >= 18
- **Module:** ESM and CommonJS (`import` / `require`)

## Start here

- [Getting started](getting-started.md) — install, env vars, and a running
  agent in under 30 seconds.
- [Deploy · Serve · Run · Plan](concepts/deploy-serve-run.md) — choose a
  runtime mode.
- [Scheduling](concepts/scheduling.md) — manage deployed-agent schedules.

## Build agents

- [Agents](concepts/agents.md), [tools](concepts/tools.md), and
  [multi-agent](concepts/multi-agent.md)
- [Guardrails](concepts/guardrails.md),
  [termination](concepts/termination.md), [callbacks](concepts/callbacks.md)
- [Stateful agents](concepts/stateful.md) (including memory and liveness
  monitoring), [streaming and HITL](concepts/streaming-hitl.md), and
  [structured output](concepts/structured-output.md)

## Framework bridges

- [Google ADK](frameworks/google-adk.md), [LangChain](frameworks/langchain.md),
  and [LangGraph](frameworks/langgraph.md)
- [OpenAI Agents SDK](frameworks/openai.md) and
  [Vercel AI SDK](frameworks/vercel-ai.md) (JS/Node-ecosystem-specific — no
  Java/Python counterpart)

You don't have to rewrite an agent authored with another framework to run it
on Conductor. `runtime.run()`/`deploy()`/`stream()` **detects** the framework
object you pass in, serializes it to an agent config, and runs it on the
server — the identical call you'd make with a native `Agent`:

```ts
const runtime = new AgentRuntime();
const result = await runtime.run(frameworkAgent, prompt);   // <-- same entry point for every framework
```

Detection is pure duck-typing — no framework package is imported by the SDK,
and every framework's peer dependency is optional (install only what you
use). `detectFramework(agent)` returns the first match:

| Framework | Detected when the object has… |
|---|---|
| native `Agent` | is an instance of `Agent` (runs natively, not as a framework) |
| `langgraph` | `.invoke()` plus a graph shape (`.getGraph()`, a `.nodes` Map, or `.nodes` + `.builder`) |
| `langchain` | `.invoke()` plus an `lc_namespace` array (e.g. an `AgentExecutor`) |
| `openai` | `name` + string/function `instructions` + string `model` + `tools[]` + an OpenAI marker (`handoffs[]`, `inputGuardrails[]`, `asTool()`, `toolUseBehavior`, ...) |
| `google_adk` | `subAgents[]` (orchestration agents), or string `model` + ADK markers (`instruction`, `outputKey`, `generateContentConfig`, `beforeModelCallback`, ...) |

If nothing matches and the object isn't a native `Agent`, you get a clear
error. All five frameworks use the identical `runtime.run(agentOrGraph,
prompt)` entry point — there is no per-framework runtime API. Framework
agents can be deployed too: `runtime.deploy(frameworkAgent)`.

## Operate and inspect

- [Runtime reference](reference/runtime.md),
  [control-plane reference](reference/client.md), and
  [API map](reference/api.md)
- [Agent-definition fields](reference/agent-definition.md) and
  [configuration contract](reference/agent-schema.md)

## At a glance

```ts
import { Agent, AgentRuntime } from '@io-orkes/conductor-javascript/agents';

const agent = new Agent({
  name: 'greeter',
  model: 'anthropic/claude-sonnet-4-6',
  instructions: 'You are a friendly assistant. Keep responses brief.',
});

const runtime = new AgentRuntime();
try {
  const result = await runtime.run(agent, 'Say hello!');
  result.printResult();
} finally {
  await runtime.shutdown();
}
```

You need a running Conductor server (default `http://localhost:8080/api`).
See [getting-started.md](getting-started.md).
