/**
 * Optional adapter for the `prom-client` npm package.
 *
 * If `prom-client` is installed, this creates real Prometheus Counter and
 * Summary objects for native integration with Prometheus scraping.
 * The MetricsCollector uses this when `usePromClient: true` is set.
 *
 * Install: `npm install prom-client`
 *
 * @example
 * ```typescript
 * const metrics = new MetricsCollector({ usePromClient: true });
 * // Metrics are now registered in the default prom-client registry
 * // and will appear in prom-client's `register.metrics()` output.
 * ```
 */

// prom-client types (minimal subset we use)
interface PromCounter {
  inc(labels: Record<string, string>, value?: number): void;
}
interface PromSummary {
  observe(labels: Record<string, string>, value: number): void;
}
interface PromRegistry {
  metrics(): Promise<string>;
  contentType: string;
}

export class PrometheusRegistry {
  private _counters = new Map<string, PromCounter>();
  private _summaries = new Map<string, PromSummary>();
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
      // prom-client not installed — fall back to custom format
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

  incrementCounter(name: string, labels: Record<string, string>, value = 1): void {
    this._counters.get(name)?.inc(labels, value);
  }

  observeSummary(name: string, labels: Record<string, string>, value: number): void {
    this._summaries.get(name)?.observe(labels, value);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createMetrics(promClient: any, p: string): void {
    const Counter = promClient.Counter;
    const Summary = promClient.Summary;

    // Labelled counters
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

    // Summaries
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
  }
}
