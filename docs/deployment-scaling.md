# Deployment and scaling

**Audience:** developers sizing and shipping Conductor worker processes.

## Prerequisites

Workers running locally ([workers.md](workers.md)) and metrics wired up
([observability.md](observability.md)) — sizing without metrics is guessing.

## Concurrency

Two independent knobs per worker:

| Option | Default | Meaning |
|---|---|---|
| `concurrency` | `1` | Max tasks executing simultaneously in this process. |
| `pollInterval` | `100` (ms) | How often to poll when slots are free. |

```ts
@worker({ taskDefName: "resize_image", concurrency: 8, pollInterval: 50 })
```

Tune without a code change:

```shell
export CONDUCTOR_WORKER_ALL_CONCURRENCY=10
export CONDUCTOR_WORKER_ALL_POLL_INTERVAL=500
export CONDUCTOR_WORKER_RESIZE_IMAGE_CONCURRENCY=20
```

**Node.js is single-threaded.** Raising `concurrency` helps I/O-bound work — HTTP
calls, database queries — and does not help CPU-bound work. For CPU-bound tasks,
scale processes, not concurrency; a `concurrency: 20` CPU-bound worker just queues
20 tasks behind one event loop and risks lease expiry on all of them.

Watch `task_execution_queue_full_total`: a rising count means polling outpaces
execution.

## Scaling out

Run more worker processes. Conductor's queue distributes tasks across every worker
polling a given task type, so horizontal scaling needs no coordination.

Give each replica a distinct `workerId` when you want to attribute work to an
instance; otherwise the SDK generates one.

## Domains

`domain` partitions a task type across worker pools — useful for tenancy or for
routing heavy work to bigger machines.

```ts
@worker({ taskDefName: "process_payment", domain: "payments" })
```

A worker with a domain **only** receives tasks queued for that domain. A domain
mismatch is a common cause of tasks sitting in `SCHEDULED` with a worker that looks
healthy.

## Long-running tasks

For work that exceeds `responseTimeoutSeconds`, enable lease extension rather than
inflating the timeout — see [reliability.md](reliability.md#lease-extension). For
work that waits on something external, return `IN_PROGRESS` with
`callbackAfterSeconds` so the slot is released.

## Graceful shutdown

```ts
process.on("SIGTERM", async () => {
  await handler.stopWorkers();
  process.exit(0);
});
```

`stopWorkers()` stops polling and lets in-flight tasks finish. Make your
orchestrator's termination grace period longer than your longest task, or in-flight
work is killed and re-queued — which is safe only if your workers are idempotent.

## Containers

The repository ships a `Dockerfile`. Points that matter:

- Node.js >= 18; CI covers 20, 22, and 24.
- Set `CONDUCTOR_SERVER_URL` and auth via environment or secrets, never baked in.
- Expose the metrics port if you use `MetricsServer`.
- Use `handler.running` for the liveness probe and `handler.runningWorkerCount` for
  readiness.

## Agent processes

An agent `serve()` process is a worker process — the same sizing applies. Note that
stateful agent runs create domain-scoped workers per execution, so a high volume of
concurrent stateful runs creates a lot of short-lived workers. See
[agents/concepts/deploy-serve-run.md](agents/concepts/deploy-serve-run.md).

## Next steps

[observability.md](observability.md) · [reliability.md](reliability.md) ·
[security.md](security.md)
