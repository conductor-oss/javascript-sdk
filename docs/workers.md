# Workers

Workers are TypeScript functions that poll a named task queue, execute
idempotent business logic, and return a result. Decorate a function (or class
method) with `@worker` and run it with `TaskHandler`.

```typescript
import { worker, TaskHandler } from "@io-orkes/conductor-javascript";
import type { Task } from "@io-orkes/conductor-javascript";

@worker({ taskDefName: "greet", concurrency: 5 })
async function greet(task: Task) {
  return { status: "COMPLETED" as const, outputData: { result: `Hello ${task.inputData.name}` } };
}

const handler = new TaskHandler({ client, scanForDecorated: true });
await handler.startWorkers();
```

Throw `NonRetryableException` for terminal failures (`FAILED_WITH_TERMINAL_ERROR`);
a plain `Error` retries. Use `domain` for multi-tenant task isolation and
`CONDUCTOR_WORKER_*`/`CONDUCTOR_WORKER_<TASK>_*` env vars to tune polling
without code changes. Stop task handlers (`handler.stopWorkers()`) on process
shutdown so in-flight tasks are redelivered instead of abandoned.

See the root [README's Workers section](../README.md#workers) for both
decorator styles, `TaskContext` for long-running tasks, and event listeners;
[task-manager.md](api-reference/task-manager.md) and
[task-client.md](api-reference/task-client.md) for the full client API. Next:
[reliability](reliability.md) and [workflow testing](workflow-testing.md).
