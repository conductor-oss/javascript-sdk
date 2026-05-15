# JavaScript SDK Metrics

The Conductor JavaScript SDK can expose Prometheus metrics for worker polling,
task execution, task updates, workflow starts, external payload usage, and
API-client HTTP calls.

The SDK currently has two mutually exclusive metric surfaces:

- **Legacy metrics** are the default. They preserve the original JavaScript SDK
  names and shapes, including a `conductor_worker_` prefix, `task_type` labels,
  millisecond time units, and Summary type for distributions.
- **Canonical metrics** are opt-in with `WORKER_CANONICAL_METRICS=true`. They
  use the cross-SDK canonical names, labels, units, and Prometheus histogram
  shapes.

Only one collector is active at a time. The SDK does not emit legacy and
canonical metrics at the same time.

Metrics are created lazily. A metric appears in `/metrics` only after the
corresponding worker event or collector method records it. Some low-level
surface metrics, such as ack, queue-full, paused, and uncaught-exception
counters, may not appear in normal worker runs unless that path is exercised.

## Usage

Create a metrics collector, start a scrape server, and wire the collector into
`TaskHandler` as an event listener:

```typescript
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
// GET http://localhost:9090/metrics  — Prometheus text format
// GET http://localhost:9090/health   — {"status":"UP"}
```

`createMetricsCollector()` reads `WORKER_CANONICAL_METRICS` and returns either
a `LegacyMetricsCollector` or a `CanonicalMetricsCollector`. Both implement
`MetricsCollectorInterface`, so call sites never need to know which variant is
active.

You can also construct a collector directly if you need to pass configuration:

```typescript
import { LegacyMetricsCollector } from "@io-orkes/conductor-javascript";

const metrics = new LegacyMetricsCollector({
  httpPort: 9090,
  filePath: "/tmp/conductor_metrics.prom",
  fileWriteIntervalMs: 10000,
  usePromClient: true,
});
```

### File Output

```typescript
const metrics = createMetricsCollector({
  filePath: "/tmp/conductor_metrics.prom",
  fileWriteIntervalMs: 10000,
});
```

The file writer performs an immediate first write, then writes periodically at
the configured interval. The timer is unreferenced so it does not prevent
Node.js process exit.

### prom-client Integration

```typescript
const metrics = createMetricsCollector({ usePromClient: true });
// Metrics are registered in prom-client's default registry.
// Use prom-client's register.metrics() for native scraping.
```

Requires `npm install prom-client`. Falls back to built-in text format if
prom-client is not installed.

## Selecting Canonical Metrics

Set `WORKER_CANONICAL_METRICS` before the worker starts:

```shell
WORKER_CANONICAL_METRICS=true node my_worker.js
```

Accepted true values are `true`, `1`, and `yes`, case-insensitive. Any other
value, or an unset variable, selects legacy metrics. The variable is read when
the metrics collector is created, so changing it requires a worker restart.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `prefix` | `string` | `"conductor_worker"` | Prometheus metric name prefix. Legacy only; canonical metrics are unprefixed. |
| `httpPort` | `number` | — | Start built-in HTTP server on this port. |
| `filePath` | `string` | — | Periodically write metrics to this file path. |
| `fileWriteIntervalMs` | `number` | `5000` | File write interval in milliseconds. |
| `slidingWindowSize` | `number` | `1000` | Max observations for quantile calculation. Legacy only; canonical uses histogram buckets. |
| `usePromClient` | `boolean` | `false` | Use `prom-client` for native Prometheus integration. |

## Canonical Metrics

Canonical timing values are seconds. Canonical size values are bytes. Label
names use camelCase.

### Canonical Counters

| Metric | Labels | Description |
|---|---|---|
| `task_poll_total` | `taskType` | Incremented each time the worker issues a poll request. |
| `task_execution_started_total` | `taskType` | Incremented when a polled task is dispatched to the worker function. |
| `task_poll_error_total` | `taskType`, `exception` | Incremented when a poll request fails client-side. |
| `task_execute_error_total` | `taskType`, `exception` | Incremented when the worker function throws. |
| `task_update_error_total` | `taskType`, `exception` | Incremented when updating the task result fails. |
| `task_ack_error_total` | `taskType`, `exception` | Collector surface for task ack errors. The internal runner uses batch poll responses as ack and may not emit this during normal polling. |
| `task_ack_failed_total` | `taskType` | Collector surface for failed task ack responses. The internal runner uses batch poll responses as ack and may not emit this during normal polling. |
| `task_execution_queue_full_total` | `taskType` | Incremented when the worker execution queue is saturated. |
| `task_paused_total` | `taskType` | Incremented when a worker is paused and skips acting on a poll. |
| `thread_uncaught_exceptions_total` | `exception` | Incremented on uncaught exceptions in the worker process. |
| `external_payload_used_total` | `entityName`, `operation`, `payloadType` | Incremented when external payload storage is used for task or workflow payloads. |
| `workflow_start_error_total` | `workflowType`, `exception` | Incremented when starting a workflow fails client-side. |

