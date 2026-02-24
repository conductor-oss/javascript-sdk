import type {
  TaskRunnerEventsListener,
  PollStarted,
  PollCompleted,
  PollFailure,
  TaskExecutionStarted,
  TaskExecutionCompleted,
  TaskExecutionFailure,
  TaskUpdateFailure,
} from "../../clients/worker/events";

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
 * Collected worker metrics.
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
  /** Output size observations in bytes by taskType */
  outputSizeBytes: Map<string, number[]>;
  /** Workflow input size observations in bytes */
  workflowInputSizeBytes: Map<string, number[]>;
  /** API request duration observations in ms by "method:uri:status" */
  apiRequestDurationMs: Map<string, number[]>;
}

const QUANTILES = [0.5, 0.75, 0.9, 0.95, 0.99] as const;

/**
 * Calculate quantiles from sorted array using linear interpolation.
 */
function computeQuantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = q * (sorted.length - 1);
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (pos - lower) * (sorted[upper] - sorted[lower]);
}

/**
 * Built-in metrics collector implementing TaskRunnerEventsListener.
 *
 * Collects 19 metric types matching the Python SDK's MetricsCollector,
 * with sliding-window quantile support (p50, p75, p90, p95, p99).
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
  private readonly _prefix: string;
  private readonly _slidingWindowSize: number;
  private _server?: import("./MetricsServer.js").MetricsServer;
  private _fileTimer?: ReturnType<typeof setInterval>;
  private _promRegistry?: import("./PrometheusRegistry.js").PrometheusRegistry;

  constructor(config?: MetricsCollectorConfig) {
    this.metrics = this.createEmptyMetrics();
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
    this._fileTimer = setInterval(async () => {
      try {
        const { writeFile } = await import("node:fs/promises");
        await writeFile(filePath, this.toPrometheusText(), "utf-8");
      } catch {
        // Silently ignore file write errors
      }
    }, intervalMs);
    // Unref so the timer doesn't prevent process exit
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
      outputSizeBytes: new Map(),
      workflowInputSizeBytes: new Map(),
      apiRequestDurationMs: new Map(),
    };
  }

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
    // Sliding window: keep only the last N observations
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
    this.incrementCounter(this.metrics.pollTotal, event.taskType, "poll_total", "task_type");
  }

  onPollCompleted(event: PollCompleted): void {
    this.observeSummary(this.metrics.pollDurationMs, event.taskType, event.durationMs, "poll_time", "task_type");
  }

  onPollFailure(event: PollFailure): void {
    this.incrementCounter(this.metrics.pollErrorTotal, event.taskType, "poll_error_total", "task_type");
    this.observeSummary(this.metrics.pollDurationMs, event.taskType, event.durationMs, "poll_time", "task_type");
  }

  onTaskExecutionStarted(_event: TaskExecutionStarted): void {
    // Counted on completion
  }

  onTaskExecutionCompleted(event: TaskExecutionCompleted): void {
    this.incrementCounter(this.metrics.taskExecutionTotal, event.taskType, "execute_total", "task_type");
    this.observeSummary(this.metrics.executionDurationMs, event.taskType, event.durationMs, "execute_time", "task_type");
    if (event.outputSizeBytes !== undefined) {
      this.observeSummary(this.metrics.outputSizeBytes, event.taskType, event.outputSizeBytes, "result_size", "task_type");
    }
  }

  onTaskExecutionFailure(event: TaskExecutionFailure): void {
    const key = `${event.taskType}:${event.cause?.name ?? "Error"}`;
    this.incrementCounter(this.metrics.taskExecutionErrorTotal, key, "execute_error_total", "task_type");
    this.observeSummary(this.metrics.executionDurationMs, event.taskType, event.durationMs, "execute_time", "task_type");
  }

  onTaskUpdateFailure(event: TaskUpdateFailure): void {
    this.incrementCounter(this.metrics.taskUpdateFailureTotal, event.taskType, "update_error_total", "task_type");
  }

  // ── Direct Recording Methods (for code outside event system) ───

  /** Record a task execution queue full event */
  recordTaskExecutionQueueFull(taskType: string): void {
    this.incrementCounter(this.metrics.taskExecutionQueueFullTotal, taskType, "queue_full_total", "task_type");
  }

  /** Record an uncaught exception */
  recordUncaughtException(): void {
    this.metrics.uncaughtExceptionTotal++;
    this._promRegistry?.incrementCounter("uncaught_total", {});
  }

  /** Record a worker restart */
  recordWorkerRestart(): void {
    this.metrics.workerRestartTotal++;
    this._promRegistry?.incrementCounter("restart_total", {});
  }

  /** Record a task paused event */
  recordTaskPaused(taskType: string): void {
    this.incrementCounter(this.metrics.taskPausedTotal, taskType, "paused_total", "task_type");
  }

  /** Record a task ack error */
  recordTaskAckError(taskType: string): void {
    this.incrementCounter(this.metrics.taskAckErrorTotal, taskType, "ack_error_total", "task_type");
  }

  /** Record a workflow start error */
  recordWorkflowStartError(): void {
    this.metrics.workflowStartErrorTotal++;
    this._promRegistry?.incrementCounter("wf_start_error_total", {});
  }

  /** Record external payload usage */
  recordExternalPayloadUsed(payloadType: string): void {
    this.incrementCounter(this.metrics.externalPayloadUsedTotal, payloadType, "external_payload_total", "payload_type");
  }

  /** Record workflow input size */
  recordWorkflowInputSize(workflowType: string, sizeBytes: number): void {
    this.observeSummary(this.metrics.workflowInputSizeBytes, workflowType, sizeBytes, "wf_input_size", "workflow_type");
  }

  /** Record API request duration */
  recordApiRequestTime(
    method: string,
    uri: string,
    status: number,
    durationMs: number
  ): void {
    const key = `${method}:${uri}:${status}`;
    this.observeSummary(this.metrics.apiRequestDurationMs, key, durationMs, "api_request", "endpoint");
  }

  // ── Public API ──────────────────────────────────────────────────

  /** Get a snapshot of all collected metrics */
  getMetrics(): Readonly<WorkerMetrics> {
    return this.metrics;
  }

  /** Reset all collected metrics */
  reset(): void {
    this.metrics = this.createEmptyMetrics();
  }

  /** Stop the auto-started metrics HTTP server and file writer (if any) */
  async stop(): Promise<void> {
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
   * Returns prom-client's content type when available, otherwise standard Prometheus text format.
   */
  getContentType(): string {
    return this._promRegistry?.contentType ?? "text/plain; version=0.0.4; charset=utf-8";
  }

  /**
   * Render all collected metrics in Prometheus exposition format.
   * If prom-client is available and `usePromClient: true`, delegates to prom-client's registry.
   * Otherwise uses built-in rendering with p50/p75/p90/p95/p99 quantiles.
   *
   * @param prefix - Metric name prefix (defaults to constructor config or "conductor_worker")
   * @returns Prometheus text format string
   */
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

  toPrometheusText(prefix?: string): string {
    const p = prefix ?? this._prefix;
    const lines: string[] = [];

    // ── Labelled counters ──
    const labelledCounters: Array<{
      name: string;
      help: string;
      data: Map<string, number>;
      labelName: string;
    }> = [
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

    // ── Global counters (no labels) ──
    const globalCounters: Array<{
      name: string;
      help: string;
      value: number;
    }> = [
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

    // ── Summaries with quantiles ──
    const summaries: Array<{
      name: string;
      help: string;
      data: Map<string, number[]>;
      labelName: string;
    }> = [
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

    lines.push(""); // trailing newline
    return lines.join("\n");
  }
}
