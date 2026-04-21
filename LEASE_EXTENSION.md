# Lease Extension (Heartbeat)

Long-running workers need to keep their task **lease** alive on the Conductor server. When a task is polled, the server starts a `responseTimeoutSeconds` timer. If no update arrives before the timer expires, the server re-queues the task — potentially causing **duplicate execution** by a second worker.

Lease extension sends a periodic heartbeat (`extendLease: true`) to the server that resets this timer, allowing the worker to safely run for minutes or hours.

---

## Quick Start

Enable via the `@worker` decorator:

```typescript
import { worker } from "@io-orkes/conductor-javascript";

@worker({
  taskDefName: "process_video",
  leaseExtendEnabled: true,   // ← heartbeat at 80% of responseTimeoutSeconds
})
async function processVideo(task: Task): Promise<TaskResult> {
  // Takes 5 minutes — server lease stays alive automatically
  await encodeVideo(task.inputData.videoUrl);
  return { status: "COMPLETED", outputData: { done: true } };
}
```

Or on a manually constructed `ConductorWorker`:

```typescript
const runner = new TaskRunner({
  worker: {
    taskDefName: "process_video",
    execute: processVideo,
    leaseExtendEnabled: true,
  },
  client,
  options: { workerID: "worker-1", domain: undefined },
});
runner.startPolling();
```

---

## How It Works

When `leaseExtendEnabled: true` is set and a task is polled:

1. The `LeaseTracker` records the task and computes a heartbeat interval:
   ```
   intervalMs = responseTimeoutSeconds × 0.8 × 1000
   ```
2. A `setInterval` (100 ms tick) runs **independently of the polling loop** — it fires even when all concurrency slots are occupied with executing tasks.
3. When `intervalMs` elapses since the last heartbeat (or task start), a `extendLease: true` update is sent to the server via the v1 endpoint, resetting the `responseTimeoutSeconds` timer.
4. The task is untracked as soon as `worker.execute()` resolves (before the final result is submitted).

```
t=0s    task polled  → lease tracked
t=8s    heartbeat #1 → server timer reset to 10s
t=16s   heartbeat #2 → server timer reset to 10s
t=20s   execute()    → COMPLETED, lease untracked
```
*(Example: `responseTimeoutSeconds=10s`, execution takes 20s)*

### Why independent of the poll loop?

The heartbeat timer is a `setInterval` that runs on the Node.js event loop separate from the `Poller`. If all concurrency slots are full (workers are busy), no new tasks are polled — but heartbeats still fire for the tasks currently executing.

---

## Configuration

### `@worker` decorator option

```typescript
@worker({
  taskDefName: "my_task",
  leaseExtendEnabled: true,     // default: false
})
```

### Environment variable override

Per-worker or global overrides follow the same hierarchy as all other worker config:

```bash
# Worker-specific (highest priority)
CONDUCTOR_WORKER_MY_TASK_LEASE_EXTEND_ENABLED=true

# Global (applies to all workers)
CONDUCTOR_WORKER_ALL_LEASE_EXTEND_ENABLED=true
```

### Task definition requirement

The task must have `responseTimeoutSeconds >= 1.25` for lease extension to activate. Tasks with shorter response timeouts produce a computed interval < 1000 ms, which is skipped (matches Python SDK behaviour).

```typescript
await metadataClient.registerTask({
  name: "process_video",
  responseTimeoutSeconds: 60,   // heartbeat fires every 48s
  timeoutSeconds: 3600,         // hard ceiling (unchanged by heartbeats)
  retryCount: 0,
});
```

> **Note:** `leaseExtendEnabled` resets the `responseTimeoutSeconds` window on each heartbeat. It does **not** extend the task's `timeoutSeconds` (total execution ceiling).

---

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `LEASE_EXTEND_DURATION_FACTOR` | `0.8` | Heartbeat fires at 80% of `responseTimeoutSeconds` |
| `LEASE_EXTEND_RETRY_COUNT` | `3` | Retry attempts per heartbeat on failure |
| `HEARTBEAT_CHECK_INTERVAL_MS` | `100` | How often to check if a heartbeat is due |
| `HEARTBEAT_RETRY_DELAY_MS` | `500` | Delay between heartbeat retry attempts |