### Canonical Time Histograms

All canonical time histograms use buckets:
`0.001`, `0.005`, `0.01`, `0.025`, `0.05`, `0.1`, `0.25`, `0.5`, `1`, `2.5`,
`5`, `10`.

| Metric | Labels | Description |
|---|---|---|
| `task_poll_time_seconds` | `taskType`, `status` | Poll request latency. `status` is `SUCCESS` or `FAILURE`. |
| `task_execute_time_seconds` | `taskType`, `status` | Worker function execution duration. `status` is `SUCCESS` or `FAILURE`. |
| `task_update_time_seconds` | `taskType`, `status` | Task-result update latency. `status` is `SUCCESS` or `FAILURE`. |
| `http_api_client_request_seconds` | `method`, `uri`, `status` | API-client HTTP request latency. `status` is the HTTP status code as a string, or `"0"` on network failure. |

Each histogram exposes Prometheus series such as:

```prometheus
task_execute_time_seconds_bucket{taskType="my_task",status="SUCCESS",le="0.1"} 42
task_execute_time_seconds_count{taskType="my_task",status="SUCCESS"} 50
task_execute_time_seconds_sum{taskType="my_task",status="SUCCESS"} 2.3
```

### Canonical Size Histograms

All canonical size histograms use buckets:
`100`, `1000`, `10000`, `100000`, `1000000`, `10000000`.

| Metric | Labels | Description |
|---|---|---|
| `task_result_size_bytes` | `taskType` | Serialized task result output size. |
| `workflow_input_size_bytes` | `workflowType`, `version` | Serialized workflow input size. `version` is an empty string when not provided. |

### Canonical Gauges

| Metric | Labels | Description |
|---|---|---|
| `active_workers` | `taskType` | Current number of workers actively executing tasks. |

## Legacy Metrics

Legacy mode is the default so existing dashboards and alerts continue to work.
The default metric name prefix is `conductor_worker`. The prefix is configurable
via the `prefix` option on `MetricsCollectorConfig`.

Distribution metrics are sliding-window summaries over the latest 1,000
observations (configurable via `slidingWindowSize`), exposing quantiles at
p50, p75, p90, p95, and p99. Legacy distribution metrics also expose `_count`
and `_sum` series.

### Legacy Counters

| Metric | Labels | Description |
|---|---|---|
| `conductor_worker_task_poll_total` | `task_type` | Incremented each time polling is done. |
| `conductor_worker_task_poll_error_total` | `task_type` | Incremented when a poll request fails. |
| `conductor_worker_task_execute_total` | `task_type` | Incremented when a task execution completes. |
| `conductor_worker_task_execute_error_total` | `task_type` | Task execution errors. Label format: `taskType:ExceptionName`. |
| `conductor_worker_task_update_error_total` | `task_type` | Incremented when updating the task result fails. |
| `conductor_worker_task_ack_error_total` | `task_type` | Collector surface for task ack errors. |
| `conductor_worker_task_execution_queue_full_total` | `task_type` | Incremented when the execution queue is saturated. |
| `conductor_worker_task_paused_total` | `task_type` | Incremented when a worker is paused and skips a poll. |
| `conductor_worker_external_payload_used_total` | `payload_type` | External payload storage usage. |
| `conductor_worker_thread_uncaught_exceptions_total` | none | Uncaught exceptions in the worker process. |
| `conductor_worker_worker_restart_total` | none | Worker restart events. |
| `conductor_worker_workflow_start_error_total` | none | Workflow start errors. |

Legacy mode does not emit `task_execution_started_total`,
`task_ack_failed_total`, or `active_workers`.

### Legacy Time Metrics

Time values are milliseconds. Type is Summary.

| Metric | Labels | Description |
|---|---|---|
| `conductor_worker_task_poll_time` | `task_type` | Poll round-trip duration. |
| `conductor_worker_task_execute_time` | `task_type` | Worker function execution duration. |
| `conductor_worker_task_update_time` | `task_type` | Task result update duration. |

Each summary exposes quantile, count, and sum series:

```prometheus
conductor_worker_task_execute_time{task_type="my_task",quantile="0.5"} 102
conductor_worker_task_execute_time{task_type="my_task",quantile="0.95"} 250
conductor_worker_task_execute_time_count{task_type="my_task"} 1000
conductor_worker_task_execute_time_sum{task_type="my_task"} 120345
```

### Legacy Size Metrics

Type is Summary. Values are bytes.

| Metric | Labels | Description |
|---|---|---|
| `conductor_worker_task_result_size_bytes` | `task_type` | Task result output payload size. |
| `conductor_worker_workflow_input_size_bytes` | `workflow_type` | Workflow input payload size. |

### Legacy HTTP Metrics

| Metric | Labels | Description |
|---|---|---|
| `conductor_worker_http_api_client_request` | `endpoint` | API request duration in milliseconds. The `endpoint` label is a compound `"METHOD:/api/path:STATUS"` string. |

## Labels

| Label | Used by | Values |
|---|---|---|
| `task_type` | Legacy worker metrics | Task definition name. |
| `taskType` | Canonical worker metrics | Task definition name. |
| `workflowType` | Canonical workflow metrics | Workflow definition name. |
| `workflow_type` | Legacy `conductor_worker_workflow_input_size_bytes` | Workflow definition name. |
| `version` | Canonical `workflow_input_size_bytes` | Workflow version as a string. Empty string when not provided. |
| `status` | Canonical task time histograms | `SUCCESS` or `FAILURE`. For `http_api_client_request_seconds`, the HTTP status code as a string, or `"0"` on network failure. |
| `exception` | Canonical error counters | Exception type name, such as `TypeError`. Derived from `error.name` or `error.constructor.name`. |
| `entityName` | Canonical `external_payload_used_total` | Task type or workflow name associated with the external payload. |
| `operation` | Canonical `external_payload_used_total` | External payload operation, such as `READ` or `WRITE`. |
| `payload_type` | Legacy `conductor_worker_external_payload_used_total` | Payload type, such as `workflow_input` or `task_output`. |
| `payloadType` | Canonical `external_payload_used_total` | Payload type, such as `TASK_INPUT`, `TASK_OUTPUT`, `WORKFLOW_INPUT`, or `WORKFLOW_OUTPUT`. |
| `method` | Canonical HTTP metrics | HTTP verb. |
| `uri` | Canonical HTTP metrics | Request path. May contain interpolated identifiers. |
| `endpoint` | Legacy HTTP metrics | Compound `"METHOD:/api/path:STATUS"` string. |
| `quantile` | Legacy time and size metrics | `0.5`, `0.75`, `0.9`, `0.95`, or `0.99`. |

## Migrating From Legacy to Canonical

Canonical mode is opt-in during the deprecation period. Before switching a
production worker, update dashboards and alerts against a staging worker with
`WORKER_CANONICAL_METRICS=true`.

Key changes:

- The `conductor_worker_` prefix is removed. Canonical metric names are
  unprefixed.
- Legacy task labels use `task_type`; canonical task labels use `taskType`.
- Legacy time metrics are millisecond summaries with quantiles. Canonical time
  metrics are second-based histograms with bucket boundaries. Query `_bucket`
  series with `histogram_quantile()` instead of reading `{quantile="..."}`
  gauges.
- Legacy size metrics are summaries. Canonical size metrics are histograms.
- Canonical error counters add an `exception` label containing the exception
  type name.
- Canonical time histograms add a `status` label (`SUCCESS` or `FAILURE`).
- Canonical mode adds metrics that legacy mode never emits:
  `task_execution_started_total`, `task_ack_failed_total`, and
  `active_workers`.
- Legacy `conductor_worker_worker_restart_total` is not emitted in canonical
  mode (Node.js single-process model).
- Legacy uses `payload_type`; canonical uses `payloadType`.
- Legacy HTTP metrics use a compound `endpoint` label; canonical uses separate
  `method`, `uri`, and `status` labels.
- Canonical and legacy collectors are mutually exclusive. During a migration,
  compare scrape output by running separate worker instances or environments
  with and without `WORKER_CANONICAL_METRICS=true`.

Legacy-to-canonical replacements:

| Legacy metric | Canonical replacement |
|---|---|
| `conductor_worker_task_poll_total{task_type}` | `task_poll_total{taskType}` |
| `conductor_worker_task_poll_error_total{task_type}` | `task_poll_error_total{taskType,exception}` |
| `conductor_worker_task_execute_total{task_type}` | `task_execute_time_seconds{taskType,status}` (count from histogram) and `task_execution_started_total{taskType}` |
| `conductor_worker_task_execute_error_total{task_type}` | `task_execute_error_total{taskType,exception}` |
| `conductor_worker_task_update_error_total{task_type}` | `task_update_error_total{taskType,exception}` |
| `conductor_worker_task_poll_time{task_type}` (summary, ms) | `task_poll_time_seconds{taskType,status}` (histogram, seconds) |
| `conductor_worker_task_execute_time{task_type}` (summary, ms) | `task_execute_time_seconds{taskType,status}` (histogram, seconds) |
| `conductor_worker_task_update_time{task_type}` (summary, ms) | `task_update_time_seconds{taskType,status}` (histogram, seconds) |
| `conductor_worker_task_result_size_bytes{task_type}` (summary) | `task_result_size_bytes{taskType}` (histogram) |
| `conductor_worker_workflow_input_size_bytes{workflow_type}` (summary) | `workflow_input_size_bytes{workflowType,version}` (histogram) |
| `conductor_worker_http_api_client_request{endpoint}` (summary, ms) | `http_api_client_request_seconds{method,uri,status}` (histogram, seconds) |
| `conductor_worker_external_payload_used_total{payload_type}` | `external_payload_used_total{entityName,operation,payloadType}` |
| `conductor_worker_workflow_start_error_total` (no labels) | `workflow_start_error_total{workflowType,exception}` |
| `conductor_worker_worker_restart_total` | — (not emitted in canonical mode) |

Common PromQL replacements:

| Legacy | Canonical |
|---|---|
| `conductor_worker_task_execute_time{quantile="0.95"}` | `histogram_quantile(0.95, sum by (le, taskType, status) (rate(task_execute_time_seconds_bucket[5m])))` |
| `conductor_worker_task_poll_time{quantile="0.95"}` | `histogram_quantile(0.95, sum by (le, taskType, status) (rate(task_poll_time_seconds_bucket[5m])))` |
| `conductor_worker_http_api_client_request{quantile="0.95"}` | `histogram_quantile(0.95, sum by (le, method, uri, status) (rate(http_api_client_request_seconds_bucket[5m])))` |
| `conductor_worker_task_result_size_bytes{quantile="0.95"}` | `histogram_quantile(0.95, sum by (le, taskType) (rate(task_result_size_bytes_bucket[5m])))` |

Average latency queries continue to use `_sum` divided by `_count`, but the
canonical series are cumulative histogram counters:

```promql
sum(rate(task_execute_time_seconds_sum[5m])) by (taskType)
/
sum(rate(task_execute_time_seconds_count[5m])) by (taskType)
```

## Troubleshooting

### Metrics Are Empty

- Verify that `createMetricsCollector()` or a collector constructor is called
  and the collector is passed to `TaskHandler` via `eventListeners`.
- Verify workers have polled or executed tasks. Metrics are created lazily when
  the relevant event occurs.
- Confirm the scrape endpoint is reachable at the expected host and port.

### Missing HTTP or Workflow Metrics

- `http_api_client_request_seconds` (canonical) or
  `conductor_worker_http_api_client_request` (legacy) is recorded from the
  `fetchWithRetry` HTTP layer. Verify the collector is constructed before HTTP
  calls begin.
- `workflow_input_size_bytes` and `workflow_start_error_total` are recorded in
  `WorkflowExecutor`. Verify the collector is active before starting workflows.

### High Cardinality

- Watch the `uri` label (canonical) or `endpoint` label (legacy) on HTTP
  metrics. The SDK records the interpolated request path, which may include
  task type names or workflow IDs.
- Prefer canonical mode for bounded `exception` labels. Legacy error counters
  encode exception names in the Map key, not as a proper Prometheus label.
- Avoid embedding user identifiers or unbounded values in task type, workflow
  type, or external payload labels.

### Recording Uncaught Exceptions

The `thread_uncaught_exceptions_total` metric is not wired automatically. In
Node.js, registering a `process.on("uncaughtException")` handler overrides the
default crash behavior, which can leave the process running in a corrupted
state. Instead, wire it yourself so you control the exit policy:

```typescript
const metrics = createMetricsCollector();

process.on("uncaughtException", (err) => {
  metrics.recordUncaughtException(err.name || "Error");
  console.error(err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  const name = reason instanceof Error ? reason.name || "Error" : "Error";
  metrics.recordUncaughtException(name);
  console.error(reason);
  process.exit(1);
});
```

### prom-client Issues

- `MetricsCollector` uses `await import("./MetricsServer.js")` internally. The
  `.js` extension does not resolve under Jest's TypeScript transform. Test
  `MetricsServer` by importing it directly, not via the `httpPort` config
  option.
- When `usePromClient: true` is set but `prom-client` is not installed, the
  collector falls back to the built-in text format silently.
