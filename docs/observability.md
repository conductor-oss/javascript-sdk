# Observability

**Audience:** developers instrumenting Conductor workers with metrics and logs.

## Prerequisites

Workers running ([workers.md](workers.md)). Prometheus integration optionally
needs `npm install prom-client`.

## Metrics

Create a collector, start a scrape server, and wire the collector into
`TaskHandler` as an event listener:

```ts
import {
  createMetricsCollector,
  MetricsServer,
  TaskHandler,
} from "@io-orkes/conductor-javascript";

const metrics = createMetricsCollector();
const server = new MetricsServer(metrics, 9090);
await server.start();

const handler = new TaskHandler({
  client,
  eventListeners: [metrics],
  scanForDecorated: true,
});
await handler.startWorkers();
```

**Expected result:**

- `GET http://localhost:9090/metrics` — Prometheus text format
- `GET http://localhost:9090/health` — `{"status":"UP"}`

**Common failure mode:** metrics are empty. The collector must be passed in
`eventListeners` — creating it is not enough, since it collects by observing
worker events.

## Two metric surfaces

`createMetricsCollector()` reads `WORKER_CANONICAL_METRICS` and returns either a
`LegacyMetricsCollector` or a `CanonicalMetricsCollector`. Both implement
`MetricsCollectorInterface`, so call sites don't care which is active.

| | Legacy (default) | Canonical (opt-in) |
|---|---|---|
| Names | Prefixed `conductor_worker_` | Unprefixed |
| Type | Summary | Histogram |
| Time units | Milliseconds | Seconds |
| Size units | — | Bytes |
| Labels | snake_case | camelCase |

```shell
WORKER_CANONICAL_METRICS=true node my_worker.js
```

Accepted true values are `true`, `1`, `yes`, case-insensitive. The variable is read
when the collector is **created**, so changing it needs a worker restart.

Canonical time histograms use buckets `0.001, 0.005, 0.01, 0.025, 0.05, 0.1,
0.25, 0.5, 1, 2.5, 5, 10`.

Prefer canonical for new deployments — histograms aggregate correctly across
instances, Summary quantiles don't. Canonical mode is opt-in during the deprecation
period; update dashboards and alerts against a staging worker before switching
production.

## Configuration

| Option | Default | Purpose |
|---|---|---|
| `prefix` | `"conductor_worker"` | Name prefix. Legacy only. |
| `httpPort` | — | Start the built-in HTTP server. |
| `filePath` | — | Periodically write metrics to a file. |
| `fileWriteIntervalMs` | `5000` | File write interval. |
| `slidingWindowSize` | `1000` | Quantile window. Legacy only. |
| `usePromClient` | `false` | Register in `prom-client`'s default registry. |

```ts
const metrics = createMetricsCollector({
  filePath: "/tmp/conductor_metrics.prom",
  fileWriteIntervalMs: 10000,
});
```

The file writer does an immediate first write, then writes on the interval. Its
timer is unreferenced, so it never keeps the process alive.

`usePromClient: true` requires `prom-client` and falls back to the built-in text
format if it isn't installed — a silent fallback worth knowing about if you expect
metrics in the default registry and don't find them.

## What to alert on

| Signal | Why |
|---|---|
| `worker_restart_total` | `TaskHandler` restarted a polling loop — something is crashing. |
| `task_update_error_total` | Results are failing to reach the server; work may be re-queued. |
| Heartbeat errors in logs | Lease extension is failing — risk of duplicate execution. See [reliability.md](reliability.md). |
| `handler.runningWorkerCount` | Health check: expected worker count. |
| `task_execution_queue_full_total` | Concurrency is saturated — see [deployment-scaling.md](deployment-scaling.md). |

## Health checks

```ts
app.get("/health", (_req, res) => {
  res.json({ up: handler.running, workers: handler.runningWorkerCount });
});
```

## Logging

`CONDUCTOR_LOG_LEVEL` sets the SDK log level. Inside a worker,
`getTaskContext()?.addLog()` streams a log line into the Conductor UI, attached to
that task execution — the fastest way to explain *why* a specific task did what it
did.

## Cardinality

