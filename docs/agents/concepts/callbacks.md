# Callbacks

**Audience:** developers observing the Conductor-agent lifecycle.

## Prerequisites

A working agent and a process that polls workers — each callback hook runs as a
server-registered worker, so callbacks require `runtime.run()` or a live
`serve()`, not the control-plane client.

**Security note:** callbacks receive prompts, tool arguments, and model output.
Anything you log from a hook inherits the sensitivity of that data; don't ship
raw hook payloads to an external sink without redaction.

## Handlers

Subclass `CallbackHandler` and override the hooks you care about.

```ts
import { CallbackHandler } from '@io-orkes/conductor-javascript/agents';

class Logger extends CallbackHandler {
  async onAgentStart(agentName: string, prompt: string) { console.log('[start]', agentName, prompt); }
  async onToolStart(agentName: string, toolName: string, args: unknown) { console.log('[tool]', toolName, args); }
  async onAgentEnd(agentName: string, result: unknown) { console.log('[end]', agentName); }
}

const agent = new Agent({ name: 'a', model, instructions: '…', callbacks: [new Logger()] });
```

Hooks: `onAgentStart`, `onAgentEnd`, `onModelStart`, `onModelEnd`, `onToolStart`,
`onToolEnd`.

**Expected result:** hook output appears on stdout as the run progresses, before
the final `AgentResult`.

**Common failure modes:** silent hooks mean no worker is polling. A hook that
throws fails its task — treat hooks as observation, keep them side-effect-light,
and don't let a logging failure take down a run.

## Callbacks vs streaming

Callbacks are push-based server-side hooks; streaming is a pull-based event feed
in your process. Use callbacks for durable side effects that should happen
wherever the agent runs; use [streaming](streaming-hitl.md) to drive a UI or CLI
in the calling process.

## Next steps

[streaming & HITL](streaming-hitl.md) · [../../observability.md](../../observability.md)