```typescript
import { LEASE_EXTEND_DURATION_FACTOR, LEASE_EXTEND_RETRY_COUNT } from "@io-orkes/conductor-javascript";
```

---

## Retry Behaviour

If a heartbeat fails, it is retried up to `LEASE_EXTEND_RETRY_COUNT` (3) times with a 500 ms delay between attempts. If all retries fail:

- The error is logged.
- The task remains tracked — the next check interval will attempt another heartbeat.
- The task itself is **not failed** due to heartbeat errors.

---

## Direct `LeaseTracker` Usage

For custom worker implementations that bypass `TaskRunner`, `LeaseTracker` is exported from the public API:

```typescript
import { LeaseTracker, TaskResource, orkesConductorClient } from "@io-orkes/conductor-javascript";
import type { LeaseInfo } from "@io-orkes/conductor-javascript";

const client = await orkesConductorClient();

const tracker = new LeaseTracker(
  // sendHeartbeatFn — called by LeaseTracker on each heartbeat
  async (taskId, workflowInstanceId) => {
    await TaskResource.updateTask({
      client,
      body: { taskId, workflowInstanceId, status: "IN_PROGRESS", extendLease: true },
      throwOnError: true,
    });
  },
  logger
);

tracker.start();                 // start the 100ms check interval
tracker.track(task);             // track a polled task
// ... worker executes task ...
tracker.untrack(task.taskId!);   // untrack immediately after execute() resolves
tracker.stop();                  // stop the interval (on worker shutdown)
```

`LeaseInfo` describes the tracked state for a single task:

```typescript
interface LeaseInfo {
  readonly taskId: string;
  readonly workflowInstanceId: string;
  readonly responseTimeoutSeconds: number;
  readonly lastHeartbeatTime: number;  // Date.now() of last successful heartbeat
  readonly intervalMs: number;         // responseTimeoutSeconds × 0.8 × 1000
  readonly isHeartbeating: boolean;    // true while a heartbeat chain is in-flight
}
```

---

## Python SDK Parity

| Behaviour | Python SDK | JS SDK |
|-----------|-----------|--------|
| Heartbeat interval | `responseTimeoutSeconds × 0.8` | ✓ same |
| Minimum interval | `< 1s → skip` | ✓ `< 1000ms → skip` |
| Retry count | 3 | ✓ same |
| Retry delay | ~500ms | ✓ same |
| Heartbeat endpoint | v1 `updateTask` | ✓ same |
| Independent of poll loop | ✓ (Python `run_once()` pre-poll) | ✓ (JS `setInterval`) |
| `leaseExtendEnabled` flag | ✓ | ✓ |

---

## Related

- [`pullWorkflowMessages`](#pullworkflowmessages) — task builder for consuming workflow message queue messages, which uses the `IN_PROGRESS` / re-queue pattern that lease extension is designed to protect.
- [METRICS.md](./METRICS.md) — monitoring worker health, poll latency, and execution duration.

---

## `pullWorkflowMessages` Task Builder

A task that consumes messages from the workflow's message queue (WMQ). When messages are available the task completes; when the queue is empty it returns `IN_PROGRESS` and is re-evaluated after ~1 second.

```typescript
import { pullWorkflowMessages } from "@io-orkes/conductor-javascript";

const wf = new ConductorWorkflow(executor, "order_processor")
  .add(pullWorkflowMessages("read_messages", /* batchSize */ 5))
  .add(simpleTask("process_ref", "process_order", { messages: "${read_messages.output.messages}" }));
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `taskReferenceName` | `string` | — | Unique reference name within the workflow |
| `batchSize` | `number` | `1` | Max messages to dequeue per execution (server cap ~100) |
| `optional` | `boolean` | `undefined` | Whether the task is optional |

**Output shape:**
```json
{
  "messages": [ /* WorkflowMessage objects */ ],
  "count": 3
}
```
