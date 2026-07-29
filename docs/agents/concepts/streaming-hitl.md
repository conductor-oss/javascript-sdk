# Streaming and human-in-the-loop

**Audience:** developers streaming Conductor-agent progress and gating actions on
human approval.

## Prerequisites

A working agent. Streaming needs `streamingEnabled` (default `true`, env
`CONDUCTOR_AGENT_STREAMING_ENABLED`) and a server that supports SSE for the
route; the SDK falls back to polling when it doesn't.

**Security note:** approval gates are the control that keeps model output from
taking destructive action unreviewed. Set `approvalRequired: true` on any tool
that deletes, pays, sends, or escalates privilege — and make sure whoever calls
`approve()` can actually see what they're approving.

## Streaming

`runtime.stream(agent, prompt)` returns an `AgentStream` you can `for await`
over. Events carry a `type`: `'thinking'`, `'tool_call'`, `'tool_result'`,
`'waiting'`, `'handoff'`, `'message'`, `'done'`, and others.

```ts
const stream = await runtime.stream(agent, 'Plan a 3-day trip to Tokyo.');
for await (const event of stream) {
  if (event.type === 'thinking')          console.log('[thinking]', event.content);
  else if (event.type === 'tool_call')    console.log('[tool]', event.toolName, event.args);
  else if (event.type === 'tool_result')  console.log('[result]', event.toolName, event.result);
  else if (event.type === 'done')         console.log('[done]', event.output);
}
const result = await stream.getResult();   // terminal AgentResult after the stream ends
```

**Expected result:** events arrive incrementally, ending with `'done'`.
`getResult()` then resolves immediately with the terminal `AgentResult`.

**Common failure mode:** no events, then a single `'done'`. That means SSE was
unavailable and the run fell back to polling — functionally correct, but you lose
incremental output. `SSEUnavailableError` and `SSETimeoutError` surface the
explicit cases.

You can also `runtime.start(...)` and call `handle.stream()`.

## Human-in-the-loop

A tool with `approvalRequired: true`, or a `humanTool`, pauses execution and emits
a `'waiting'` event. Resolve it via the handle or stream: `approve(output?)`,
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

    await handle.approve();              // approve, or:
    // await handle.reject('Not allowed');
    // await handle.respond({ approved: true, note: 'go ahead' });
  } else if (event.type === 'done') {
    console.log('done', event.output);
  }
}
```

**One HUMAN task gates the whole batch** of pending tool calls with a single
`{ approved, reason }` verdict. Iterate `pendingTool.toolCalls` to see every tool
that verdict covers — approving one approves all of them. The `pendingTool` is
mirrored onto the `waiting` event so you can read it without a `getStatus()`
round-trip.

`humanTool` works the same way but lets the model ask a structured question; the
response schema is on `pendingTool.response_schema`.

**Common failure mode:** a run that waits forever. Nothing resolved the pending
approval — a `'waiting'` event with no corresponding `approve()`/`reject()` will
sit until the task times out.

## Cleanup

Break out of the `for await` when you're done, then `runtime.shutdown()`.
Abandoning a handle without resolving a pending approval leaves the execution
waiting server-side; `handle.stop()` terminates it.

## Next steps

[tools](tools.md) · [callbacks](callbacks.md) ·
[client reference](../reference/client.md)
