# Workers

**Audience:** developers writing the code that executes Conductor tasks.

## Prerequisites

A client and a registered workflow ([core-quickstart.md](core-quickstart.md)).
Workers are TypeScript functions decorated with `@worker` and discovered by
`TaskHandler`.

## Decorator styles

The SDK supports both. Pick one per project.

**New (TypeScript 5.0+)** — class methods, Stage 3 decorators, no compiler flag:

```ts
import { worker, TaskHandler } from "@io-orkes/conductor-javascript";
import type { Task } from "@io-orkes/conductor-javascript";

class Workers {
  @worker({ taskDefName: "greet", concurrency: 5, pollInterval: 100 })
  async greet(task: Task) {
    return {
      status: "COMPLETED" as const,
      outputData: { result: `Hello ${task.inputData?.name ?? "World"}` },
    };
  }
}

// Instantiating triggers the decorators — workers register here
void new Workers();

const handler = new TaskHandler({ client, scanForDecorated: true });
await handler.startWorkers();
```

**Legacy** — standalone functions, needs `"experimentalDecorators": true`:

```ts
@worker({ taskDefName: "greet", concurrency: 5 })
async function greet(task: Task) {
  return { status: "COMPLETED" as const, outputData: { result: "Hello" } };
}
```

| Style | tsconfig.json |
|---|---|
| New (TS 5.0+) | Omit `experimentalDecorators`; use class methods |
| Legacy | `"experimentalDecorators": true`; use standalone functions |

**Common failure mode with the new style:** forgetting `void new Workers()`.
Decorators on class methods run when the class is *instantiated*, so without it
nothing registers and every task sits in `SCHEDULED`.

## Configuration

```ts
@worker({
  taskDefName: "my_task",   // required
  concurrency: 5,           // max concurrent tasks (default 1)
  pollInterval: 100,        // ms (default 100)
  domain: "production",     // task domain for multi-tenancy
  workerId: "worker-123",
})
```

Environment overrides need no code change:

```shell
# Global
export CONDUCTOR_WORKER_ALL_POLL_INTERVAL=500
export CONDUCTOR_WORKER_ALL_CONCURRENCY=10

# Per-worker (the task name, upper-cased)
export CONDUCTOR_WORKER_SEND_EMAIL_CONCURRENCY=20
export CONDUCTOR_WORKER_PROCESS_PAYMENT_DOMAIN=payments
```

## Failure semantics

```ts
import { NonRetryableException } from "@io-orkes/conductor-javascript";

@worker({ taskDefName: "validate_order" })
async function validateOrder(task: Task) {
  const order = await getOrder(task.inputData.orderId);
  if (!order) {
    throw new NonRetryableException("Order not found");
  }
  return { status: "COMPLETED", outputData: { validated: true } };
}
```

| Thrown | Task status | Retried? |
|---|---|---|
| `Error` | `FAILED` | Yes, per the task definition's retry policy |
| `NonRetryableException` | `FAILED_WITH_TERMINAL_ERROR` | No |

Use `NonRetryableException` for anything a retry cannot fix — bad input, a missing
record, a validation failure. Retrying those burns the retry budget and delays the
real failure.

## Long-running tasks

Return `IN_PROGRESS` with a callback interval to keep a task alive while something
external finishes:

```ts
import { worker, getTaskContext } from "@io-orkes/conductor-javascript";

@worker({ taskDefName: "process_video" })
async function processVideo(task: Task) {
  const ctx = getTaskContext();
  ctx?.addLog("Starting video processing...");

  if (!isComplete(task.inputData)) {
    ctx?.setCallbackAfter(30);
    return { status: "IN_PROGRESS", callbackAfterSeconds: 30 };
  }

  return { status: "COMPLETED", outputData: { url: "..." } };
}
```

`getTaskContext()` is backed by `AsyncLocalStorage`, so it works without threading
a parameter through. `ctx?.addLog()` streams logs into the Conductor UI.

For tasks that hold a lease while working, see
[reliability.md](reliability.md#lease-extension).

## Lifecycle

`startWorkers()` is **`async`** — it registers task definitions before polling
starts. Await it, or task-def registration races your first execution.

```ts
process.on("SIGTERM", async () => {
  await handler.stopWorkers();
  process.exit(0);
});
```

## Organizing across files

```ts
const handler = await TaskHandler.create({
  client,
  importModules: ["./workers/orderWorkers", "./workers/paymentWorkers"],
});
await handler.startWorkers();
```

## Observability

```ts
const handler = new TaskHandler({
  client,
  scanForDecorated: true,
  eventListeners: [{
    onTaskExecutionCompleted(event) {
      metrics.histogram("task_duration_ms", event.durationMs, { task_type: event.taskType });
    },
    onTaskUpdateFailure(event) {
      alertOps({ severity: "CRITICAL", taskId: event.taskId });
    },
  }],
});
```

`TaskHandler` monitors and restarts worker polling loops by default. Expose
`handler.running` and `handler.runningWorkerCount` as a health check. See
[observability.md](observability.md).

## Legacy API

`TaskManager` still works with full backward compatibility. New projects should
use `@worker` plus `TaskHandler`.

## Next steps

[reliability.md](reliability.md) · [deployment-scaling.md](deployment-scaling.md) ·
[observability.md](observability.md)
