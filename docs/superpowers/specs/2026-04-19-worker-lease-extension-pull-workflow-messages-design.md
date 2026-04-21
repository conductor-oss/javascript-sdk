# Design: Lease Extension & PullWorkflowMessages Task Builder

**Date:** 2026-04-19
**Scope:** Two features to close parity gaps between the JS SDK and Python SDK

---

## Background

The JS SDK worker framework is missing two capabilities present in the Python SDK:

1. **Lease extension (heartbeat)** — automatically keep a task's lease alive during long-running execution so the Conductor server does not consider it timed out and re-queue it.
2. **`PullWorkflowMessages` task builder** — a workflow task type for consuming messages from the workflow message queue (WMQ).

Both features follow the Python SDK 1:1 in semantics and defaults.

---

## Feature 1: Lease Extension

### Behavior

When `leaseExtendEnabled: true` is set on a worker and a polled task has `responseTimeoutSeconds > 0`, the `TaskRunner` will periodically send a heartbeat to the Conductor server to keep the task lease alive.

- **Heartbeat interval** = `responseTimeoutSeconds * LEASE_EXTEND_DURATION_FACTOR (0.8)`, expressed in milliseconds
- **Minimum interval guard**: if the computed interval is < 1000ms, do NOT track the task (matches Python guard: `if interval < 1: return`)
- **Retries per heartbeat** = `LEASE_EXTEND_RETRY_COUNT = 3` attempts with 500ms delay between retries (short delay matching Python's `0.5 * (attempt + 2)` scheme)
- If all 3 retry attempts fail, log the error but do NOT fail the task and do NOT remove from tracking
- When the task finishes (COMPLETED, FAILED, FAILED_WITH_TERMINAL_ERROR, or returns IN_PROGRESS), remove it from lease tracking

### Critical constraint

Heartbeats must fire even when **all concurrency slots are full** (i.e., the Poller is blocked from polling more tasks). This is achieved by using a `setInterval` timer inside `LeaseTracker` that runs independently on the Node.js event loop, decoupled from the polling cycle. Since worker `execute()` functions use async/await and yield the event loop, the interval callback fires normally even while all concurrency slots are occupied.

**`HEARTBEAT_CHECK_INTERVAL_MS = 100ms`** — matching the default poll interval, this minimises jitter. A 1000ms check interval would introduce up to 1s of latency beyond the intended heartbeat time, risking missed heartbeats for tasks with `responseTimeoutSeconds` as low as ~1.25s. At 100ms, the worst-case jitter is 100ms, allowing tasks with `responseTimeoutSeconds >= 1.25s` (interval >= 1000ms) to be safely tracked.

**Minimum supported `responseTimeoutSeconds`**: 1.25s (interval = 1000ms after the `< 1000ms` guard). Tasks with shorter timeouts are not tracked.

### Architecture

#### New file: `src/sdk/clients/worker/LeaseTracker.ts`

`LeaseTracker` is a self-contained class owning all lease management logic: the active leases map, the check interval, and the heartbeat send logic. This makes it independently testable.

```typescript
// Constants matching Python SDK (Java SDK source)
export const LEASE_EXTEND_RETRY_COUNT = 3;
export const LEASE_EXTEND_DURATION_FACTOR = 0.8;
const HEARTBEAT_CHECK_INTERVAL_MS = 100;
const HEARTBEAT_RETRY_DELAY_MS = 500;

export interface LeaseInfo {
  taskId: string;
  workflowInstanceId: string;
  responseTimeoutSeconds: number;
  lastHeartbeatTime: number;   // Date.now() at task start or last successful heartbeat
  intervalMs: number;          // responseTimeoutSeconds * 0.8 * 1000
}

export class LeaseTracker {
  private leases = new Map<string, LeaseInfo>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly sendHeartbeatFn: (taskId: string, workflowInstanceId: string) => Promise<void>,
    private readonly logger: ConductorLogger
  ) {}

  /** Track a task lease. No-op if computed interval < 1000ms. */
  track(task: Task): void

  /** Untrack a task (call immediately after worker.execute() resolves or throws). */
  untrack(taskId: string): void

  /** Start the heartbeat check interval. Call from TaskRunner.startPolling(). */
  start(): void

  /** Stop the heartbeat check interval. Call from TaskRunner.stopPolling(). */
  stop(): void

  /** Check all tracked leases and send due heartbeats. Called by the interval. */
  private async sendDueHeartbeats(): Promise<void>

  /** Send a single heartbeat with retries. Uses v1 endpoint directly. */
  private async sendHeartbeat(info: LeaseInfo): Promise<void>
}
```

The `sendHeartbeatFn` is injected from `TaskRunner` to keep `LeaseTracker` decoupled from the HTTP client. It calls `TaskResource.updateTask()` (v1 endpoint, **not** `updateTaskWithRetry`) with `extendLease: true`.

`LeaseTracker.start()` must call `.unref()` on the returned timer so the heartbeat interval does not prevent clean process exit when polling is stopped.

**Heartbeat payload:**
```typescript
{
  taskId,
  workflowInstanceId,
  status: "IN_PROGRESS",
  extendLease: true,
  // workerId is added by the sendHeartbeatFn closure inside TaskRunner, not by LeaseTracker directly
}
```

**Why v1 endpoint, not `updateTaskWithRetry`:**
- `updateTaskWithRetry` probes and prefers the v2 endpoint, which returns a next-task for chaining — incorrect for a heartbeat
- `updateTaskWithRetry` has 10s/20s/30s retry delays, far too slow for a keep-alive operation
- `updateTaskWithRetry` emits `publishTaskUpdateCompleted` / `publishTaskUpdateFailure` events, which are misleading for a heartbeat

**Heartbeat retry delay:** 500ms between attempts (matching Python's short `0.5 * (attempt + 2)` scheme).

#### Modified: `src/sdk/clients/worker/TaskRunner.ts`

`TaskRunner` creates and owns the `LeaseTracker`, passing a heartbeat function:

```typescript
private leaseTracker: LeaseTracker;
```

In constructor:
```typescript
this.leaseTracker = new LeaseTracker(
  async (taskId, workflowInstanceId) => {
    await TaskResource.updateTask({
      client: this._client,
      body: { taskId, workflowInstanceId, status: "IN_PROGRESS", extendLease: true, workerId: this.options.workerID },
      throwOnError: true,
    });
  },
  this.logger
);
```

**In `startPolling()`:** call `this.leaseTracker.start()` (idempotent).

**In `stopPolling()`:** call `this.leaseTracker.stop()` *before* awaiting `this.poller.stopPolling()`, so no new heartbeats fire after stop is initiated.

**In `executeOneTask()`:** lease lifecycle is:
```
// 1. Track before executing
if (worker.leaseExtendEnabled) {
  this.leaseTracker.track(task);
}

try {
  const { result, context } = await runWithTaskContext(task, async (ctx) => {
    const r = await this.worker.execute(task);
    return { result: r, context: ctx };
  });

  // 2a. IN_PROGRESS path: untrack IMMEDIATELY after execute resolves
  if (isTaskInProgress(result)) {
    this.leaseTracker.untrack(taskId);
    // ... send IN_PROGRESS result ...
    return nextTask;
  }

  // 2b. COMPLETED path: untrack IMMEDIATELY after execute resolves — before updateTaskWithRetry
  this.leaseTracker.untrack(taskId);

  // ... build TaskResult ...
  await this.updateTaskWithRetry(task, taskResult);

} catch (error) {
  // 2c. FAILED path: untrack immediately after execute throws — before updateTaskWithRetry
  this.leaseTracker.untrack(taskId);

  // ... build error TaskResult ...
  await this.updateTaskWithRetry(task, errorTaskResult);
}
```

All three exit paths from `worker.execute()` untrack the lease before any `updateTaskWithRetry` call, matching Python line 554.

**Rationale for untracking before `updateTaskWithRetry`:** Matches Python line 554 exactly. The task execution is done; the server result will be submitted. Continuing to heartbeat during the update retry window would be redundant and could confuse the server.

#### Modified: `src/sdk/clients/worker/types.ts`

Add `leaseExtendEnabled?: boolean` to `ConductorWorker`:

```typescript
export interface ConductorWorker {
  taskDefName: string;
  execute: (...) => ...;
  domain?: string;
  concurrency?: number;
  pollInterval?: number;
  leaseExtendEnabled?: boolean;  // NEW
}
```

#### Modified: `src/sdk/worker/config/WorkerConfig.ts`

Add `leaseExtendEnabled` to:
- `WorkerConfig` interface
- `CONFIGURABLE_PROPERTIES` array
- `PROPERTY_TYPES` map (type: `"boolean"`)
- `DEFAULT_VALUES` map (default: `false`)

Env var: `CONDUCTOR_WORKER_<NAME>_LEASE_EXTEND_ENABLED` / `CONDUCTOR_WORKER_ALL_LEASE_EXTEND_ENABLED`

#### Modified: `src/sdk/worker/decorators/worker.ts`

Add `leaseExtendEnabled?: boolean` to `WorkerOptions` and pass it through to the registered worker object.

#### Modified: `src/sdk/worker/decorators/registry.ts`

Add `leaseExtendEnabled?: boolean` to `RegisteredWorker` (or equivalent intermediate type). Without this, the decorator path silently drops `leaseExtendEnabled` before it reaches `TaskRunner`.

#### Modified: `src/sdk/worker/core/TaskHandler.ts`

Two changes required:

1. Pass `leaseExtendEnabled` into `resolveWorkerConfig` codeDefaults (the existing call that builds `resolved` from `registered`).

2. Copy `leaseExtendEnabled` onto the `conductorWorker` object built from the resolved config. Without this, `leaseExtendEnabled` is silently dropped for all `@worker` decorator users (the primary usage pattern), even if correctly set in `WorkerOptions` or via env var.

---

## Feature 2: `PullWorkflowMessages` Task Builder

### Behavior

Matches Python `PullWorkflowMessagesTask` 1:1:
- Consumes messages from the workflow's message queue (WMQ)
- When messages are available: task completes with `output.messages` (list) and `output.count` (number)
- When queue is empty: stays `IN_PROGRESS`, re-evaluated after ~1 second
- `batchSize` defaults to `1`, server cap is typically 100

### Architecture

#### Modified: `src/open-api/types.ts`

1. Add to `TaskType` enum:
```typescript
PULL_WORKFLOW_MESSAGES = "PULL_WORKFLOW_MESSAGES",
```

2. Add new interface:
```typescript
export interface PullWorkflowMessagesTaskDef extends CommonTaskDef {
  type: TaskType.PULL_WORKFLOW_MESSAGES;
  inputParameters: {
    batchSize: number;
  };
  optional?: boolean;
}
```

3. Add `PullWorkflowMessagesTaskDef` to `TaskDefTypes` union. Note: `WaitForWebhookTaskDef` is not in the union for historical reasons; `PullWorkflowMessagesTaskDef` should be added consistently with the typed-def pattern used by `HttpTaskDef`, `InlineTaskDef`, etc.

Note: adding to `TaskDefTypes` allows the type to appear in `DoWhileTaskDef.loopOver` arrays; whether the server permits this is a runtime concern, not an SDK concern.

#### New file: `src/sdk/builders/tasks/pullWorkflowMessages.ts`

```typescript
import { TaskType, PullWorkflowMessagesTaskDef } from "../../../open-api";

export const pullWorkflowMessages = (
  taskReferenceName: string,
  batchSize: number = 1,
  optional?: boolean
): PullWorkflowMessagesTaskDef => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.PULL_WORKFLOW_MESSAGES,
  inputParameters: { batchSize },
  optional,
});
```

#### Modified: `src/sdk/builders/tasks/index.ts`

Add `export * from "./pullWorkflowMessages";`

---

## Files Changed Summary

| File | Change |
|------|--------|
| `src/sdk/clients/worker/LeaseTracker.ts` | **NEW** — `LeaseTracker` class with all heartbeat logic, `LeaseInfo` interface, constants |
| `src/sdk/clients/worker/TaskRunner.ts` | Create `LeaseTracker`, call `start()`/`stop()` with polling, `track()`/`untrack()` in `executeOneTask` |
| `src/sdk/clients/worker/types.ts` | Add `leaseExtendEnabled` to `ConductorWorker` |
| `src/sdk/worker/config/WorkerConfig.ts` | Add `leaseExtendEnabled` config property (default: false) |
| `src/sdk/worker/decorators/worker.ts` | Add `leaseExtendEnabled` to `WorkerOptions` |
| `src/sdk/worker/decorators/registry.ts` | Add `leaseExtendEnabled` to `RegisteredWorker` |
| `src/sdk/worker/core/TaskHandler.ts` | Pass `leaseExtendEnabled` into `resolveWorkerConfig` codeDefaults; copy onto `conductorWorker` object |
| `src/open-api/types.ts` | Add `PULL_WORKFLOW_MESSAGES` to `TaskType`, new interface, extend union |
| `src/sdk/builders/tasks/pullWorkflowMessages.ts` | **NEW** — builder function |
| `src/sdk/builders/tasks/index.ts` | Export new builder |

---

## Testing

- Unit test (`LeaseTracker`): heartbeat sent at `responseTimeoutSeconds * 0.8 * 1000` ms
- Unit test (`LeaseTracker`): tasks with `responseTimeoutSeconds` producing interval < 1000ms are not tracked
- Unit test (`LeaseTracker`): heartbeat fires when check interval ticks even if no polling is happening
- Unit test (`LeaseTracker`): uses v1 `updateTask` endpoint (not v2)
- Unit test (`LeaseTracker`): retries up to 3 times on heartbeat failure, does not fail the task
- Unit test (`TaskRunner`): lease tracker starts/stops with polling
- Unit test (`TaskRunner`): lease untracked after `worker.execute()` completes, before `updateTaskWithRetry`
- Unit test (`TaskRunner`): lease untracked after `worker.execute()` throws
- Unit test: `pullWorkflowMessages` builder produces correct task def shape
- Integration test: long-running task with `leaseExtendEnabled` completes without server-side timeout
