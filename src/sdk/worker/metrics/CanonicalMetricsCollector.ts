import type {
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
import type { MetricsCollectorInterface } from "./MetricsCollectorInterface";
import type { MetricsCollectorConfig } from "./LegacyMetricsCollector";
import { setHttpMetricsObserver } from "./httpObserver";
import {
  HistogramAccumulator,
  MultiLabelCounter,
  GaugeMetric,
  TIME_BUCKETS,
  SIZE_BUCKETS,
  exceptionLabel,
} from "./accumulators";

interface CanonicalMetricState {
  // Counters (12)
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

  // Time histograms (4) — seconds
  taskPollTimeSeconds: HistogramAccumulator;
  taskExecuteTimeSeconds: HistogramAccumulator;
  taskUpdateTimeSeconds: HistogramAccumulator;
  httpApiClientRequestSeconds: HistogramAccumulator;

  // Size histograms (2) — bytes
  taskResultSizeBytes: HistogramAccumulator;
  workflowInputSizeBytes: HistogramAccumulator;

  // Gauge (1)
  activeWorkers: GaugeMetric;
}

/**
 * Canonical metrics collector.
 *
 * Emits unprefixed Prometheus metrics with camelCase labels, second-based
 * time units, and Histogram type for distributions, per the cross-SDK
 * canonical metric catalog.
 *
 * Selected when WORKER_CANONICAL_METRICS=true.
 */
export class CanonicalMetricsCollector implements MetricsCollectorInterface {
  private state: CanonicalMetricState;
  private _server?: import("./MetricsServer.js").MetricsServer;
  private _fileTimer?: ReturnType<typeof setInterval>;
  private _promRegistry?: import("./CanonicalPrometheusRegistry.js").CanonicalPrometheusRegistry;
  private readonly _usePromClient: boolean;

  constructor(config?: MetricsCollectorConfig) {
    this.state = this.createEmpty();
    this._usePromClient = config?.usePromClient ?? false;
    if (this._usePromClient) {
      void this.initPromClient();
    }
    if (config?.httpPort) {
      void this.startServer(config.httpPort);
    }
    if (config?.filePath) {
      this.startFileWriter(
        config.filePath,
        config.fileWriteIntervalMs ?? 5000,
      );
    }
  }

  private async initPromClient(): Promise<void> {
    const { CanonicalPrometheusRegistry } = await import(
      "./CanonicalPrometheusRegistry.js"
    );
    this._promRegistry = new CanonicalPrometheusRegistry();
    await this._promRegistry.initialize();
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

  private createEmpty(): CanonicalMetricState {
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

      taskPollTimeSeconds: new HistogramAccumulator(TIME_BUCKETS),
      taskExecuteTimeSeconds: new HistogramAccumulator(TIME_BUCKETS),
      taskUpdateTimeSeconds: new HistogramAccumulator(TIME_BUCKETS),
      httpApiClientRequestSeconds: new HistogramAccumulator(TIME_BUCKETS),

      taskResultSizeBytes: new HistogramAccumulator(SIZE_BUCKETS),
      workflowInputSizeBytes: new HistogramAccumulator(SIZE_BUCKETS),

      activeWorkers: new GaugeMetric(),
    };
  }

  // ── Event Listener Methods ──────────────────────────────────────

  onPollStarted(event: PollStarted): void {
    this.state.taskPollTotal.increment({ taskType: event.taskType });
    this._promRegistry?.incrementCounter("task_poll_total", {
      taskType: event.taskType,
    });
  }

  onPollCompleted(event: PollCompleted): void {
    const seconds = event.durationMs / 1000;
    this.state.taskPollTimeSeconds.observe(
      { taskType: event.taskType, status: "SUCCESS" },
      seconds,
    );
    this._promRegistry?.observeHistogram("task_poll_time_seconds", {
      taskType: event.taskType,
      status: "SUCCESS",
    }, seconds);
  }

  onPollFailure(event: PollFailure): void {
    const excName = exceptionLabel(event.cause);
    this.state.taskPollErrorTotal.increment({
      taskType: event.taskType,
      exception: excName,
    });
    this._promRegistry?.incrementCounter("task_poll_error_total", {
      taskType: event.taskType,
      exception: excName,
    });

    const seconds = event.durationMs / 1000;
    this.state.taskPollTimeSeconds.observe(
      { taskType: event.taskType, status: "FAILURE" },
      seconds,
    );
    this._promRegistry?.observeHistogram("task_poll_time_seconds", {
      taskType: event.taskType,
      status: "FAILURE",
    }, seconds);
  }

  onTaskExecutionStarted(event: TaskExecutionStarted): void {
    this.state.taskExecutionStartedTotal.increment({
      taskType: event.taskType,
    });
    this._promRegistry?.incrementCounter("task_execution_started_total", {
      taskType: event.taskType,
    });
    this.state.activeWorkers.inc({ taskType: event.taskType });
    this._promRegistry?.setGauge(
      "active_workers",
      { taskType: event.taskType },
      this.state.activeWorkers.getValue({ taskType: event.taskType }),
    );
  }

  onTaskExecutionCompleted(event: TaskExecutionCompleted): void {
    const seconds = event.durationMs / 1000;
    this.state.taskExecuteTimeSeconds.observe(
      { taskType: event.taskType, status: "SUCCESS" },
      seconds,
    );
    this._promRegistry?.observeHistogram("task_execute_time_seconds", {
      taskType: event.taskType,
      status: "SUCCESS",
    }, seconds);

    if (event.outputSizeBytes !== undefined) {
      this.state.taskResultSizeBytes.observe(
        { taskType: event.taskType },
        event.outputSizeBytes,
      );
      this._promRegistry?.observeHistogram("task_result_size_bytes", {
        taskType: event.taskType,
      }, event.outputSizeBytes);
    }

    this.state.activeWorkers.dec({ taskType: event.taskType });
    this._promRegistry?.setGauge(
      "active_workers",
      { taskType: event.taskType },
      Math.max(0, this.state.activeWorkers.getValue({ taskType: event.taskType })),
    );
  }

  onTaskExecutionFailure(event: TaskExecutionFailure): void {
    const excName = exceptionLabel(event.cause);
    this.state.taskExecuteErrorTotal.increment({
      taskType: event.taskType,
      exception: excName,
    });
    this._promRegistry?.incrementCounter("task_execute_error_total", {
      taskType: event.taskType,
      exception: excName,
    });

    const seconds = event.durationMs / 1000;
    this.state.taskExecuteTimeSeconds.observe(
      { taskType: event.taskType, status: "FAILURE" },
      seconds,
    );
    this._promRegistry?.observeHistogram("task_execute_time_seconds", {
      taskType: event.taskType,
      status: "FAILURE",
    }, seconds);

    this.state.activeWorkers.dec({ taskType: event.taskType });
    this._promRegistry?.setGauge(
      "active_workers",
      { taskType: event.taskType },
      Math.max(0, this.state.activeWorkers.getValue({ taskType: event.taskType })),
    );
  }

  onTaskUpdateCompleted(event: TaskUpdateCompleted): void {
    const seconds = event.durationMs / 1000;
    this.state.taskUpdateTimeSeconds.observe(
      { taskType: event.taskType, status: "SUCCESS" },
      seconds,
    );
    this._promRegistry?.observeHistogram("task_update_time_seconds", {
      taskType: event.taskType,
      status: "SUCCESS",
    }, seconds);
  }

  onTaskUpdateFailure(event: TaskUpdateFailure): void {
    const excName = exceptionLabel(event.cause);
    this.state.taskUpdateErrorTotal.increment({
      taskType: event.taskType,
      exception: excName,
    });
    this._promRegistry?.incrementCounter("task_update_error_total", {
      taskType: event.taskType,
      exception: excName,
    });

    const seconds = event.durationMs / 1000;
    this.state.taskUpdateTimeSeconds.observe(
      { taskType: event.taskType, status: "FAILURE" },
      seconds,
    );
    this._promRegistry?.observeHistogram("task_update_time_seconds", {
      taskType: event.taskType,
      status: "FAILURE",
    }, seconds);
  }

  onTaskPaused(event: TaskPaused): void {
    this.recordTaskPaused(event.taskType);
  }

  // ── Direct Recording Methods ───────────────────────────────────

  recordTaskExecutionQueueFull(taskType: string): void {
    this.state.taskExecutionQueueFullTotal.increment({ taskType });
    this._promRegistry?.incrementCounter("task_execution_queue_full_total", {
      taskType,
    });
  }

  recordUncaughtException(exception?: string): void {
    const excName = exception ?? "Error";
    this.state.threadUncaughtExceptionsTotal.increment({
      exception: excName,
    });
    this._promRegistry?.incrementCounter(
      "thread_uncaught_exceptions_total",
      { exception: excName },
    );
  }

  recordWorkerRestart(): void {
    // Noop: worker_restart_total is N/A for the JS SDK (single-process model)
  }

  recordTaskPaused(taskType: string): void {
    this.state.taskPausedTotal.increment({ taskType });
    this._promRegistry?.incrementCounter("task_paused_total", { taskType });
  }

  recordTaskAckError(taskType: string, exception?: string): void {
    const excName = exception ?? "Error";
    this.state.taskAckErrorTotal.increment({ taskType, exception: excName });
    this._promRegistry?.incrementCounter("task_ack_error_total", {
      taskType,
      exception: excName,
    });
  }

  recordTaskAckFailed(taskType: string): void {
    this.state.taskAckFailedTotal.increment({ taskType });
    this._promRegistry?.incrementCounter("task_ack_failed_total", {
      taskType,
    });
  }

  recordWorkflowStartError(workflowType?: string, exception?: string): void {
    const wfType = workflowType ?? "";
    const excName = exception ?? "Error";
    this.state.workflowStartErrorTotal.increment({
      workflowType: wfType,
      exception: excName,
    });
    this._promRegistry?.incrementCounter("workflow_start_error_total", {
      workflowType: wfType,
      exception: excName,
    });
  }

  recordExternalPayloadUsed(
    payloadType: string,
    entityName?: string,
    operation?: string,
  ): void {
    this.state.externalPayloadUsedTotal.increment({
      entityName: entityName ?? "",
      operation: operation ?? "",
      payloadType,
    });
    this._promRegistry?.incrementCounter("external_payload_used_total", {
      entityName: entityName ?? "",
      operation: operation ?? "",
      payloadType,
    });
  }

  recordWorkflowInputSize(
    workflowType: string,
    sizeBytes: number,
    version?: string,
  ): void {
    this.state.workflowInputSizeBytes.observe(
      { workflowType, version: version ?? "" },
      sizeBytes,
    );
    this._promRegistry?.observeHistogram("workflow_input_size_bytes", {
      workflowType,
      version: version ?? "",
    }, sizeBytes);
  }

  recordApiRequestTime(
    method: string,
    uri: string,
    status: number | string,
    durationMs: number,
  ): void {
    const statusStr = String(status);
    const seconds = durationMs / 1000;
    this.state.httpApiClientRequestSeconds.observe(
      { method, uri, status: statusStr },
      seconds,
    );
    this._promRegistry?.observeHistogram("http_api_client_request_seconds", {
      method,
      uri,
      status: statusStr,
    }, seconds);
  }

  // ── Public API ──────────────────────────────────────────────────

  getMetrics(): Readonly<CanonicalMetricState> {
    return this.state;
  }

  reset(): void {
    this.state = this.createEmpty();
  }

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

  collectorName(): string {
    return "canonical";
  }

  getContentType(): string {
    return (
      this._promRegistry?.contentType ??
      "text/plain; version=0.0.4; charset=utf-8"
    );
  }

  async toPrometheusTextAsync(): Promise<string> {
    if (this._promRegistry?.available) {
      return this._promRegistry.metrics();
    }
    return this.toPrometheusText();
  }

  toPrometheusText(_prefix?: string): string {
    const lines: string[] = [];

    // ── Counters ──
    const counterDefs: {
      name: string;
      help: string;
      counter: MultiLabelCounter;
    }[] = [
      { name: "task_poll_total", help: "Total number of task polls", counter: this.state.taskPollTotal },
      { name: "task_execution_started_total", help: "Total number of task executions started", counter: this.state.taskExecutionStartedTotal },
      { name: "task_poll_error_total", help: "Total number of task poll errors", counter: this.state.taskPollErrorTotal },
      { name: "task_execute_error_total", help: "Total number of task execution errors", counter: this.state.taskExecuteErrorTotal },
      { name: "task_update_error_total", help: "Total number of task update errors", counter: this.state.taskUpdateErrorTotal },
      { name: "task_ack_error_total", help: "Total number of task ack errors", counter: this.state.taskAckErrorTotal },
      { name: "task_ack_failed_total", help: "Total number of task ack failures (server declined)", counter: this.state.taskAckFailedTotal },
      { name: "task_execution_queue_full_total", help: "Total number of task execution queue full events", counter: this.state.taskExecutionQueueFullTotal },
      { name: "task_paused_total", help: "Total number of task paused events", counter: this.state.taskPausedTotal },
      { name: "thread_uncaught_exceptions_total", help: "Total uncaught exceptions", counter: this.state.threadUncaughtExceptionsTotal },
      { name: "external_payload_used_total", help: "Total external payload usage", counter: this.state.externalPayloadUsedTotal },
      { name: "workflow_start_error_total", help: "Total workflow start errors", counter: this.state.workflowStartErrorTotal },
    ];

    for (const def of counterDefs) {
      const rendered = def.counter.render(def.name, def.help);
      if (rendered) lines.push(rendered);
    }

    // ── Time histograms ──
    const timeHistogramDefs: {
      name: string;
      help: string;
      histogram: HistogramAccumulator;
    }[] = [
      { name: "task_poll_time_seconds", help: "Task poll duration in seconds", histogram: this.state.taskPollTimeSeconds },
      { name: "task_execute_time_seconds", help: "Task execution duration in seconds", histogram: this.state.taskExecuteTimeSeconds },
      { name: "task_update_time_seconds", help: "Task update duration in seconds", histogram: this.state.taskUpdateTimeSeconds },
      { name: "http_api_client_request_seconds", help: "HTTP API client request duration in seconds", histogram: this.state.httpApiClientRequestSeconds },
    ];

    for (const def of timeHistogramDefs) {
      const rendered = def.histogram.render(def.name, def.help);
      if (rendered) lines.push(rendered);
    }

    // ── Size histograms ──
    const sizeHistogramDefs: {
      name: string;
      help: string;
      histogram: HistogramAccumulator;
    }[] = [
      { name: "task_result_size_bytes", help: "Task result output size in bytes", histogram: this.state.taskResultSizeBytes },
      { name: "workflow_input_size_bytes", help: "Workflow input payload size in bytes", histogram: this.state.workflowInputSizeBytes },
    ];

    for (const def of sizeHistogramDefs) {
      const rendered = def.histogram.render(def.name, def.help);
      if (rendered) lines.push(rendered);
    }

    // ── Gauges ──
    const gaugeDefs: {
      name: string;
      help: string;
      gauge: GaugeMetric;
    }[] = [
      { name: "active_workers", help: "Number of workers actively executing tasks", gauge: this.state.activeWorkers },
    ];

    for (const def of gaugeDefs) {
      const rendered = def.gauge.render(def.name, def.help);
      if (rendered) lines.push(rendered);
    }

    lines.push(""); // trailing newline
    return lines.join("\n");
  }
}
