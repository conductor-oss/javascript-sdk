# Conductor agents

**Audience:** TypeScript and JavaScript developers authoring durable,
LLM-backed Conductor agents.

Long-running, dynamic plan-execute, and event-driven agents that survive process
restarts because their state lives on the Conductor server, not in your process.

- **Package:** `@io-orkes/conductor-javascript` — agent symbols import from the
  `/agents` subpath
- **Runtime:** Node.js >= 18
- **Modules:** ESM and CommonJS

## Prerequisites

Install the SDK, have a reachable Conductor server with the agent runtime
enabled, and configure your LLM provider on that server. Keep provider
credentials out of source and workflow input — see [security.md](../security.md).

```bash
npm install @io-orkes/conductor-javascript
export CONDUCTOR_AGENT_SERVER_URL=http://localhost:8080/api
export CONDUCTOR_AGENT_LLM_MODEL=openai/gpt-4o-mini
```

The server needs the agent runtime: conductor-oss `>= 3.32.0-rc.8`, or
orkes-conductor booted with `agentspan.embedded=true`. LLM provider API keys go
to the **server** process, not your application.

## Quickstart

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

```bash
npx tsx my-agent.ts
```

**Expected result:** a formatted summary on stdout with `status=COMPLETED` and
the model's greeting. That is the whole loop — define an `Agent`, create an
`AgentRuntime`, `await runtime.run(...)`, read the `AgentResult`.
`shutdown()` stops local tool-worker polling so the process can exit.

**Common failure modes:** a connection error means `CONDUCTOR_AGENT_SERVER_URL`
is wrong or the server is down. A completed run with an error in the output
usually means the model isn't configured on the server. A process that hangs on
exit means `shutdown()` wasn't reached — always use `try`/`finally`.

## Concepts

| Goal | Guide | Expected result |
|---|---|---|
| Define an agent and its instructions | [agents](concepts/agents.md) | An agent that answers with your system prompt applied. |
| Give an agent tools | [tools](concepts/tools.md) | The model calls your function and uses the result. |
| Coordinate several agents | [multi-agent](concepts/multi-agent.md) | A team runs sequentially, in parallel, or by delegation. |
| Validate input and output | [guardrails](concepts/guardrails.md) | Unsafe content is blocked, retried, or fixed. |
| Stop a loop deliberately | [termination](concepts/termination.md) | A multi-turn run ends on your condition. |
| Observe the lifecycle | [callbacks](concepts/callbacks.md) | Lifecycle hooks fire as the agent progresses. |
| Stream tokens, pause for a human | [streaming & HITL](concepts/streaming-hitl.md) | Events arrive incrementally; approvals gate tools. |
| Get typed data back | [structured output](concepts/structured-output.md) | `result.output.result` conforms to your schema. |
| Run on a cron | [scheduling](concepts/scheduling.md) | The agent runs unattended on a schedule. |
| Share state across tool calls | [stateful](concepts/stateful.md) | Tools in one run see each other's mutations. |
| Ship it | [deploy · serve · run · plan](concepts/deploy-serve-run.md) | Registration and execution are separated correctly. |

## Frameworks

Already have an agent written for another framework? Pass it to the same
`runtime.run(...)` — the runtime detects and serializes it.

[OpenAI Agents SDK](frameworks/openai.md) ·
[Google ADK](frameworks/google-adk.md) ·
[LangChain](frameworks/langchain.md) ·
[LangGraph](frameworks/langgraph.md) ·
[Vercel AI SDK](frameworks/vercel-ai.md)

## Reference

[API map](reference/api.md) ·
[AgentRuntime](reference/runtime.md) ·
[AgentClient](reference/client.md) ·
[Agent definition fields](reference/agent-definition.md) ·
[Agent configuration contract](reference/agent-schema.md)

## Next steps

Read [concepts/agents.md](concepts/agents.md), then
[concepts/tools.md](concepts/tools.md). For the non-agent SDK — workflows,
workers, schedules — start at [../README.md](../README.md).
