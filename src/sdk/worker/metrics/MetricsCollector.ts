import type {
  TaskRunnerEventsListener,
  PollStarted,
  PollCompleted,
  PollFailure,
  TaskExecutionStarted,
  TaskExecutionCompleted,
  TaskExecutionFailure,
  TaskUpdateCompleted,
  TaskUpdateFailure,
  TaskPaused,
} from "../../clients/worker/events";
import { setHttpMetricsObserver } from "./httpObserver";

/**
 * Configuration for MetricsCollector.
 */
export interface MetricsCollectorConfig {
  /** Prometheus metric name prefix (default: "conductor_worker") */
  prefix?: string;
  /** If set, auto-starts MetricsServer on this port */
  httpPort?: number;
  /** If set, periodically writes Prometheus metrics to this file path */
  filePath?: string;
  /** File write interval in milliseconds (default: 5000) */
  fileWriteIntervalMs?: number;
  /** Sliding window size for quantile calculations (default: 1000) */
  slidingWindowSize?: number;
  /**
   * Use prom-client for native Prometheus integration.
   * Requires `prom-client` to be installed (`npm install prom-client`).
   * When enabled, metrics are registered in prom-client's default registry
   * and `toPrometheusText()` delegates to `prom-client.register.metrics()`.
   * Falls back to custom text format if prom-client is not installed.
   */
  usePromClient?: boolean;
}

/**
 * Collected worker metrics (legacy shape).
 */
export interface WorkerMetrics {
  /** Total polls by taskType */
  pollTotal: Map<string, number>;
  /** Poll errors by taskType */
  pollErrorTotal: Map<string, number>;
  /** Task executions completed by taskType */
  taskExecutionTotal: Map<string, number>;
  /** Task execution errors by "taskType:exceptionName" */
  taskExecutionErrorTotal: Map<string, number>;
  /** Task update failures by taskType */
  taskUpdateFailureTotal: Map<string, number>;
  /** Task ack errors by taskType */
  taskAckErrorTotal: Map<string, number>;
  /** Task execution queue full by taskType */
  taskExecutionQueueFullTotal: Map<string, number>;
  /** Thread/process uncaught exceptions (global counter) */
  uncaughtExceptionTotal: number;
  /** Worker restart count (global counter) */
  workerRestartTotal: number;
  /** Task paused count by taskType */
  taskPausedTotal: Map<string, number>;
  /** Workflow start errors */
  workflowStartErrorTotal: number;
  /** External payload used count by type (workflow_input/task_output) */
  externalPayloadUsedTotal: Map<string, number>;
  /** Poll duration observations in ms by taskType */
  pollDurationMs: Map<string, number[]>;
  /** Execution duration observations in ms by taskType */
  executionDurationMs: Map<string, number[]>;
  /** Update duration observations in ms by taskType */
  updateDurationMs: Map<string, number[]>;
  /** Output size observations in bytes by taskType */
  outputSizeBytes: Map<string, number[]>;
  /** Workflow input size observations in bytes */
  workflowInputSizeBytes: Map<string, number[]>;
  /** API request duration observations in ms by "method:uri:status" */
  apiRequestDurationMs: Map<string, number[]>;
}

// ── Canonical constants ──────────────────────────────────────────

const CANONICAL_BUCKETS = [
  0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
] as const;

const QUANTILES = [0.5, 0.75, 0.9, 0.95, 0.99] as const;

// ── Histogram accumulator ────────────────────────────────────────

/**
 * Serializable label set used as a Map key for multi-dimensional metrics.
 */
function labelKey(labels: Record<string, string>): string {
  const keys = Object.keys(labels).sort();
  return keys.map((k) => `${k}=${labels[k]}`).join(",");
}

interface HistogramSeries {
  labels: Record<string, string>;
  buckets: number[];
  count: number;
  sum: number;
}

/**
 * In-memory Prometheus Histogram accumulator.
 *
 * Tracks _bucket, _count, _sum per label set using the canonical bucket
 * boundaries. Renders to Prometheus text exposition format.
 */
class HistogramAccumulator {
  private readonly _boundaries: readonly number[];
  private _series = new Map<string, HistogramSeries>();

  constructor(boundaries: readonly number[] = CANONICAL_BUCKETS) {
    this._boundaries = boundaries;
  }

  observe(labels: Record<string, string>, value: number): void {
    const key = labelKey(labels);
    let s = this._series.get(key);
    if (!s) {
      s = {
        labels,
        buckets: new Array(this._boundaries.length).fill(0),
        count: 0,
        sum: 0,
      };
      this._series.set(key, s);
    }
    for (let i = 0; i < this._boundaries.length; i++) {
      if (value <= this._boundaries[i]) {
        s.buckets[i]++;
      }
    }
    s.count++;
    s.sum += value;
  }

