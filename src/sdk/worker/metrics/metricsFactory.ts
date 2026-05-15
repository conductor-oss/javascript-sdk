import type { MetricsCollectorConfig } from "./LegacyMetricsCollector";
import type { MetricsCollectorInterface } from "./MetricsCollectorInterface";
import { LegacyMetricsCollector } from "./LegacyMetricsCollector";
import { CanonicalMetricsCollector } from "./CanonicalMetricsCollector";
import { setHttpMetricsObserver } from "./httpObserver";

/**
 * Create the appropriate MetricsCollector based on environment variables.
 *
 * - WORKER_CANONICAL_METRICS=true  -> CanonicalMetricsCollector  (default: false)
 * - WORKER_LEGACY_METRICS=true     -> LegacyMetricsCollector     (default: true)
 *
 * WORKER_CANONICAL_METRICS takes priority when both are set.
 * During the deprecation transition period the default is legacy.
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
