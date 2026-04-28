# Metrics Reference

The Conductor JavaScript SDK provides built-in Prometheus metrics for monitoring worker performance, API latency, and task execution.

## Metrics Harmonization (Phase 1)

As of this release, the SDK emits **two sets of metrics side-by-side**:

- **Legacy metrics** — prefixed with `conductor_worker_`, using `task_type` (snake_case) labels, millisecond time units, and Prometheus `Summary` type for timing/size metrics. These are the metrics that were emitted prior to harmonization.
- **Canonical metrics** — unprefixed, using `taskType` (camelCase) labels, seconds time units, and Prometheus `Histogram` type for timings. These match the canonical catalog shared across all Conductor SDKs (Go, Python, Java, Ruby, Rust, JavaScript).

Both sets are emitted simultaneously so existing dashboards continue working while consumers migrate to the canonical names. Legacy metrics will be marked as deprecated in Phase 2 and removed in Phase 3.

**Breaking shape changes in canonical metrics:**
- Time metrics use `Histogram` (`_bucket{le=}`) instead of `Summary` (`{quantile=}`). Consumers querying quantile labels must switch to `histogram_quantile(0.5, rate(..._bucket[5m]))`.
- `task_result_size_bytes` and `workflow_input_size_bytes` are Gauges (last-value) in canonical, instead of Summaries.

## Overview

