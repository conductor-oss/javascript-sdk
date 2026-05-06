import type {
  TaskRunnerEventsListener,
} from "../../clients/worker/events";

/**
 * Unified metrics collector interface.
 *
 * Both LegacyMetricsCollector and CanonicalMetricsCollector implement this
 * interface so call sites never need to know which variant is active.
 * Methods that only apply to one variant are noops in the other.
 */
export interface MetricsCollectorInterface extends TaskRunnerEventsListener {
  // ── Direct recording methods (superset signatures) ─────────────

  recordTaskExecutionQueueFull(taskType: string): void;
  recordUncaughtException(exception?: string): void;
  recordWorkerRestart(): void;
  recordTaskPaused(taskType: string): void;
  recordTaskAckError(taskType: string, exception?: string): void;
  /** Canonical-only: server declined ack (no exception). Legacy noops. */
  recordTaskAckFailed(taskType: string): void;
  recordWorkflowStartError(workflowType?: string, exception?: string): void;
  recordExternalPayloadUsed(
    payloadType: string,
    entityName?: string,
    operation?: string,
  ): void;
  recordWorkflowInputSize(
    workflowType: string,
    sizeBytes: number,
    version?: string,
  ): void;
  recordApiRequestTime(
    method: string,
    uri: string,
    status: number | string,
    durationMs: number,
  ): void;

  // ── Output / lifecycle ─────────────────────────────────────────

  collectorName(): string;
  getMetrics(): unknown;
  reset(): void;
  stop(): Promise<void>;
  getContentType(): string;
  toPrometheusText(prefix?: string): string;
  toPrometheusTextAsync(): Promise<string>;
}
