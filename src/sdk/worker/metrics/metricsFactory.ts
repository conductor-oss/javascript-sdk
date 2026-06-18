import type { MetricsCollectorConfig } from "./LegacyMetricsCollector";
import type { MetricsCollectorInterface } from "./MetricsCollectorInterface";
import { LegacyMetricsCollector } from "./LegacyMetricsCollector";
import { CanonicalMetricsCollector } from "./CanonicalMetricsCollector";

/**
 * Create the appropriate MetricsCollector based on environment variables.
 *
 * - WORKER_CANONICAL_METRICS=true  -> CanonicalMetricsCollector
 * - Unset / any other value        -> LegacyMetricsCollector (default)
 *
 * WORKER_LEGACY_METRICS is reserved for future use: once canonical becomes
 * the default, setting WORKER_LEGACY_METRICS=true will re-activate legacy
 * metrics.  It is not read by the current implementation.
 */
export function createMetricsCollector(
  config?: MetricsCollectorConfig,
): MetricsCollectorInterface {
  const useCanonical = ["true", "1", "yes"].includes(
    (process.env.WORKER_CANONICAL_METRICS ?? "").toLowerCase(),
  );

  if (useCanonical) {
    // CanonicalMetricsCollector self-registers as the HTTP metrics observer in
    // its constructor, so it instruments http_api_client_request_seconds.
    return new CanonicalMetricsCollector(config);
  }

  // The legacy collector deliberately does NOT become the HTTP metrics
  // observer: pre-harmonization `main` never emitted http_api_client_request
  // (fetchWithRetry was never instrumented), so legacy mode must leave that
  // metric dormant to keep its output identical to main.
  return new LegacyMetricsCollector(config);
}
