# Metrics Reference

The Conductor JavaScript SDK provides built-in Prometheus metrics for monitoring worker performance, API latency, and task execution.

## Overview

`MetricsCollector` implements `TaskRunnerEventsListener` and records **18 metric types** (12 counters + 6 summaries). Metrics are exposed in [Prometheus exposition format](https://prometheus.io/docs/instrumenting/exposition_formats/).

- **Default prefix:** `conductor_worker`
- **Quantiles:** p50, p75, p90, p95, p99 (computed from a sliding window)
- **Sliding window:** Last 1,000 observations (configurable)

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
| `prefix` | `string` | `"conductor_worker"` | Prometheus metric name prefix |
| `httpPort` | `number` | — | Start built-in HTTP server on this port |
| `filePath` | `string` | — | Periodically write metrics to this file path |
| `fileWriteIntervalMs` | `number` | `5000` | File write interval in milliseconds |
| `slidingWindowSize` | `number` | `1000` | Max observations kept for quantile calculation |
| `usePromClient` | `boolean` | `false` | Use `prom-client` for native Prometheus integration |

---

## Counter Metrics

### Labeled by `task_type`

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

### Labeled by `payload_type`

| Prometheus Name | Internal Key | Description |
|----------------|-------------|-------------|
| `{prefix}_external_payload_used_total` | `externalPayloadUsedTotal` | External payload storage usage (e.g., `"workflow_input"`, `"task_output"`) |

### Global (no labels)

| Prometheus Name | Internal Key | Description |
|----------------|-------------|-------------|
| `{prefix}_thread_uncaught_exceptions_total` | `uncaughtExceptionTotal` | Total uncaught exceptions in worker processes |
| `{prefix}_worker_restart_total` | `workerRestartTotal` | Total worker restart events |
| `{prefix}_workflow_start_error_total` | `workflowStartErrorTotal` | Total workflow start errors |

---

## Summary Metrics

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

### Labeled by `task_type`

| Prometheus Name | Internal Key | Unit | Description |
|----------------|-------------|------|-------------|
| `{prefix}_task_poll_time` | `pollDurationMs` | ms | Task poll round-trip duration |
| `{prefix}_task_execute_time` | `executionDurationMs` | ms | Worker function execution duration |
| `{prefix}_task_update_time` | `updateDurationMs` | ms | Task result update (SDK to server) duration |
| `{prefix}_task_result_size_bytes` | `outputSizeBytes` | bytes | Task result output payload size |

### Labeled by `workflow_type`

| Prometheus Name | Internal Key | Unit | Description |
|----------------|-------------|------|-------------|
| `{prefix}_workflow_input_size_bytes` | `workflowInputSizeBytes` | bytes | Workflow input payload size |

### Labeled by `endpoint`

| Prometheus Name | Internal Key | Unit | Description |
|----------------|-------------|------|-------------|
| `{prefix}_http_api_client_request` | `apiRequestDurationMs` | ms | API request duration. Label format: `METHOD:/api/path:STATUS` |

---

## Event Listener Methods

These methods are called automatically by the `TaskRunner` when `MetricsCollector` is registered as an event listener:

| Method | Metrics Updated |
|--------|----------------|
| `onPollStarted(event)` | Increments `pollTotal` |
| `onPollCompleted(event)` | Records `pollDurationMs` |
| `onPollFailure(event)` | Increments `pollErrorTotal`, records `pollDurationMs` |
| `onTaskExecutionStarted(event)` | _(no-op, counted on completion)_ |
| `onTaskExecutionCompleted(event)` | Increments `taskExecutionTotal`, records `executionDurationMs` and `outputSizeBytes` |
| `onTaskExecutionFailure(event)` | Increments `taskExecutionErrorTotal`, records `executionDurationMs` |
| `onTaskUpdateCompleted(event)` | Records `updateDurationMs` |
| `onTaskUpdateFailure(event)` | Increments `taskUpdateFailureTotal` |

## Direct Recording Methods

For metrics outside the event listener system, call these methods directly:

```typescript
const collector = new MetricsCollector();

collector.recordTaskExecutionQueueFull("my_task");
collector.recordUncaughtException();
collector.recordWorkerRestart();
collector.recordTaskPaused("my_task");
collector.recordTaskAckError("my_task");
collector.recordWorkflowStartError();
collector.recordExternalPayloadUsed("task_output");
collector.recordWorkflowInputSize("my_workflow", 2048);
collector.recordApiRequestTime("POST", "/api/tasks", 200, 35);
```

## Exposition Formats

### Built-in Prometheus Text

```typescript
const text = collector.toPrometheusText();
// Returns Prometheus text format (text/plain; version=0.0.4)
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

## Sliding Window and Quantile Calculation

Summary metrics use a **sliding window** (default: 1,000 observations) to calculate percentiles. This provides:

- Accurate recent percentiles without unbounded memory growth
- No need to pre-configure histogram bucket boundaries
- Direct percentile values without interpolation artifacts

Quantiles are computed on-demand using linear interpolation on sorted observations when `toPrometheusText()` is called.

When using `prom-client` (`usePromClient: true`), summaries use prom-client's native implementation with `maxAgeSeconds: 600` and `ageBuckets: 5`.

---

## Monitoring Best Practices

- **Use p95/p99 for SLO monitoring** rather than averages. Percentile-based thresholds better capture user-impacting performance variations.
- **Alert on `task_update_error_total`** — a rising count indicates task results are being lost and workers are failing to report back to the Conductor server.
- **Alert on `task_execution_queue_full_total`** — indicates the concurrency limit is consistently reached. Consider increasing worker `concurrency`.
- **Monitor `task_poll_time` p99** — high poll latency suggests network issues or server overload.
- **Monitor `task_execute_time` p95** — watch for execution time regression in worker functions.
- **File output interval**: 10-60 seconds recommended for production. Lower intervals increase disk I/O.
- **Clean metrics directory on startup** when using file output with multiprocess workers to avoid stale data.

---

## Programmatic Access

```typescript
const metrics = collector.getMetrics();

// Counter values
metrics.pollTotal.get("my_task");           // number
metrics.taskExecutionTotal.get("my_task");  // number

// Summary observations (raw array)
metrics.pollDurationMs.get("my_task");      // number[]
metrics.executionDurationMs.get("my_task"); // number[]

// Reset all metrics
collector.reset();

// Stop file writer and HTTP server
await collector.stop();
```
