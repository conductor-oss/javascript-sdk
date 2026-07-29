# Stateful agents

**Audience:** developers whose tools need to share mutable state within a single
Conductor-agent run.

## Prerequisites

An agent with local `tool()` functions. Stateful runs isolate tool workers per
execution via a unique domain UUID, so they require a polling process for the
life of the run.

## Sharing state across tool calls

Set `stateful: true` on the agent (or on a tool def). Within one run, tools share
a mutable `context.state` object; mutations are captured and propagated between
tool calls.

```ts
import type { ToolContext } from '@io-orkes/conductor-javascript/agents';

const addItem = tool(
  async (args: { item: string }, ctx?: ToolContext) => {
    const items: string[] = (ctx?.state?.list as string[]) ?? [];
    items.push(args.item);
    if (ctx?.state) ctx.state.list = items;
    return { total: items.length };
  },
  { name: 'add_item', description: 'Add an item.', inputSchema: {
    type: 'object', properties: { item: { type: 'string' } }, required: ['item'],
  }},
);

const agent = new Agent({ name: 'list_agent', model, tools: [addItem], stateful: true });
```

**Expected result:** across three `add_item` calls in one run, `total` returns 1,
2, 3. Two concurrent runs each start from an empty list.

**Common failure mode:** mutating a closure variable instead of `ctx.state`. It
appears to work for a single sequential run and corrupts silently under
concurrency — see [tools.md](tools.md#no-per-run-mutable-capture). `ctx.state` is
the only per-run store that is actually isolated.

## Liveness monitoring

A stateful run has a domain-isolated worker, so `runtime.start()`, `run()`, and
`stream()` also start a liveness monitor. It polls the execution's workflow every
`livenessCheckIntervalSeconds`; if a `SCHEDULED` or `IN_PROGRESS` task in that
run's domain sits unpolled (`pollCount === 0`) for longer than
`livenessStallSeconds`, a blocking `wait()` rejects with `WorkerStallError`
instead of hanging forever. That is the signal the local worker process for the
run's domain died.

The monitor stops on terminal status or handle disposal, and never keeps the
process alive on its own.

| Option | Env var | Default |
|---|---|---|
| `livenessEnabled` | `CONDUCTOR_AGENT_LIVENESS_ENABLED` | `true` |
| `livenessStallSeconds` | `CONDUCTOR_AGENT_LIVENESS_STALL_SECONDS` | `30` |
| `livenessCheckIntervalSeconds` | `CONDUCTOR_AGENT_LIVENESS_CHECK_INTERVAL_SECONDS` | `10` |

Framework-spawned agents (LangGraph, LangChain, Vercel AI wrappers) never route
through a per-run domain, so liveness monitoring does not apply to them.

## Cleanup

`runtime.shutdown()` stops the domain worker and the monitor. Because each
stateful run creates a domain-scoped worker, leaking runtimes leaks workers —
always shut down in a `finally`.

## Next steps

[tools](tools.md) · [../reference/runtime.md](../reference/runtime.md) ·
[../../reliability.md](../../reliability.md)