Labels are keyed by task type and exception class. Avoid adding per-execution
identifiers as labels. Canonical HTTP metrics use a bounded path **template**
(`/workflow/{workflowId}`) rather than the interpolated path, precisely to keep
cardinality bounded — don't undo that with custom labels.

---

# Metric reference

## Canonical metrics

Time values are seconds, size values are bytes, label names are camelCase.

### Counters

| Metric | Labels | Description |
|---|---|---|
| `task_poll_total` | `taskType` | Each poll request issued. |
| `task_execution_started_total` | `taskType` | A polled task dispatched to the worker function. |
| `task_poll_error_total` | `taskType`, `exception` | Poll request failed client-side. |
| `task_execute_error_total` | `taskType`, `exception` | The worker function threw. |
| `task_update_error_total` | `taskType`, `exception` | Updating the task result failed. |
| `task_ack_error_total` | `taskType`, `exception` | Ack errors. The internal runner uses batch poll responses as ack, so this may not emit during normal polling. |
| `task_ack_failed_total` | `taskType` | Failed ack responses. Same caveat. |
| `task_execution_queue_full_total` | `taskType` | Execution queue saturated. |
| `task_paused_total` | `taskType` | Worker paused and skipped acting on a poll. |
| `thread_uncaught_exceptions_total` | `exception` | Uncaught exception in the worker process. |
| `external_payload_used_total` | `entityName`, `operation`, `payloadType` | External payload storage used. |
| `workflow_start_error_total` | `workflowType`, `exception` | Starting a workflow failed client-side. |

### Time histograms

Buckets: `0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10`.

| Metric | Labels | Description |
|---|---|---|
| `task_poll_time_seconds` | `taskType`, `status` | Poll latency. `status` is `SUCCESS` or `FAILURE`. |
| `task_execute_time_seconds` | `taskType`, `status` | Worker function duration. |
| `task_update_time_seconds` | `taskType`, `status` | Task-result update latency. |
| `http_api_client_request_seconds` | `method`, `uri`, `status` | API-client HTTP latency. `status` is the HTTP code as a string, or `"0"` on network failure. |

```prometheus
task_execute_time_seconds_bucket{taskType="my_task",status="SUCCESS",le="0.1"} 42
task_execute_time_seconds_count{taskType="my_task",status="SUCCESS"} 50
task_execute_time_seconds_sum{taskType="my_task",status="SUCCESS"} 2.3
```

### Size histograms

Buckets: `100, 1000, 10000, 100000, 1000000, 10000000`.

| Metric | Labels | Description |
|---|---|---|
| `task_result_size_bytes` | `taskType` | Serialized task result size. |
| `workflow_input_size_bytes` | `workflowType`, `version` | Serialized workflow input size. `version` is `""` when absent. |

### Gauges

| Metric | Labels | Description |
|---|---|---|
| `active_workers` | `taskType` | Workers currently executing tasks. |

## Legacy metrics

Default mode, so existing dashboards keep working. Prefix `conductor_worker`
(configurable via `prefix`). Distribution metrics are sliding-window summaries over
the latest 1,000 observations (`slidingWindowSize`), exposing p50, p75, p90, p95,
p99 plus `_count` and `_sum`.

### Counters

| Metric | Labels | Description |
|---|---|---|
| `conductor_worker_task_poll_total` | `task_type` | Each poll. |
| `conductor_worker_task_poll_error_total` | `task_type` | Poll failed. |
| `conductor_worker_task_execute_total` | `task_type` | Task execution completed. |
| `conductor_worker_task_execute_error_total` | `task_type` | Execution errors. Label format `taskType:ExceptionName`. |
| `conductor_worker_task_update_error_total` | `task_type` | Result update failed. |
| `conductor_worker_task_ack_error_total` | `task_type` | Ack errors. |
| `conductor_worker_task_execution_queue_full_total` | `task_type` | Queue saturated. |
| `conductor_worker_task_paused_total` | `task_type` | Worker paused, poll skipped. |
| `conductor_worker_external_payload_used_total` | `payload_type` | External payload storage used. |
| `conductor_worker_thread_uncaught_exceptions_total` | none | Uncaught exceptions. |
| `conductor_worker_worker_restart_total` | none | Worker restart events. |
| `conductor_worker_workflow_start_error_total` | none | Workflow start errors. |

