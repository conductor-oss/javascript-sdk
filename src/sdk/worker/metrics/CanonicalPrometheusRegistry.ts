/**
 * Optional prom-client adapter for canonical metrics.
 *
 * Registers Prometheus Counter, Histogram, and Gauge objects using the
 * canonical metric names (unprefixed, camelCase labels, seconds/bytes units).
 */

import { TIME_BUCKETS, SIZE_BUCKETS } from "./accumulators";

interface PromCounter {
  inc(labels: Record<string, string>, value?: number): void;
}
interface PromHistogram {
  observe(labels: Record<string, string>, value: number): void;
}
interface PromGauge {
  set(labels: Record<string, string>, value: number): void;
}
interface PromRegistry {
  metrics(): Promise<string>;
  contentType: string;
}

export class CanonicalPrometheusRegistry {
  private _counters = new Map<string, PromCounter>();
  private _histograms = new Map<string, PromHistogram>();
  private _gauges = new Map<string, PromGauge>();
  private _registry?: PromRegistry;
  private _available = false;

  async initialize(): Promise<boolean> {
    try {
      const promClient = await import("prom-client");
      this._registry = promClient.register;
      this.createMetrics(promClient);
      this._available = true;
      return true;
    } catch {
      this._available = false;
      return false;
    }
  }

  get available(): boolean {
    return this._available;
  }

  get contentType(): string {
    return (
      this._registry?.contentType ??
      "text/plain; version=0.0.4; charset=utf-8"
    );
  }

  async metrics(): Promise<string> {
    if (!this._registry) return "";
    return this._registry.metrics();
  }

  incrementCounter(
    name: string,
    labels: Record<string, string>,
    value = 1,
  ): void {
    this._counters.get(name)?.inc(labels, value);
  }

  observeHistogram(
    name: string,
    labels: Record<string, string>,
    value: number,
  ): void {
    this._histograms.get(name)?.observe(labels, value);
  }

  setGauge(
    name: string,
    labels: Record<string, string>,
    value: number,
  ): void {
    this._gauges.get(name)?.set(labels, value);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createMetrics(promClient: any): void {
    const Counter = promClient.Counter;
    const Histogram = promClient.Histogram;
    const Gauge = promClient.Gauge;

    const counterDefs: {
      name: string;
      help: string;
      labels: string[];
    }[] = [
      { name: "task_poll_total", help: "Total task polls", labels: ["taskType"] },
      { name: "task_execution_started_total", help: "Total task executions started", labels: ["taskType"] },
      { name: "task_poll_error_total", help: "Total task poll errors", labels: ["taskType", "exception"] },
      { name: "task_execute_error_total", help: "Total task execution errors", labels: ["taskType", "exception"] },
      { name: "task_update_error_total", help: "Total task update errors", labels: ["taskType", "exception"] },
      { name: "task_ack_error_total", help: "Total task ack errors", labels: ["taskType", "exception"] },
      { name: "task_ack_failed_total", help: "Total task ack failures", labels: ["taskType"] },
      { name: "task_execution_queue_full_total", help: "Task execution queue full", labels: ["taskType"] },
      { name: "task_paused_total", help: "Task paused events", labels: ["taskType"] },
      { name: "thread_uncaught_exceptions_total", help: "Uncaught exceptions", labels: ["exception"] },
      { name: "external_payload_used_total", help: "External payload used", labels: ["entityName", "operation", "payloadType"] },
      { name: "workflow_start_error_total", help: "Workflow start errors", labels: ["workflowType", "exception"] },
    ];

    for (const def of counterDefs) {
      this._counters.set(
        def.name,
        new Counter({
          name: def.name,
          help: def.help,
          labelNames: def.labels,
        }),
      );
    }

    const timeBuckets = [...TIME_BUCKETS];
    const sizeBuckets = [...SIZE_BUCKETS];

    const histogramDefs: {
      name: string;
      help: string;
      labels: string[];
      buckets: number[];
    }[] = [
      { name: "task_poll_time_seconds", help: "Task poll duration (seconds)", labels: ["taskType", "status"], buckets: timeBuckets },
      { name: "task_execute_time_seconds", help: "Task execution duration (seconds)", labels: ["taskType", "status"], buckets: timeBuckets },
      { name: "task_update_time_seconds", help: "Task update duration (seconds)", labels: ["taskType", "status"], buckets: timeBuckets },
      { name: "http_api_client_request_seconds", help: "HTTP API client request duration (seconds)", labels: ["method", "uri", "status"], buckets: timeBuckets },
      { name: "task_result_size_bytes", help: "Task result size (bytes)", labels: ["taskType"], buckets: sizeBuckets },
      { name: "workflow_input_size_bytes", help: "Workflow input size (bytes)", labels: ["workflowType", "version"], buckets: sizeBuckets },
    ];

    for (const def of histogramDefs) {
      this._histograms.set(
        def.name,
        new Histogram({
          name: def.name,
          help: def.help,
          labelNames: def.labels,
          buckets: def.buckets,
        }),
      );
    }

    const gaugeDefs: {
      name: string;
      help: string;
      labels: string[];
    }[] = [
      { name: "active_workers", help: "Workers actively executing tasks", labels: ["taskType"] },
    ];

    for (const def of gaugeDefs) {
      this._gauges.set(
        def.name,
        new Gauge({
          name: def.name,
          help: def.help,
          labelNames: def.labels,
        }),
      );
    }
  }
}
