/**
 * Global metrics observer for recording API client request latency
 * and workflow-level metrics from code outside the event system.
 *
 * `createMetricsCollector()` and `CanonicalMetricsCollector` register
 * themselves here on construction. `LegacyMetricsCollector` does NOT
 * self-register so that direct construction preserves pre-metrics
 * behavior; use `createMetricsCollector()` or call
 * `setHttpMetricsObserver()` explicitly to opt in.
 *
 * fetchWithRetry and WorkflowExecutor call the observer without
 * needing a direct reference.
 */

export interface HttpMetricsObserver {
  readonly measurePayloadSize: boolean;

  recordApiRequestTime(
    method: string,
    uri: string,
    status: number | string,
    durationMs: number,
    metricUri?: string,
  ): void;

  recordWorkflowInputSize(
    workflowType: string,
    sizeBytes: number,
    version?: string,
  ): void;

  recordWorkflowStartError(
    workflowType?: string,
    exception?: string,
  ): void;
}

let _observer: HttpMetricsObserver | undefined;

export function setHttpMetricsObserver(
  observer: HttpMetricsObserver | undefined,
): void {
  _observer = observer;
}

export function getHttpMetricsObserver(): HttpMetricsObserver | undefined {
  return _observer;
}

/**
 * Runs a metrics emit callback in isolation: if the observer/collector throws,
 * the error is logged and swallowed so it can never fail the real request that
 * triggered the emit.
 *
 * No `ConductorLogger` is available at these call sites, so we fall back to
 * `console.warn` (same approach as `EventDispatcher` when no logger is set).
 */
export function safeEmit(fn: () => void, context: string): void {
  try {
    fn();
  } catch (err) {
    console.warn(`[conductor-metrics] failed to record ${context}:`, err);
  }
}
