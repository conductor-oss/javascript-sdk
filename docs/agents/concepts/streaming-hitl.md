# Streaming and human-in-the-loop (HITL)

## Streaming

`runtime.stream(agent, prompt)` returns an `AgentStream` you can `for await`
over. Events have a `type` (`'thinking'`, `'tool_call'`, `'tool_result'`,
`'waiting'`, `'handoff'`, `'message'`, `'done'`, ...). You can also
`runtime.start(...)` and call `handle.stream()`.

```ts
const stream = await runtime.stream(agent, 'Plan a 3-day trip to Tokyo.');
for await (const event of stream) {
  if (event.type === 'thinking')      console.log('[thinking]', event.content);
  else if (event.type === 'tool_call')   console.log('[tool]', event.toolName, event.args);
  else if (event.type === 'tool_result') console.log('[result]', event.toolName, event.result);
  else if (event.type === 'done')         console.log('[done]', event.output);
}
const result = await stream.getResult();   // terminal AgentResult after the stream ends
```

Don't treat streamed content as a final result until the terminal `'done'`
event (or `stream.getResult()`) arrives — an intermediate `'message'`/
`'thinking'` event can still be followed by a retry or guardrail-triggered
correction.

### SSE fallback

Streaming rides Server-Sent Events (SSE) by default. If the SSE connection
can't be established (a non-2xx response, or the connection drops without
delivering a byte), the stream falls through to status polling
automatically — no action needed from the caller, and no error surfaces for
this case specifically. A stream that repeatedly fails to reconnect mid-flight
retries with backoff before also falling back to polling.

## Human-in-the-loop (HITL)

A tool with `approvalRequired: true`, or a `humanTool`, pauses execution and
emits a `waiting` event. Resolve it via the handle / stream: `approve(output?)`,
`reject(reason?)`, `send(message)`, or `respond(body)`.

```ts
const deleteData = tool(
  async (args: { table: string }) => ({ deleted: args.table }),
  {
    name: 'delete_data',
    description: 'Delete a table. Destructive — requires approval.',
    inputSchema: { type: 'object', properties: { table: { type: 'string' } }, required: ['table'] },
    approvalRequired: true,
  },
);

const agent = new Agent({ name: 'ops', model, tools: [deleteData], instructions: '…' });

const handle = await runtime.start(agent, 'Delete the stale_cache table.');
for await (const event of handle.stream()) {
  if (event.type === 'waiting') {
    // The waiting event carries the pending tool batch on event.pendingTool,
    // or fetch the full status:
    const status = await handle.getStatus();
    console.log('Approval needed for:', status.pendingTool?.toolCalls);

    await handle.approve();            // approve, or:
    // await handle.reject('Not allowed');
    // await handle.respond({ approved: true, note: 'go ahead' });
  } else if (event.type === 'done') {
    console.log('done', event.output);
  }
}
```

One HUMAN task gates the whole batch of pending tool calls with a single
`{ approved, reason }` verdict — iterate `pendingTool.toolCalls` to see every
tool covered. The `pendingTool` is mirrored onto the `waiting` event so you
can read it without a `getStatus()` round-trip.

`humanTool` works the same way but lets the LLM ask the human a structured
question; the response schema is on `pendingTool.response_schema`.

### Approval pattern

Keep the `executionId` (or handle) around across the approval wait — the
pause is a durable Conductor task, not an in-memory continuation, so it
survives a process restart on your side as long as you can look the
execution back up. Resolve pauses through the handle/client control plane
rather than an in-memory web request continuation, and make approval actions
idempotent, since a caller (e.g. a webhook retry) may submit the same
approval twice.

## Next steps

See [tools](tools.md), [agent client](../reference/client.md), and
[callbacks](callbacks.md).
