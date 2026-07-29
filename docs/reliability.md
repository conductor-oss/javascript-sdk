# Reliability

**Audience:** developers running workers whose failures must not cause duplicate
or lost work.

## Prerequisites

Workers running ([workers.md](workers.md)) and the ability to set task definition
fields via the metadata client.

## Lease extension

When a task is polled, the server starts a `responseTimeoutSeconds` timer. If no
update arrives before it expires, the server **re-queues the task** — which can
mean duplicate execution by a second worker. For anything that takes longer than
its response timeout, that is the failure mode to design against.

Lease extension sends a periodic heartbeat that resets the timer.

```ts
import { worker } from "@io-orkes/conductor-javascript";

@worker({
  taskDefName: "process_video",
  leaseExtendEnabled: true,   // heartbeat at 80% of responseTimeoutSeconds
})
async function processVideo(task: Task): Promise<TaskResult> {
  await encodeVideo(task.inputData.videoUrl);   // takes minutes
  return { status: "COMPLETED", outputData: { done: true } };
}
```

**Expected result:** a task that runs far longer than `responseTimeoutSeconds`
completes once, with no duplicate execution.

### How it works

1. `LeaseTracker` records the polled task and computes
   `intervalMs = responseTimeoutSeconds × 0.8 × 1000`.
2. A 100 ms-tick `setInterval` runs **independently of the poll loop**, so
   heartbeats fire even when every concurrency slot is busy executing.
3. On each interval an `extendLease: true` update resets the server timer.
4. The task is untracked as soon as `execute()` resolves, before the final result
   is submitted.

Running the heartbeat off the poll loop is the whole point: if all slots are full,
no new tasks are polled, but the in-flight tasks still need their leases kept
alive.

### Requirements and limits

The task definition must have `responseTimeoutSeconds >= 1.25`. Anything shorter
computes an interval under 1000 ms and is **silently skipped** — matching the
Python SDK. If lease extension seems to do nothing, check this first.

```ts
await metadataClient.registerTask({
  name: "process_video",
  responseTimeoutSeconds: 60,   // heartbeat every 48s
  timeoutSeconds: 3600,         // hard ceiling — NOT extended by heartbeats
  retryCount: 0,
});
```

`leaseExtendEnabled` resets `responseTimeoutSeconds` on each heartbeat. It does
**not** extend `timeoutSeconds`, the total execution ceiling. A task that outlives
`timeoutSeconds` is timed out no matter how faithfully it heartbeats.

### Environment overrides

```shell
# Per-worker (highest priority)
CONDUCTOR_WORKER_MY_TASK_LEASE_EXTEND_ENABLED=true

# Global
CONDUCTOR_WORKER_ALL_LEASE_EXTEND_ENABLED=true
```

### Constants

| Constant | Value | Meaning |
|---|---|---|
| `LEASE_EXTEND_DURATION_FACTOR` | `0.8` | Heartbeat at 80% of `responseTimeoutSeconds` |
| `LEASE_EXTEND_RETRY_COUNT` | `3` | Retries per heartbeat |
| `HEARTBEAT_CHECK_INTERVAL_MS` | `100` | Due-check tick |
| `HEARTBEAT_RETRY_DELAY_MS` | `500` | Delay between retries |

A failed heartbeat is retried three times with a 500 ms delay. If all retries
fail the error is logged, the task stays tracked, and the next interval tries
again — **the task is not failed because of heartbeat errors**. That is
deliberate, but it means a sustained heartbeat outage shows up as duplicate
execution rather than as a task failure. Alert on heartbeat errors in your logs.

### Direct LeaseTracker usage

For custom worker implementations that bypass `TaskRunner`, `LeaseTracker` is part
of the public API:

```ts
import { LeaseTracker, TaskResource, orkesConductorClient } from "@io-orkes/conductor-javascript";
import type { LeaseInfo } from "@io-orkes/conductor-javascript";

const client = await orkesConductorClient();

const tracker = new LeaseTracker(
  // sendHeartbeatFn — called on each heartbeat
  async (taskId, workflowInstanceId) => {
    await TaskResource.updateTask({
      client,
      body: { taskId, workflowInstanceId, status: "IN_PROGRESS", extendLease: true },
      throwOnError: true,
    });
  },
  logger,
);

tracker.start();                 // start the 100ms check interval
tracker.track(task);             // track a polled task
// ... worker executes ...
tracker.untrack(task.taskId!);   // untrack as soon as execute() resolves
tracker.stop();                  // stop the interval on shutdown
```

`LeaseInfo` describes the tracked state for one task:

```ts
interface LeaseInfo {
  readonly taskId: string;
  readonly workflowInstanceId: string;
  readonly responseTimeoutSeconds: number;
  readonly lastHeartbeatTime: number;  // Date.now() of the last successful heartbeat
  readonly intervalMs: number;         // responseTimeoutSeconds × 0.8 × 1000
  readonly isHeartbeating: boolean;    // true while a heartbeat chain is in flight
}
```

Untrack immediately after `execute()` resolves. Leaving a task tracked keeps
heartbeating a task the server already considers finished.

### Python SDK parity

Behavior matches the Python SDK, so cross-SDK deployments behave identically:

| Behavior | Python | JavaScript |
|---|---|---|
| Heartbeat interval | `responseTimeoutSeconds × 0.8` | Same |
| Minimum interval | `< 1s` → skip | `< 1000ms` → skip |
| Retry count | 3 | Same |
| Retry delay | ~500 ms | Same |
| Heartbeat endpoint | v1 `updateTask` | Same |
| Independent of poll loop | Yes (`run_once()` pre-poll) | Yes (`setInterval`) |
| `leaseExtendEnabled` flag | Yes | Yes |

## Retries and idempotency

| Thrown from a worker | Status | Retried? |
|---|---|---|
| `Error` | `FAILED` | Yes, per the task definition |
| `NonRetryableException` | `FAILED_WITH_TERMINAL_ERROR` | No |

Because a lease can lapse and a task can be re-queued, **worker functions should
be idempotent**. Key side effects on something stable from the task input — an
order id, not a generated timestamp.

## Workflow-level recovery

`retry(workflowId)` resumes from the last failed task, preserving completed work.
`restart(workflowId)` starts over and discards it. See
[workflow-lifecycle.md](workflow-lifecycle.md).

## Agent-layer liveness

Stateful agent runs get a liveness monitor that fails a blocking `wait()` with
`WorkerStallError` when the domain's worker appears to have died, instead of
hanging forever. See
[agents/concepts/stateful.md](agents/concepts/stateful.md#liveness-monitoring).

## Next steps

[workers.md](workers.md) · [observability.md](observability.md) ·
[debugging.md](debugging.md)