  render(name: string, help: string): string {
    if (this._series.size === 0) return "";
    const lines: string[] = [];
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} histogram`);
    for (const s of this._series.values()) {
      const lblStr = renderLabels(s.labels);
      const sep = lblStr ? "," : "";
      for (let i = 0; i < this._boundaries.length; i++) {
        lines.push(
          `${name}_bucket{${lblStr}${sep}le="${this._boundaries[i]}"} ${s.buckets[i]}`
        );
      }
      lines.push(`${name}_bucket{${lblStr}${sep}le="+Inf"} ${s.count}`);
      lines.push(`${name}_sum{${lblStr}} ${s.sum}`);
      lines.push(`${name}_count{${lblStr}} ${s.count}`);
    }
    return lines.join("\n");
  }
}

// ── Multi-label counter ──────────────────────────────────────────

interface CounterSeries {
  labels: Record<string, string>;
  value: number;
}

class MultiLabelCounter {
  private _series = new Map<string, CounterSeries>();

  increment(labels: Record<string, string>, value = 1): void {
    const key = labelKey(labels);
    let s = this._series.get(key);
    if (!s) {
      s = { labels, value: 0 };
      this._series.set(key, s);
    }
    s.value += value;
  }

  render(name: string, help: string): string {
    if (this._series.size === 0) return "";
    const lines: string[] = [];
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} counter`);
    for (const s of this._series.values()) {
      lines.push(`${name}{${renderLabels(s.labels)}} ${s.value}`);
    }
    return lines.join("\n");
  }
}

// ── Gauge ────────────────────────────────────────────────────────

interface GaugeSeries {
  labels: Record<string, string>;
  value: number;
}

class GaugeMetric {
  private _series = new Map<string, GaugeSeries>();

  set(labels: Record<string, string>, value: number): void {
    const key = labelKey(labels);
    let s = this._series.get(key);
    if (!s) {
      s = { labels, value: 0 };
      this._series.set(key, s);
    }
    s.value = value;
  }

  inc(labels: Record<string, string>, delta = 1): void {
    const key = labelKey(labels);
    let s = this._series.get(key);
    if (!s) {
      s = { labels, value: 0 };
      this._series.set(key, s);
    }
    s.value += delta;
  }

  dec(labels: Record<string, string>, delta = 1): void {
    const key = labelKey(labels);
    let s = this._series.get(key);
    if (!s) {
      s = { labels, value: 0 };
      this._series.set(key, s);
    }
    s.value -= delta;
  }

