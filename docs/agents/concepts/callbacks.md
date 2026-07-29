# Callbacks

Subclass `CallbackHandler` and override the lifecycle hooks you care about.
Each hook runs as a server-registered worker.

```ts
import { CallbackHandler } from '@io-orkes/conductor-javascript/agents';

class Logger extends CallbackHandler {
  async onAgentStart(agentName: string, prompt: string) { console.log('[start]', agentName, prompt); }
  async onToolStart(agentName: string, toolName: string, args: unknown) { console.log('[tool]', toolName, args); }
  async onAgentEnd(agentName: string, result: unknown) { console.log('[end]', agentName); }
}

const agent = new Agent({ name: 'a', model, instructions: '…', callbacks: [new Logger()] });
```

Hooks: `onAgentStart`, `onAgentEnd`, `onModelStart`, `onModelEnd`,
`onToolStart`, `onToolEnd`.

## Expected behavior and failures

Keep callback work fast and non-blocking — move durable business effects
(writes, notifications, audit records) into a `tool()` or a workflow task
instead. Callbacks observe lifecycle events without changing the durable
workflow unless they explicitly throw; don't rely on them as the sole record
of an audit or external write, since a process restart can interrupt a local
observer mid-callback. Treat callback payloads (messages, tool args/results)
as potentially sensitive execution data — redact credentials before logging.

## Next steps

Use [streaming](streaming-hitl.md) for caller-visible progress events and
[tools](tools.md) for durable side effects.
