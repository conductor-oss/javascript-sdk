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
