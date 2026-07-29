# Workflow lifecycle

**Audience:** developers starting, inspecting, and controlling workflow
executions.

## Prerequisites

A registered workflow ([workflows.md](workflows.md)) and a workflow client.

```ts
const executor = clients.getWorkflowClient();
```

## Starting

```ts
// Async — returns the execution id immediately
const workflowId = await executor.startWorkflow({
  name: "order_flow",
  input: { orderId: "ORDER-123" },
});

// Sync — waits for completion
const result = await workflow.execute({ orderId: "123" });
```

**Expected result:** `startWorkflow` gives you an id to poll or correlate;
`execute` gives you the finished run.

Use `startWorkflow` for anything that might outlive the calling process — a sync
`execute` ties completion to your process staying alive.

## Controlling

```ts
await executor.pause(workflowId);
await executor.resume(workflowId);
await executor.terminate(workflowId, "cancelled by user");
await executor.restart(workflowId);
await executor.retry(workflowId);
```

| Operation | Effect |
|---|---|
| `pause` | Stops scheduling new tasks. In-flight tasks finish. |
| `resume` | Resumes scheduling. |
| `terminate` | Ends the execution as `TERMINATED`. Not resumable. |
| `restart` | Starts over from the beginning, same input. |
| `retry` | Retries from the last failed task, keeping completed work. |

`retry` is what you usually want after a transient failure; `restart` discards
completed work.

## Signalling a WAIT task

```ts
await executor.signal(workflowId, TaskResultStatusEnum.COMPLETED, { approved: true });
```

## Reading

```ts
const results = await executor.search("workflowType = 'order_flow' AND status = 'RUNNING'");
```

`getWorkflow()` and `getExecution()` are **not** interchangeable — they hit
different endpoints and return different shapes. Reach for `getExecution()` when
you need full task-level detail.

## Common failure modes

- **`terminate` on an already-terminal execution** fails rather than no-opping.
  Check status first if that path is reachable.
- **`retry` with no failed task** has nothing to retry.
- **A search returning nothing** — search is index-backed and eventually
  consistent; a just-started execution may not appear immediately.

## Cleanup

Terminated and completed executions are retained per your server's retention
policy. Terminate long-running test executions rather than leaving them to time
out.

## Next steps

[workers.md](workers.md) · [debugging.md](debugging.md) ·
[reliability.md](reliability.md)