  render(name: string, help: string): string {
    if (this._series.size === 0) return "";
    const lines: string[] = [];
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} gauge`);
    for (const s of this._series.values()) {
      lines.push(`${name}{${renderLabels(s.labels)}} ${s.value}`);
    }
    return lines.join("\n");
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function renderLabels(labels: Record<string, string>): string {
  return Object.entries(labels)
    .map(([k, v]) => `${k}="${v}"`)
    .join(",");
}

function computeQuantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = q * (sorted.length - 1);
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (pos - lower) * (sorted[upper] - sorted[lower]);
}

function exceptionLabel(error: unknown): string {
  if (error instanceof Error) {
    return error.name || error.constructor?.name || "Error";
  }
  return "Error";
}

// ── Canonical metric state ───────────────────────────────────────

interface CanonicalMetrics {
  // Counters
  taskPollTotal: MultiLabelCounter;
  taskExecutionStartedTotal: MultiLabelCounter;
  taskPollErrorTotal: MultiLabelCounter;
  taskExecuteErrorTotal: MultiLabelCounter;
  taskUpdateErrorTotal: MultiLabelCounter;
  taskAckErrorTotal: MultiLabelCounter;
  taskAckFailedTotal: MultiLabelCounter;
  taskExecutionQueueFullTotal: MultiLabelCounter;
  taskPausedTotal: MultiLabelCounter;
  threadUncaughtExceptionsTotal: MultiLabelCounter;
  externalPayloadUsedTotal: MultiLabelCounter;
  workflowStartErrorTotal: MultiLabelCounter;

  // Histograms (seconds)
  taskPollTimeSeconds: HistogramAccumulator;
  taskExecuteTimeSeconds: HistogramAccumulator;
  taskUpdateTimeSeconds: HistogramAccumulator;
  httpApiClientRequestSeconds: HistogramAccumulator;

  // Gauges
  taskResultSizeBytes: GaugeMetric;
  workflowInputSizeBytes: GaugeMetric;
  activeWorkers: GaugeMetric;
}

/**
 * Built-in metrics collector implementing TaskRunnerEventsListener.
 *
 * Emits both legacy metrics (prefixed, task_type label, ms, Summary) and
 * canonical metrics (unprefixed, taskType label, seconds, Histogram/Gauge)
 * for Phase 1 dual-emit harmonization.
 *
 * @example
 * ```typescript
 * const metrics = new MetricsCollector({ httpPort: 9090 });
 *
 * const handler = new TaskHandler({
 *   client,
 *   eventListeners: [metrics],
 * });
 *
 * await handler.startWorkers();
 * // GET http://localhost:9090/metrics  — Prometheus format
 * // GET http://localhost:9090/health   — {"status":"UP"}
 * ```
 */
export class MetricsCollector implements TaskRunnerEventsListener {
  private metrics: WorkerMetrics;
  private canonical: CanonicalMetrics;
  private readonly _prefix: string;
  private readonly _slidingWindowSize: number;
  private _server?: import("./MetricsServer.js").MetricsServer;
  private _fileTimer?: ReturnType<typeof setInterval>;
  private _promRegistry?: import("./PrometheusRegistry.js").PrometheusRegistry;

  constructor(config?: MetricsCollectorConfig) {
    this.metrics = this.createEmptyMetrics();
    this.canonical = this.createEmptyCanonical();
    this._prefix = config?.prefix ?? "conductor_worker";
    this._slidingWindowSize = config?.slidingWindowSize ?? 1000;
    if (config?.usePromClient) {
      void this.initPromClient();
    }
    if (config?.httpPort) {
      void this.startServer(config.httpPort);
    }
    if (config?.filePath) {
      this.startFileWriter(
        config.filePath,
        config.fileWriteIntervalMs ?? 5000
      );
    }
    // Register as the global HTTP metrics observer so fetchWithRetry can
    // record http_api_client_request_seconds without explicit wiring.
    setHttpMetricsObserver(this);
  }

  private async initPromClient(): Promise<void> {
    const { PrometheusRegistry } = await import("./PrometheusRegistry.js");
    this._promRegistry = new PrometheusRegistry();
    await this._promRegistry.initialize(this._prefix);
  }

  private async startServer(port: number): Promise<void> {
    const { MetricsServer } = await import("./MetricsServer.js");
    this._server = new MetricsServer(this, port);
    await this._server.start();
  }

  private startFileWriter(filePath: string, intervalMs: number): void {
    const doWrite = async () => {
      try {
        const { writeFile } = await import("node:fs/promises");
        await writeFile(filePath, this.toPrometheusText(), "utf-8");
      } catch {
        // Silently ignore file write errors
      }
    };
    void doWrite();
    this._fileTimer = setInterval(doWrite, intervalMs);
    if (typeof this._fileTimer === "object" && "unref" in this._fileTimer) {
      this._fileTimer.unref();
    }
  }

  private createEmptyMetrics(): WorkerMetrics {
    return {
      pollTotal: new Map(),
      pollErrorTotal: new Map(),
      taskExecutionTotal: new Map(),
      taskExecutionErrorTotal: new Map(),
      taskUpdateFailureTotal: new Map(),
      taskAckErrorTotal: new Map(),
      taskExecutionQueueFullTotal: new Map(),
      uncaughtExceptionTotal: 0,
      workerRestartTotal: 0,
      taskPausedTotal: new Map(),
      workflowStartErrorTotal: 0,
      externalPayloadUsedTotal: new Map(),
      pollDurationMs: new Map(),
      executionDurationMs: new Map(),
      updateDurationMs: new Map(),
      outputSizeBytes: new Map(),
      workflowInputSizeBytes: new Map(),
      apiRequestDurationMs: new Map(),
    };
  }

  private createEmptyCanonical(): CanonicalMetrics {
    return {
      taskPollTotal: new MultiLabelCounter(),
      taskExecutionStartedTotal: new MultiLabelCounter(),
      taskPollErrorTotal: new MultiLabelCounter(),
      taskExecuteErrorTotal: new MultiLabelCounter(),
      taskUpdateErrorTotal: new MultiLabelCounter(),
      taskAckErrorTotal: new MultiLabelCounter(),
      taskAckFailedTotal: new MultiLabelCounter(),
      taskExecutionQueueFullTotal: new MultiLabelCounter(),
      taskPausedTotal: new MultiLabelCounter(),
      threadUncaughtExceptionsTotal: new MultiLabelCounter(),
      externalPayloadUsedTotal: new MultiLabelCounter(),
      workflowStartErrorTotal: new MultiLabelCounter(),

      taskPollTimeSeconds: new HistogramAccumulator(),
      taskExecuteTimeSeconds: new HistogramAccumulator(),
      taskUpdateTimeSeconds: new HistogramAccumulator(),
      httpApiClientRequestSeconds: new HistogramAccumulator(),

      taskResultSizeBytes: new GaugeMetric(),
      workflowInputSizeBytes: new GaugeMetric(),
      activeWorkers: new GaugeMetric(),
    };
  }

  // ── Legacy helpers ─────────────────────────────────────────────

  private increment(map: Map<string, number>, key: string): void {
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  private observe(
    map: Map<string, number[]>,
    key: string,
    value: number
  ): void {
    let arr = map.get(key);
    if (!arr) {
      arr = [];
      map.set(key, arr);
    }
    arr.push(value);
    if (arr.length > this._slidingWindowSize) {
      arr.splice(0, arr.length - this._slidingWindowSize);
    }
  }

  private incrementCounter(
    map: Map<string, number>,
    key: string,
    promKey: string,
    labelName: string
  ): void {
    this.increment(map, key);
    this._promRegistry?.incrementCounter(promKey, { [labelName]: key });
  }

  private observeSummary(
    map: Map<string, number[]>,
    key: string,
    value: number,
    promKey: string,
    labelName: string
  ): void {
    this.observe(map, key, value);
    this._promRegistry?.observeSummary(promKey, { [labelName]: key }, value);
  }

  // ── Event Listener Methods ──────────────────────────────────────

  onPollStarted(event: PollStarted): void {
    // Legacy
    this.incrementCounter(
      this.metrics.pollTotal,
      event.taskType,
      "poll_total",
      "task_type"
    );
    // Canonical
    this.canonical.taskPollTotal.increment({ taskType: event.taskType });
    this._promRegistry?.incrementCanonicalCounter("c_task_poll_total", {
      taskType: event.taskType,
    });
  }

  onPollCompleted(event: PollCompleted): void {
    // Legacy
    this.observeSummary(
      this.metrics.pollDurationMs,
      event.taskType,
      event.durationMs,
      "poll_time",
      "task_type"
    );
    // Canonical
    const seconds = event.durationMs / 1000;
    this.canonical.taskPollTimeSeconds.observe(
      { taskType: event.taskType, status: "SUCCESS" },
      seconds
    );
    this._promRegistry?.observeCanonicalHistogram("c_task_poll_time_seconds", {
      taskType: event.taskType,
      status: "SUCCESS",
    }, seconds);
  }

  onPollFailure(event: PollFailure): void {
    const excName = exceptionLabel(event.cause);

    // Legacy
    this.incrementCounter(
      this.metrics.pollErrorTotal,
      event.taskType,
      "poll_error_total",
      "task_type"
    );
    this.observeSummary(
      this.metrics.pollDurationMs,
      event.taskType,
      event.durationMs,
      "poll_time",
      "task_type"
    );

    // Canonical
    this.canonical.taskPollErrorTotal.increment({
      taskType: event.taskType,
      exception: excName,
    });
    this._promRegistry?.incrementCanonicalCounter("c_task_poll_error_total", {
      taskType: event.taskType,
      exception: excName,
    });
    const seconds = event.durationMs / 1000;
    this.canonical.taskPollTimeSeconds.observe(
      { taskType: event.taskType, status: "FAILURE" },
      seconds
    );
    this._promRegistry?.observeCanonicalHistogram("c_task_poll_time_seconds", {
      taskType: event.taskType,
      status: "FAILURE",
    }, seconds);
  }

  onTaskExecutionStarted(event: TaskExecutionStarted): void {
    // Canonical
    this.canonical.taskExecutionStartedTotal.increment({
      taskType: event.taskType,
    });
    this._promRegistry?.incrementCanonicalCounter(
      "c_task_execution_started_total",
      { taskType: event.taskType }
    );
    this.canonical.activeWorkers.inc({ taskType: event.taskType });
    this._promRegistry?.setCanonicalGauge("c_active_workers", {
      taskType: event.taskType,
    }, this.getActiveWorkerCount(event.taskType) + 1);
  }

  onTaskExecutionCompleted(event: TaskExecutionCompleted): void {
    // Legacy
    this.incrementCounter(
      this.metrics.taskExecutionTotal,
      event.taskType,
      "execute_total",
      "task_type"
    );
    this.observeSummary(
      this.metrics.executionDurationMs,
      event.taskType,
      event.durationMs,
      "execute_time",
      "task_type"
    );
    if (event.outputSizeBytes !== undefined) {
      this.observeSummary(
        this.metrics.outputSizeBytes,
        event.taskType,
        event.outputSizeBytes,
        "result_size",
        "task_type"
      );
      // Canonical gauge (last-value)
      this.canonical.taskResultSizeBytes.set(
        { taskType: event.taskType },
        event.outputSizeBytes
      );
      this._promRegistry?.setCanonicalGauge("c_task_result_size_bytes", {
        taskType: event.taskType,
      }, event.outputSizeBytes);
    }

    // Canonical histogram
    const seconds = event.durationMs / 1000;
    this.canonical.taskExecuteTimeSeconds.observe(
      { taskType: event.taskType, status: "SUCCESS" },
      seconds
    );
    this._promRegistry?.observeCanonicalHistogram(
      "c_task_execute_time_seconds",
      { taskType: event.taskType, status: "SUCCESS" },
      seconds
    );

    // Decrement active workers
    this.canonical.activeWorkers.dec({ taskType: event.taskType });
    this._promRegistry?.setCanonicalGauge("c_active_workers", {
      taskType: event.taskType,
    }, Math.max(0, this.getActiveWorkerCount(event.taskType) - 1));
  }

  onTaskExecutionFailure(event: TaskExecutionFailure): void {
    const excName = exceptionLabel(event.cause);
    const legacyKey = `${event.taskType}:${event.cause?.name ?? "Error"}`;

    // Legacy
    this.incrementCounter(
      this.metrics.taskExecutionErrorTotal,
      legacyKey,
      "execute_error_total",
      "task_type"
    );
    this.observeSummary(
      this.metrics.executionDurationMs,
      event.taskType,
      event.durationMs,
      "execute_time",
      "task_type"
    );

    // Canonical
    this.canonical.taskExecuteErrorTotal.increment({
      taskType: event.taskType,
      exception: excName,
    });
    this._promRegistry?.incrementCanonicalCounter(
      "c_task_execute_error_total",
      { taskType: event.taskType, exception: excName }
    );
    const seconds = event.durationMs / 1000;
    this.canonical.taskExecuteTimeSeconds.observe(
      { taskType: event.taskType, status: "FAILURE" },
      seconds
    );
    this._promRegistry?.observeCanonicalHistogram(
      "c_task_execute_time_seconds",
      { taskType: event.taskType, status: "FAILURE" },
      seconds
    );

    // Decrement active workers
    this.canonical.activeWorkers.dec({ taskType: event.taskType });
    this._promRegistry?.setCanonicalGauge("c_active_workers", {
      taskType: event.taskType,
    }, Math.max(0, this.getActiveWorkerCount(event.taskType) - 1));
  }

  onTaskUpdateCompleted(event: TaskUpdateCompleted): void {
    // Legacy
    this.observeSummary(
      this.metrics.updateDurationMs,
      event.taskType,
      event.durationMs,
      "update_time",
      "task_type"
    );
    // Canonical
    const seconds = event.durationMs / 1000;
    this.canonical.taskUpdateTimeSeconds.observe(
      { taskType: event.taskType, status: "SUCCESS" },
      seconds
    );
    this._promRegistry?.observeCanonicalHistogram(
      "c_task_update_time_seconds",
      { taskType: event.taskType, status: "SUCCESS" },
      seconds
    );
  }

  onTaskUpdateFailure(event: TaskUpdateFailure): void {
    const excName = exceptionLabel(event.cause);

    // Legacy
    this.incrementCounter(
      this.metrics.taskUpdateFailureTotal,
      event.taskType,
      "update_error_total",
      "task_type"
    );

    // Canonical
    this.canonical.taskUpdateErrorTotal.increment({
      taskType: event.taskType,
      exception: excName,
    });
    this._promRegistry?.incrementCanonicalCounter(
      "c_task_update_error_total",
      { taskType: event.taskType, exception: excName }
    );
  }

  onTaskPaused(event: TaskPaused): void {
    this.recordTaskPaused(event.taskType);
  }

  // ── Direct Recording Methods (for code outside event system) ───

  /** Record a task execution queue full event */
  recordTaskExecutionQueueFull(taskType: string): void {
    this.incrementCounter(
      this.metrics.taskExecutionQueueFullTotal,
      taskType,
      "queue_full_total",
      "task_type"
    );
    this.canonical.taskExecutionQueueFullTotal.increment({
      taskType,
    });
    this._promRegistry?.incrementCanonicalCounter(
      "c_task_execution_queue_full_total",
      { taskType }
    );
  }

  /** Record an uncaught exception */
  recordUncaughtException(exception?: string): void {
    const excName = exception ?? "Error";
    // Legacy (no labels)
    this.metrics.uncaughtExceptionTotal++;
    this._promRegistry?.incrementCounter("uncaught_total", {});
    // Canonical
    this.canonical.threadUncaughtExceptionsTotal.increment({
      exception: excName,
    });
    this._promRegistry?.incrementCanonicalCounter(
      "c_thread_uncaught_exceptions_total",
      { exception: excName }
    );
  }

  /** Record a worker restart */
  recordWorkerRestart(): void {
    this.metrics.workerRestartTotal++;
    this._promRegistry?.incrementCounter("restart_total", {});
  }

  /** Record a task paused event */
  recordTaskPaused(taskType: string): void {
    this.incrementCounter(
      this.metrics.taskPausedTotal,
      taskType,
      "paused_total",
      "task_type"
    );
    this.canonical.taskPausedTotal.increment({ taskType });
    this._promRegistry?.incrementCanonicalCounter("c_task_paused_total", {
      taskType,
    });
  }

  /** Record a task ack error */
  recordTaskAckError(taskType: string, exception?: string): void {
    const excName = exception ?? "Error";
    // Legacy
    this.incrementCounter(
      this.metrics.taskAckErrorTotal,
      taskType,
      "ack_error_total",
      "task_type"
    );
    // Canonical
    this.canonical.taskAckErrorTotal.increment({
      taskType,
      exception: excName,
    });
    this._promRegistry?.incrementCanonicalCounter("c_task_ack_error_total", {
      taskType,
      exception: excName,
    });
  }

  /** Record a task ack failed (server declined ack, no exception) */
  recordTaskAckFailed(taskType: string): void {
    this.canonical.taskAckFailedTotal.increment({ taskType });
    this._promRegistry?.incrementCanonicalCounter("c_task_ack_failed_total", {
      taskType,
    });
  }

  /** Record a workflow start error */
  recordWorkflowStartError(
    workflowType?: string,
    exception?: string
  ): void {
    const wfType = workflowType ?? "";
    const excName = exception ?? "Error";
    // Legacy (no labels)
    this.metrics.workflowStartErrorTotal++;
    this._promRegistry?.incrementCounter("wf_start_error_total", {});
    // Canonical
    this.canonical.workflowStartErrorTotal.increment({
      workflowType: wfType,
      exception: excName,
    });
    this._promRegistry?.incrementCanonicalCounter(
      "c_workflow_start_error_total",
      { workflowType: wfType, exception: excName }
    );
  }

  /** Record external payload usage */
  recordExternalPayloadUsed(
    payloadType: string,
    entityName?: string,
    operation?: string
  ): void {
    // Legacy
    this.incrementCounter(
      this.metrics.externalPayloadUsedTotal,
      payloadType,
      "external_payload_total",
      "payload_type"
    );
    // Canonical
    this.canonical.externalPayloadUsedTotal.increment({
      entityName: entityName ?? "",
      operation: operation ?? "",
      payloadType: payloadType,
      payload_type: payloadType,
    });
    this._promRegistry?.incrementCanonicalCounter(
      "c_external_payload_used_total",
      {
        entityName: entityName ?? "",
        operation: operation ?? "",
        payloadType: payloadType,
        payload_type: payloadType,
      }
    );
  }

  /** Record workflow input size */
  recordWorkflowInputSize(
    workflowType: string,
    sizeBytes: number,
    version?: string
  ): void {
    // Legacy
    this.observeSummary(
      this.metrics.workflowInputSizeBytes,
      workflowType,
      sizeBytes,
      "wf_input_size",
      "workflow_type"
    );
    // Canonical gauge (last-value)
    this.canonical.workflowInputSizeBytes.set(
      { workflowType, version: version ?? "" },
      sizeBytes
    );
    this._promRegistry?.setCanonicalGauge("c_workflow_input_size_bytes", {
      workflowType,
      version: version ?? "",
    }, sizeBytes);
  }

  /** Record API request duration */
  recordApiRequestTime(
    method: string,
    uri: string,
    status: number | string,
    durationMs: number
  ): void {
    const statusStr = String(status);
    // Legacy (compound label)
    const legacyKey = `${method}:${uri}:${statusStr}`;
    this.observeSummary(
      this.metrics.apiRequestDurationMs,
      legacyKey,
      durationMs,
      "api_request",
      "endpoint"
    );
    // Canonical histogram (seconds, separate labels)
    const seconds = durationMs / 1000;
    this.canonical.httpApiClientRequestSeconds.observe(
      { method, uri, status: statusStr },
      seconds
    );
    this._promRegistry?.observeCanonicalHistogram(
      "c_http_api_client_request_seconds",
      { method, uri, status: statusStr },
      seconds
    );
  }

  // ── active_workers helper ──────────────────────────────────────

  private getActiveWorkerCount(taskType: string): number {
    const snapshot = this.canonical.activeWorkers as GaugeMetric;
    const key = labelKey({ taskType });
    // Access internal state via render-less path
    return (snapshot as any)._series?.get(key)?.value ?? 0;
  }

  // ── Public API ──────────────────────────────────────────────────

  /** Get a snapshot of all collected legacy metrics */
  getMetrics(): Readonly<WorkerMetrics> {
    return this.metrics;
  }

  /** Reset all collected metrics (legacy + canonical) */
  reset(): void {
    this.metrics = this.createEmptyMetrics();
    this.canonical = this.createEmptyCanonical();
  }

  /** Stop the auto-started metrics HTTP server and file writer (if any) */
  async stop(): Promise<void> {
    setHttpMetricsObserver(undefined);
    if (this._fileTimer) {
      clearInterval(this._fileTimer);
      this._fileTimer = undefined;
    }
    if (this._server) {
      await this._server.stop();
      this._server = undefined;
    }
  }

  /**
   * Get the content type for the Prometheus metrics endpoint.
   */
  getContentType(): string {
    return (
      this._promRegistry?.contentType ??
      "text/plain; version=0.0.4; charset=utf-8"
    );
  }

  /**
   * Async version of toPrometheusText.
   * When prom-client is available, returns its native registry output.
   * Otherwise falls back to the built-in text format.
   */
  async toPrometheusTextAsync(): Promise<string> {
    if (this._promRegistry?.available) {
      return this._promRegistry.metrics();
    }
    return this.toPrometheusText();
  }

  /**
   * Render all collected metrics in Prometheus exposition format.
   *
   * Emits legacy metrics (prefixed, task_type, ms, Summary) followed by
   * canonical metrics (unprefixed, taskType, seconds, Histogram/Gauge).
   */
  toPrometheusText(prefix?: string): string {
    const p = prefix ?? this._prefix;
    const lines: string[] = [];

    // ── Legacy labelled counters ──
    const labelledCounters: {
      name: string;
      help: string;
      data: Map<string, number>;
      labelName: string;
    }[] = [
      {
        name: `${p}_task_poll_total`,
        help: "Total number of task polls",
        data: this.metrics.pollTotal,
        labelName: "task_type",
      },
      {
        name: `${p}_task_poll_error_total`,
        help: "Total number of task poll errors",
        data: this.metrics.pollErrorTotal,
        labelName: "task_type",
      },
      {
        name: `${p}_task_execute_total`,
        help: "Total number of task executions",
        data: this.metrics.taskExecutionTotal,
        labelName: "task_type",
      },
      {
        name: `${p}_task_execute_error_total`,
        help: "Total number of task execution errors",
        data: this.metrics.taskExecutionErrorTotal,
        labelName: "task_type",
      },
      {
        name: `${p}_task_update_error_total`,
        help: "Total number of task update failures",
        data: this.metrics.taskUpdateFailureTotal,
        labelName: "task_type",
      },
      {
        name: `${p}_task_ack_error_total`,
        help: "Total number of task ack errors",
        data: this.metrics.taskAckErrorTotal,
        labelName: "task_type",
      },
      {
        name: `${p}_task_execution_queue_full_total`,
        help: "Total number of task execution queue full events",
        data: this.metrics.taskExecutionQueueFullTotal,
        labelName: "task_type",
      },
      {
        name: `${p}_task_paused_total`,
        help: "Total number of task paused events",
        data: this.metrics.taskPausedTotal,
        labelName: "task_type",
      },
      {
        name: `${p}_external_payload_used_total`,
        help: "Total number of external payload usage events",
        data: this.metrics.externalPayloadUsedTotal,
        labelName: "payload_type",
      },
    ];

    for (const counter of labelledCounters) {
      if (counter.data.size === 0) continue;
      lines.push(`# HELP ${counter.name} ${counter.help}`);
      lines.push(`# TYPE ${counter.name} counter`);
      for (const [label, value] of counter.data) {
        lines.push(
          `${counter.name}{${counter.labelName}="${label}"} ${value}`
        );
      }
    }

    // ── Legacy global counters (no labels) ──
    const globalCounters: {
      name: string;
      help: string;
      value: number;
    }[] = [
      {
        name: `${p}_thread_uncaught_exceptions_total`,
        help: "Total uncaught exceptions",
        value: this.metrics.uncaughtExceptionTotal,
      },
      {
        name: `${p}_worker_restart_total`,
        help: "Total worker restarts",
        value: this.metrics.workerRestartTotal,
      },
      {
        name: `${p}_workflow_start_error_total`,
        help: "Total workflow start errors",
        value: this.metrics.workflowStartErrorTotal,
      },
    ];

    for (const counter of globalCounters) {
      if (counter.value === 0) continue;
      lines.push(`# HELP ${counter.name} ${counter.help}`);
      lines.push(`# TYPE ${counter.name} counter`);
      lines.push(`${counter.name} ${counter.value}`);
    }

    // ── Legacy summaries with quantiles ──
    const summaries: {
      name: string;
      help: string;
      data: Map<string, number[]>;
      labelName: string;
    }[] = [
      {
        name: `${p}_task_poll_time`,
        help: "Task poll duration in milliseconds",
        data: this.metrics.pollDurationMs,
        labelName: "task_type",
      },
      {
        name: `${p}_task_execute_time`,
        help: "Task execution duration in milliseconds",
        data: this.metrics.executionDurationMs,
        labelName: "task_type",
      },
      {
        name: `${p}_task_update_time`,
        help: "Task update duration in milliseconds",
        data: this.metrics.updateDurationMs,
        labelName: "task_type",
      },
      {
        name: `${p}_task_result_size_bytes`,
        help: "Task result output size in bytes",
        data: this.metrics.outputSizeBytes,
        labelName: "task_type",
      },
      {
        name: `${p}_workflow_input_size_bytes`,
        help: "Workflow input payload size in bytes",
        data: this.metrics.workflowInputSizeBytes,
        labelName: "workflow_type",
      },
      {
        name: `${p}_http_api_client_request`,
        help: "API request duration in milliseconds",
        data: this.metrics.apiRequestDurationMs,
        labelName: "endpoint",
      },
    ];

    for (const summary of summaries) {
      if (summary.data.size === 0) continue;
      lines.push(`# HELP ${summary.name} ${summary.help}`);
      lines.push(`# TYPE ${summary.name} summary`);
      for (const [label, values] of summary.data) {
        const sorted = [...values].sort((a, b) => a - b);
        const count = sorted.length;
        const sum = sorted.reduce((a, b) => a + b, 0);
        for (const q of QUANTILES) {
          const val = computeQuantile(sorted, q);
          lines.push(
            `${summary.name}{${summary.labelName}="${label}",quantile="${q}"} ${val}`
          );
        }
        lines.push(
          `${summary.name}_count{${summary.labelName}="${label}"} ${count}`
        );
        lines.push(
          `${summary.name}_sum{${summary.labelName}="${label}"} ${sum}`
        );
      }
    }

    // ── Canonical counters ──
    const canonicalCounterDefs: {
      name: string;
      help: string;
      counter: MultiLabelCounter;
    }[] = [
      {
        name: "task_poll_total",
        help: "Total number of task polls",
        counter: this.canonical.taskPollTotal,
      },
      {
        name: "task_execution_started_total",
        help: "Total number of task executions started",
        counter: this.canonical.taskExecutionStartedTotal,
      },
      {
        name: "task_poll_error_total",
        help: "Total number of task poll errors",
        counter: this.canonical.taskPollErrorTotal,
      },
      {
        name: "task_execute_error_total",
        help: "Total number of task execution errors",
        counter: this.canonical.taskExecuteErrorTotal,
      },
      {
        name: "task_update_error_total",
        help: "Total number of task update errors",
        counter: this.canonical.taskUpdateErrorTotal,
      },
      {
        name: "task_ack_error_total",
        help: "Total number of task ack errors",
        counter: this.canonical.taskAckErrorTotal,
      },
      {
        name: "task_ack_failed_total",
        help: "Total number of task ack failures (server declined)",
        counter: this.canonical.taskAckFailedTotal,
      },
      {
        name: "task_execution_queue_full_total",
        help: "Total number of task execution queue full events",
        counter: this.canonical.taskExecutionQueueFullTotal,
      },
      {
        name: "task_paused_total",
        help: "Total number of task paused events",
        counter: this.canonical.taskPausedTotal,
      },
      {
        name: "thread_uncaught_exceptions_total",
        help: "Total uncaught exceptions",
        counter: this.canonical.threadUncaughtExceptionsTotal,
      },
      {
        name: "external_payload_used_total",
        help: "Total external payload usage",
        counter: this.canonical.externalPayloadUsedTotal,
      },
      {
        name: "workflow_start_error_total",
        help: "Total workflow start errors",
        counter: this.canonical.workflowStartErrorTotal,
      },
    ];

    for (const def of canonicalCounterDefs) {
      const rendered = def.counter.render(def.name, def.help);
      if (rendered) lines.push(rendered);
    }

    // ── Canonical histograms ──
    const canonicalHistogramDefs: {
      name: string;
      help: string;
      histogram: HistogramAccumulator;
    }[] = [
      {
        name: "task_poll_time_seconds",
        help: "Task poll duration in seconds",
        histogram: this.canonical.taskPollTimeSeconds,
      },
      {
        name: "task_execute_time_seconds",
        help: "Task execution duration in seconds",
        histogram: this.canonical.taskExecuteTimeSeconds,
      },
      {
        name: "task_update_time_seconds",
        help: "Task update duration in seconds",
        histogram: this.canonical.taskUpdateTimeSeconds,
      },
      {
        name: "http_api_client_request_seconds",
        help: "HTTP API client request duration in seconds",
        histogram: this.canonical.httpApiClientRequestSeconds,
      },
    ];

    for (const def of canonicalHistogramDefs) {
      const rendered = def.histogram.render(def.name, def.help);
      if (rendered) lines.push(rendered);
    }

    // ── Canonical gauges ──
    const canonicalGaugeDefs: {
      name: string;
      help: string;
      gauge: GaugeMetric;
    }[] = [
      {
        name: "task_result_size_bytes",
        help: "Task result output size in bytes",
        gauge: this.canonical.taskResultSizeBytes,
      },
      {
        name: "workflow_input_size_bytes",
        help: "Workflow input payload size in bytes",
        gauge: this.canonical.workflowInputSizeBytes,
      },
      {
        name: "active_workers",
        help: "Number of workers actively executing tasks",
        gauge: this.canonical.activeWorkers,
      },
    ];

    for (const def of canonicalGaugeDefs) {
      const rendered = def.gauge.render(def.name, def.help);
      if (rendered) lines.push(rendered);
    }

    lines.push(""); // trailing newline
    return lines.join("\n");
  }
}
