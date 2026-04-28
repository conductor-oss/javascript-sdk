/**
 * Optional adapter for the `prom-client` npm package.
 *
 * If `prom-client` is installed, this creates real Prometheus Counter, Summary,
 * Histogram, and Gauge objects for native integration with Prometheus scraping.
 *
 * Legacy metrics use Counter + Summary (prefixed, task_type, ms).
 * Canonical metrics use Counter + Histogram + Gauge (unprefixed, taskType, seconds).
 *
 * Install: `npm install prom-client`
 */

// prom-client types (minimal subset we use)
interface PromCounter {
  inc(labels: Record<string, string>, value?: number): void;
}
interface PromSummary {
  observe(labels: Record<string, string>, value: number): void;
}
interface PromHistogram {
  observe(labels: Record<string, string>, value: number): void;
}
interface PromGauge {
  set(labels: Record<string, string>, value: number): void;
  inc(labels: Record<string, string>, value?: number): void;
  dec(labels: Record<string, string>, value?: number): void;
}
interface PromRegistry {
  metrics(): Promise<string>;
  contentType: string;
}

const CANONICAL_BUCKETS = [
  0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

export class PrometheusRegistry {
  private _counters = new Map<string, PromCounter>();
  private _summaries = new Map<string, PromSummary>();
  private _histograms = new Map<string, PromHistogram>();
  private _gauges = new Map<string, PromGauge>();
  private _registry?: PromRegistry;
  private _available = false;

  async initialize(prefix: string): Promise<boolean> {
    try {
      const promClient = await import("prom-client");
      this._registry = promClient.register;
      this.createMetrics(promClient, prefix);
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
    return this._registry?.contentType ?? "text/plain; version=0.0.4; charset=utf-8";
  }

  async metrics(): Promise<string> {
    if (!this._registry) return "";
    return this._registry.metrics();
  }

  // Legacy operations
  incrementCounter(name: string, labels: Record<string, string>, value = 1): void {
    this._counters.get(name)?.inc(labels, value);
  }

  observeSummary(name: string, labels: Record<string, string>, value: number): void {
    this._summaries.get(name)?.observe(labels, value);
  }

  // Canonical operations
  incrementCanonicalCounter(name: string, labels: Record<string, string>, value = 1): void {
    this._counters.get(name)?.inc(labels, value);
  }

  observeCanonicalHistogram(name: string, labels: Record<string, string>, value: number): void {
    this._histograms.get(name)?.observe(labels, value);
  }

  setCanonicalGauge(name: string, labels: Record<string, string>, value: number): void {
    this._gauges.get(name)?.set(labels, value);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createMetrics(promClient: any, p: string): void {
    const Counter = promClient.Counter;
    const Summary = promClient.Summary;
    const Histogram = promClient.Histogram;
    const Gauge = promClient.Gauge;

    // ── Legacy labelled counters ──
    const counterDefs: { key: string; name: string; help: string; labels: string[] }[] = [
      { key: "poll_total", name: `${p}_task_poll_total`, help: "Total task polls", labels: ["task_type"] },
      { key: "poll_error_total", name: `${p}_task_poll_error_total`, help: "Total task poll errors", labels: ["task_type"] },
      { key: "execute_total", name: `${p}_task_execute_total`, help: "Total task executions", labels: ["task_type"] },
      { key: "execute_error_total", name: `${p}_task_execute_error_total`, help: "Total task execution errors", labels: ["task_type"] },
      { key: "update_error_total", name: `${p}_task_update_error_total`, help: "Total task update failures", labels: ["task_type"] },
      { key: "ack_error_total", name: `${p}_task_ack_error_total`, help: "Total task ack errors", labels: ["task_type"] },
      { key: "queue_full_total", name: `${p}_task_execution_queue_full_total`, help: "Task execution queue full", labels: ["task_type"] },
      { key: "paused_total", name: `${p}_task_paused_total`, help: "Task paused events", labels: ["task_type"] },
      { key: "external_payload_total", name: `${p}_external_payload_used_total`, help: "External payload used", labels: ["payload_type"] },
      { key: "uncaught_total", name: `${p}_thread_uncaught_exceptions_total`, help: "Uncaught exceptions", labels: [] },
      { key: "restart_total", name: `${p}_worker_restart_total`, help: "Worker restarts", labels: [] },
      { key: "wf_start_error_total", name: `${p}_workflow_start_error_total`, help: "Workflow start errors", labels: [] },
    ];

    for (const def of counterDefs) {
      this._counters.set(def.key, new Counter({
        name: def.name,
        help: def.help,
        labelNames: def.labels,
      }));
    }

    // ── Legacy summaries ──
    const summaryDefs: { key: string; name: string; help: string; labels: string[] }[] = [
      { key: "poll_time", name: `${p}_task_poll_time`, help: "Task poll duration (ms)", labels: ["task_type"] },
      { key: "execute_time", name: `${p}_task_execute_time`, help: "Task execution duration (ms)", labels: ["task_type"] },
      { key: "update_time", name: `${p}_task_update_time`, help: "Task update duration (ms)", labels: ["task_type"] },
      { key: "result_size", name: `${p}_task_result_size_bytes`, help: "Task result size (bytes)", labels: ["task_type"] },
      { key: "wf_input_size", name: `${p}_workflow_input_size_bytes`, help: "Workflow input size (bytes)", labels: ["workflow_type"] },
      { key: "api_request", name: `${p}_http_api_client_request`, help: "API request duration (ms)", labels: ["endpoint"] },
    ];

    const quantiles = [0.5, 0.75, 0.9, 0.95, 0.99];
    for (const def of summaryDefs) {
      this._summaries.set(def.key, new Summary({
        name: def.name,
        help: def.help,
        labelNames: def.labels,
        percentiles: quantiles,
        maxAgeSeconds: 600,
        ageBuckets: 5,
      }));
    }

    // ── Canonical counters ──
    const canonicalCounterDefs: { key: string; name: string; help: string; labels: string[] }[] = [
      { key: "c_task_poll_total", name: "task_poll_total", help: "Total task polls", labels: ["taskType"] },
      { key: "c_task_execution_started_total", name: "task_execution_started_total", help: "Total task executions started", labels: ["taskType"] },
      { key: "c_task_poll_error_total", name: "task_poll_error_total", help: "Total task poll errors", labels: ["taskType", "exception"] },
      { key: "c_task_execute_error_total", name: "task_execute_error_total", help: "Total task execution errors", labels: ["taskType", "exception"] },
      { key: "c_task_update_error_total", name: "task_update_error_total", help: "Total task update errors", labels: ["taskType", "exception"] },
      { key: "c_task_ack_error_total", name: "task_ack_error_total", help: "Total task ack errors", labels: ["taskType", "exception"] },
      { key: "c_task_ack_failed_total", name: "task_ack_failed_total", help: "Total task ack failures", labels: ["taskType"] },
      { key: "c_task_execution_queue_full_total", name: "task_execution_queue_full_total", help: "Task execution queue full", labels: ["taskType"] },
      { key: "c_task_paused_total", name: "task_paused_total", help: "Task paused events", labels: ["taskType"] },
      { key: "c_thread_uncaught_exceptions_total", name: "thread_uncaught_exceptions_total", help: "Uncaught exceptions", labels: ["exception"] },
      { key: "c_external_payload_used_total", name: "external_payload_used_total", help: "External payload used", labels: ["entityName", "operation", "payloadType", "payload_type"] },
      { key: "c_workflow_start_error_total", name: "workflow_start_error_total", help: "Workflow start errors", labels: ["workflowType", "exception"] },
    ];

    for (const def of canonicalCounterDefs) {
      this._counters.set(def.key, new Counter({
        name: def.name,
        help: def.help,
        labelNames: def.labels,
      }));
    }

    // ── Canonical histograms ──
    const canonicalHistogramDefs: { key: string; name: string; help: string; labels: string[] }[] = [
      { key: "c_task_poll_time_seconds", name: "task_poll_time_seconds", help: "Task poll duration (seconds)", labels: ["taskType", "status"] },
      { key: "c_task_execute_time_seconds", name: "task_execute_time_seconds", help: "Task execution duration (seconds)", labels: ["taskType", "status"] },
      { key: "c_task_update_time_seconds", name: "task_update_time_seconds", help: "Task update duration (seconds)", labels: ["taskType", "status"] },
      { key: "c_http_api_client_request_seconds", name: "http_api_client_request_seconds", help: "HTTP API client request duration (seconds)", labels: ["method", "uri", "status"] },
    ];

    for (const def of canonicalHistogramDefs) {
      this._histograms.set(def.key, new Histogram({
        name: def.name,
        help: def.help,
        labelNames: def.labels,
        buckets: CANONICAL_BUCKETS,
      }));
    }

    // ── Canonical gauges ──
    const canonicalGaugeDefs: { key: string; name: string; help: string; labels: string[] }[] = [
      { key: "c_task_result_size_bytes", name: "task_result_size_bytes", help: "Task result size (bytes)", labels: ["taskType"] },
      { key: "c_workflow_input_size_bytes", name: "workflow_input_size_bytes", help: "Workflow input size (bytes)", labels: ["workflowType", "version"] },
      { key: "c_active_workers", name: "active_workers", help: "Workers actively executing tasks", labels: ["taskType"] },
    ];

    for (const def of canonicalGaugeDefs) {
      this._gauges.set(def.key, new Gauge({
        name: def.name,
        help: def.help,
        labelNames: def.labels,
      }));
    }
  }
}
