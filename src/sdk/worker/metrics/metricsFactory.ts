import type { MetricsCollectorConfig } from "./LegacyMetricsCollector";
import type { MetricsCollectorInterface } from "./MetricsCollectorInterface";
import { LegacyMetricsCollector } from "./LegacyMetricsCollector";
import { CanonicalMetricsCollector } from "./CanonicalMetricsCollector";
import { setHttpMetricsObserver } from "./httpObserver";

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

  const collector = useCanonical
    ? new CanonicalMetricsCollector(config)
    : new LegacyMetricsCollector(config);

  setHttpMetricsObserver(collector);
  return collector;
}
