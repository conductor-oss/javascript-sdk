# Workflow lifecycle and versioning

Register a versioned workflow, start it through `WorkflowExecutor`, and
inspect its execution before changing behavior. Additive output changes are
normally safe; renamed inputs, removed outputs, and changed task references
are breaking and require a new workflow version.

```typescript
const workflowId = await executor.startWorkflow({ name: "order_flow", input: { orderId: "ORDER-123" } });

await executor.pause(workflowId);
await executor.resume(workflowId);
await executor.retry(workflowId);
await executor.terminate(workflowId, "cancelled by user");
await executor.restart(workflowId);
await executor.signal(workflowId, TaskResultStatusEnum.COMPLETED, { approved: true });

const results = await executor.search("workflowType = 'order_flow' AND status = 'RUNNING'");
```

Use pause/resume for controlled maintenance, retry only transient failures,
and terminate executions with an explicit reason. Inspect failed tasks
(`getTask`/`search` — [task-client.md](api-reference/task-client.md)) before
retrying to avoid replaying unsafe side effects.

See [workflow-executor.md](api-reference/workflow-executor.md) for the
complete lifecycle API and [workflow-ops.ts](../examples/workflow-ops.ts) for
a runnable example covering all operations above.