Legacy mode does **not** emit `task_execution_started_total`,
`task_ack_failed_total`, or `active_workers`.

### Time and size metrics

Summary type. Time in milliseconds, size in bytes.

| Metric | Labels | Description |
|---|---|---|
| `conductor_worker_task_poll_time` | `task_type` | Poll round-trip. |
| `conductor_worker_task_execute_time` | `task_type` | Worker function duration. |
| `conductor_worker_task_update_time` | `task_type` | Result update duration. |
| `conductor_worker_task_result_size_bytes` | `task_type` | Task result payload size. |
| `conductor_worker_workflow_input_size_bytes` | `workflow_type` | Workflow input payload size. |
| `conductor_worker_http_api_client_request` | `endpoint` | API request duration (ms). `endpoint` is a compound `"METHOD:/api/path:STATUS"` string. |

```prometheus
conductor_worker_task_execute_time{task_type="my_task",quantile="0.5"} 102
conductor_worker_task_execute_time{task_type="my_task",quantile="0.95"} 250
conductor_worker_task_execute_time_count{task_type="my_task"} 1000
conductor_worker_task_execute_time_sum{task_type="my_task"} 120345
```

## Labels

| Label | Used by | Values |
|---|---|---|
| `task_type` | Legacy worker metrics | Task definition name. |
| `taskType` | Canonical worker metrics | Task definition name. |
| `workflowType` | Canonical workflow metrics | Workflow definition name. |
| `workflow_type` | Legacy `workflow_input_size_bytes` | Workflow definition name. |
| `version` | Canonical `workflow_input_size_bytes` | Workflow version as a string; `""` when absent. |
| `status` | Canonical task time histograms | `SUCCESS` or `FAILURE`. For `http_api_client_request_seconds`, the HTTP code as a string or `"0"`. |
| `exception` | Canonical error counters | Exception type name, from `error.name` or `error.constructor.name`. |
| `entityName` | Canonical `external_payload_used_total` | Task type or workflow name. |
| `operation` | Canonical `external_payload_used_total` | `READ`, `WRITE`. |
| `payload_type` | Legacy external-payload counter | e.g. `workflow_input`, `task_output`. |
| `payloadType` | Canonical external-payload counter | `TASK_INPUT`, `TASK_OUTPUT`, `WORKFLOW_INPUT`, `WORKFLOW_OUTPUT`. |
| `method` | Canonical HTTP metrics | HTTP verb. |
| `uri` | Canonical HTTP metrics | Bounded path template, e.g. `/workflow/{workflowId}`. |
| `endpoint` | Legacy HTTP metrics | Compound `"METHOD:/api/path:STATUS"`. |
| `quantile` | Legacy time and size metrics | `0.5`, `0.75`, `0.9`, `0.95`, `0.99`. |

## Implementation notes

**One collector per process.** Only one collector can be active at a time.
`CanonicalMetricsCollector` registers itself as the global HTTP metrics observer on
construction; `LegacyMetricsCollector` does not — use `createMetricsCollector()` or
call `setHttpMetricsObserver()` explicitly to get HTTP metrics in legacy mode.
Creating a second collector **replaces** the first, silently. `stop()` clears the
global observer.

**Payload size measurement.** `workflow_input_size_bytes` is recorded by
`JSON.stringify`-ing the workflow input and measuring UTF-8 length with
`Buffer.byteLength`. Controlled by `measurePayloadSize`: canonical defaults to
`true` (measured on every `startWorkflow`), legacy defaults to `false`. Disable it
if your inputs are large and the serialization cost matters.

**Legacy `task_paused_total`.** Defined but never recorded in any release. It stays
unrecorded in legacy mode to preserve byte-for-byte output compatibility. Switch to
canonical to get paused metrics.

**`WORKER_LEGACY_METRICS`** is reserved and not read by the current implementation.
Once canonical becomes the default, it will re-activate the legacy surface.

## Next steps

[debugging.md](debugging.md) · [reliability.md](reliability.md) ·
[deployment-scaling.md](deployment-scaling.md)
