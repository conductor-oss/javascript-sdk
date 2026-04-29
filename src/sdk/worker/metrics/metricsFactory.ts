import type { MetricsCollectorConfig } from "./LegacyMetricsCollector";
import type { MetricsCollectorInterface } from "./MetricsCollectorInterface";
import { LegacyMetricsCollector } from "./LegacyMetricsCollector";
import { CanonicalMetricsCollector } from "./CanonicalMetricsCollector";

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
  const useCanonical =
    process.env.WORKER_CANONICAL_METRICS?.toLowerCase() === "true";

  if (useCanonical) {
    return new CanonicalMetricsCollector(config);
  }

  return new LegacyMetricsCollector(config);
}