`MetricsCollector` implements `TaskRunnerEventsListener` and records **18 legacy metric types** plus **20 canonical metric types**. Metrics are exposed in [Prometheus exposition format](https://prometheus.io/docs/instrumenting/exposition_formats/).

- **Legacy prefix:** `conductor_worker` (configurable)
- **Canonical prefix:** none (unprefixed, matching the canonical catalog)
- **Legacy quantiles:** p50, p75, p90, p95, p99 (computed from a sliding window)
- **Canonical histogram buckets:** 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10 (seconds)
- **Sliding window (legacy):** Last 1,000 observations (configurable)

## Quick Start

### HTTP Server

```typescript
import { MetricsCollector, MetricsServer, TaskHandler } from "@io-orkes/conductor-javascript";

const metrics = new MetricsCollector({ httpPort: 9090 });

const handler = new TaskHandler({
  client,
  scanForDecorated: true,
  eventListeners: [metrics],
});

await handler.startWorkers();
// GET http://localhost:9090/metrics  — Prometheus text format
// GET http://localhost:9090/health   — { "status": "UP" }
```

### File Output

```typescript
const metrics = new MetricsCollector({
  filePath: "/tmp/conductor_metrics.prom",
  fileWriteIntervalMs: 10000, // write every 10s
});
```

The file writer performs an immediate first write, then writes periodically at the configured interval. The timer is unreferenced so it does not prevent Node.js process exit.

### prom-client Integration

```typescript
const metrics = new MetricsCollector({ usePromClient: true });
// Metrics are registered in prom-client's default registry.
// Use prom-client's register.metrics() for native scraping.
```

Requires `npm install prom-client`. Falls back to built-in text format if not installed.

### All-in-One

```typescript
const metrics = new MetricsCollector({
  prefix: "myapp_worker",
  httpPort: 9090,
  filePath: "/tmp/metrics.prom",
  fileWriteIntervalMs: 10000,
  slidingWindowSize: 500,
  usePromClient: true,
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `prefix` | `string` | `"conductor_worker"` | Prometheus metric name prefix (legacy metrics only) |
| `httpPort` | `number` | — | Start built-in HTTP server on this port |
| `filePath` | `string` | — | Periodically write metrics to this file path |
| `fileWriteIntervalMs` | `number` | `5000` | File write interval in milliseconds |
| `slidingWindowSize` | `number` | `1000` | Max observations kept for quantile calculation (legacy only) |
| `usePromClient` | `boolean` | `false` | Use `prom-client` for native Prometheus integration |

---

## Canonical Metrics

These are the harmonized metrics matching the canonical catalog. All SDKs emit these same names and label shapes.

### Counters

| Prometheus Name | Labels | Description |
|----------------|--------|-------------|
| `task_poll_total` | `taskType` | Total task polls initiated |
| `task_execution_started_total` | `taskType` | Total task executions started (dispatched to worker function) |
| `task_poll_error_total` | `taskType, exception` | Total failed task polls |
| `task_execute_error_total` | `taskType, exception` | Total task execution errors |
| `task_update_error_total` | `taskType, exception` | Total task result update failures |
| `task_ack_error_total` | `taskType, exception` | Total task ack errors (surface-only; internal runner N/A) |
| `task_ack_failed_total` | `taskType` | Total task ack failures from server (surface-only; internal runner N/A) |
| `task_execution_queue_full_total` | `taskType` | Execution queue full events (surface-only; Poller back-pressures) |
| `task_paused_total` | `taskType` | Poll cycles skipped due to pause state |
| `thread_uncaught_exceptions_total` | `exception` | Uncaught exceptions (wired to `process.on('uncaughtException')`) |
| `external_payload_used_total` | `entityName, operation, payloadType, payload_type` | External payload storage usage (surface-only). `payloadType` is canonical; `payload_type` is deprecated. |
| `workflow_start_error_total` | `workflowType, exception` | Workflow start errors |

### Histograms (seconds)

All histograms use bucket set: `(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10)`.

| Prometheus Name | Labels | Description |
|----------------|--------|-------------|
| `task_poll_time_seconds` | `taskType, status` | Task poll duration. `status` is `SUCCESS` or `FAILURE`. |
| `task_execute_time_seconds` | `taskType, status` | Worker function execution duration |
| `task_update_time_seconds` | `taskType, status` | Task result update duration |
| `http_api_client_request_seconds` | `method, uri, status` | HTTP API client request duration. `status` is the HTTP status code or `"0"` on network failure. |

### Gauges

| Prometheus Name | Labels | Description |
|----------------|--------|-------------|
| `task_result_size_bytes` | `taskType` | Last-value task result output size in bytes |
| `workflow_input_size_bytes` | `workflowType, version` | Last-value workflow input size in bytes |
| `active_workers` | `taskType` | Number of workers actively executing tasks |

---

## Legacy Metrics (Deprecated in Phase 2)

These metrics are retained for backward compatibility. They will be marked as deprecated in Phase 2 and removed in Phase 3.

### Counter Metrics

#### Labeled by `task_type`

| Prometheus Name | Internal Key | Description |
|----------------|-------------|-------------|
| `{prefix}_task_poll_total` | `pollTotal` | Total number of task polls initiated |
| `{prefix}_task_poll_error_total` | `pollErrorTotal` | Total number of failed task polls |
| `{prefix}_task_execute_total` | `taskExecutionTotal` | Total number of task executions completed |
| `{prefix}_task_execute_error_total` | `taskExecutionErrorTotal` | Total task execution errors. Label format: `taskType:ExceptionName` |
| `{prefix}_task_update_error_total` | `taskUpdateFailureTotal` | Total task result update failures (result lost from Conductor) |
| `{prefix}_task_ack_error_total` | `taskAckErrorTotal` | Total task acknowledgement errors |
| `{prefix}_task_execution_queue_full_total` | `taskExecutionQueueFullTotal` | Times the execution queue was full (concurrency limit reached) |
| `{prefix}_task_paused_total` | `taskPausedTotal` | Total task paused events |

#### Labeled by `payload_type` (legacy)

| Prometheus Name | Internal Key | Description |
|----------------|-------------|-------------|
| `{prefix}_external_payload_used_total` | `externalPayloadUsedTotal` | External payload storage usage |

#### Global (no labels)

| Prometheus Name | Internal Key | Description |
|----------------|-------------|-------------|
| `{prefix}_thread_uncaught_exceptions_total` | `uncaughtExceptionTotal` | Total uncaught exceptions in worker processes |
| `{prefix}_worker_restart_total` | `workerRestartTotal` | Total worker restart events |
| `{prefix}_workflow_start_error_total` | `workflowStartErrorTotal` | Total workflow start errors |

### Summary Metrics (legacy)

Each summary emits quantile values, a count, and a sum:

```
{name}{task_type="myTask",quantile="0.5"} 12.3
{name}{task_type="myTask",quantile="0.75"} 15.1
{name}{task_type="myTask",quantile="0.9"} 18.7
{name}{task_type="myTask",quantile="0.95"} 22.0
{name}{task_type="myTask",quantile="0.99"} 45.2
{name}_count{task_type="myTask"} 1000
{name}_sum{task_type="myTask"} 14523.7
```

#### Labeled by `task_type`

| Prometheus Name | Internal Key | Unit | Description |
|----------------|-------------|------|-------------|
| `{prefix}_task_poll_time` | `pollDurationMs` | ms | Task poll round-trip duration |
| `{prefix}_task_execute_time` | `executionDurationMs` | ms | Worker function execution duration |
| `{prefix}_task_update_time` | `updateDurationMs` | ms | Task result update (SDK to server) duration |
| `{prefix}_task_result_size_bytes` | `outputSizeBytes` | bytes | Task result output payload size |

#### Labeled by `workflow_type`

| Prometheus Name | Internal Key | Unit | Description |
|----------------|-------------|------|-------------|
| `{prefix}_workflow_input_size_bytes` | `workflowInputSizeBytes` | bytes | Workflow input payload size |

#### Labeled by `endpoint`

| Prometheus Name | Internal Key | Unit | Description |
|----------------|-------------|------|-------------|
| `{prefix}_http_api_client_request` | `apiRequestDurationMs` | ms | API request duration. Label format: `METHOD:/api/path:STATUS` |

---

## Event Listener Methods

These methods are called automatically by the `TaskRunner` when `MetricsCollector` is registered as an event listener:

| Method | Metrics Updated |
|--------|----------------|
| `onPollStarted(event)` | Increments `pollTotal` + canonical `task_poll_total` |
| `onPollCompleted(event)` | Records `pollDurationMs` + canonical `task_poll_time_seconds{status=SUCCESS}` |
| `onPollFailure(event)` | Increments `pollErrorTotal` + canonical `task_poll_error_total{exception}`, records timing |
| `onTaskExecutionStarted(event)` | Increments canonical `task_execution_started_total`, increments `active_workers` |
| `onTaskExecutionCompleted(event)` | Increments `taskExecutionTotal`, records timings + size, decrements `active_workers` |
| `onTaskExecutionFailure(event)` | Increments error counters with `exception` label, records timing, decrements `active_workers` |
| `onTaskUpdateCompleted(event)` | Records `updateDurationMs` + canonical `task_update_time_seconds{status=SUCCESS}` |
| `onTaskUpdateFailure(event)` | Increments `taskUpdateFailureTotal` + canonical `task_update_error_total{exception}` |
| `onTaskPaused(event)` | Increments `taskPausedTotal` + canonical `task_paused_total` |

## Direct Recording Methods

For metrics outside the event listener system, call these methods directly:

```typescript
const collector = new MetricsCollector();

collector.recordTaskExecutionQueueFull("my_task");
collector.recordUncaughtException("TypeError");
collector.recordWorkerRestart();
collector.recordTaskPaused("my_task");
collector.recordTaskAckError("my_task", "TimeoutError");
collector.recordTaskAckFailed("my_task");
collector.recordWorkflowStartError("my_workflow", "ConnectionError");
collector.recordExternalPayloadUsed("TASK_OUTPUT", "my_entity", "WRITE");
collector.recordWorkflowInputSize("my_workflow", 2048, "1");
collector.recordApiRequestTime("POST", "/api/tasks", 200, 35);
```

## Automatic Wiring

The following metrics are automatically wired without explicit method calls:

- **`http_api_client_request_seconds`** — Instrumented via `fetchWithRetry`. Every HTTP request made by the SDK to the Conductor server is observed. The `MetricsCollector` registers itself as a global HTTP metrics observer on construction.
- **`workflow_input_size_bytes`** and **`workflow_start_error_total`** — Instrumented via `WorkflowExecutor.startWorkflow()`. Input size is measured before sending; errors are recorded on failure.
- **`task_paused_total`** — Emitted by the `Poller` each time a poll cycle is skipped because the worker is paused.
- **`thread_uncaught_exceptions_total`** — Wired to `process.on('uncaughtException')` and `process.on('unhandledRejection')` by `TaskHandler` when a `MetricsCollector` is registered as an event listener.
- **`active_workers`** — Incremented on `TaskExecutionStarted`, decremented on completion/failure.

## Exposition Formats

### Built-in Prometheus Text

```typescript
const text = collector.toPrometheusText();
// Returns Prometheus text format (text/plain; version=0.0.4)
// Includes both legacy and canonical metrics
```

### Async (with prom-client support)

```typescript
const text = await collector.toPrometheusTextAsync();
// Uses prom-client registry when available, falls back to built-in
```

### HTTP Server (MetricsServer)

```typescript
import { MetricsServer } from "@io-orkes/conductor-javascript";

const server = new MetricsServer(collector, 9090);
await server.start();
// GET /metrics — Content-Type from collector.getContentType()
// GET /health  — { "status": "UP" }
await server.stop();
```

### File Output

Configured via `filePath` in `MetricsCollectorConfig`. Writes `toPrometheusText()` output to disk. The file writer performs an immediate first write on construction, then writes periodically at the configured interval.

---

## Sliding Window and Quantile Calculation (Legacy)

Legacy summary metrics use a **sliding window** (default: 1,000 observations) to calculate percentiles. This provides:

- Accurate recent percentiles without unbounded memory growth
- No need to pre-configure histogram bucket boundaries
- Direct percentile values without interpolation artifacts

Quantiles are computed on-demand using linear interpolation on sorted observations when `toPrometheusText()` is called.

When using `prom-client` (`usePromClient: true`), summaries use prom-client's native implementation with `maxAgeSeconds: 600` and `ageBuckets: 5`.

Canonical metrics use Histogram type instead, which provides:

- Aggregatable percentiles across replicas via `histogram_quantile()`
- Standard Prometheus bucket-based distribution tracking
- No pre-aggregated quantile computation per-process

---

## Runtime Model: N/A Metrics

Some canonical metrics are registered with helper methods but never fired by the internal worker runtime:

| Metric | Reason |
|--------|--------|
| `task_ack_error_total` / `task_ack_failed_total` | The JS SDK's batch-poll response functions as the ack — no separate ack call exists. |
| `task_execution_queue_full_total` | The `Poller` back-pressures by not polling when concurrency is maxed, rather than rejecting. |
| `worker_restart_total` | Node.js single-process model — no multi-process supervisor. |
| `external_payload_used_total` | The JS SDK does not integrate with the external-payload-storage branch of the Conductor API. |

These helpers are retained as canonical API surface so user code that layers on its own ack/queue/storage semantics can emit the counters.

---

## `uri` Label on `http_api_client_request_seconds`

The `uri` label currently contains the **interpolated** request path (e.g., `/api/tasks/poll/batch/my_task_type`) rather than the path template (`/api/tasks/poll/batch/{taskType}`). Template extraction is deferred to Phase 4 of the harmonization plan. Operators who need bounded cardinality today should apply Prometheus `metric_relabel_configs` at scrape time.

---

## Programmatic Access

```typescript
const metrics = collector.getMetrics();

// Counter values (legacy)
metrics.pollTotal.get("my_task");           // number
metrics.taskExecutionTotal.get("my_task");  // number

// Summary observations (raw array, legacy)
metrics.pollDurationMs.get("my_task");      // number[]
metrics.executionDurationMs.get("my_task"); // number[]

// Reset all metrics (legacy + canonical)
collector.reset();

// Stop file writer and HTTP server
await collector.stop();
```
