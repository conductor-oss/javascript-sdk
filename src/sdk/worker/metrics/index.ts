// Interface
export type { MetricsCollectorInterface } from "./MetricsCollectorInterface";

// Implementations
export {
  LegacyMetricsCollector,
  type MetricsCollectorConfig,
  type WorkerMetrics,
} from "./LegacyMetricsCollector";
export { CanonicalMetricsCollector } from "./CanonicalMetricsCollector";

// Backward-compat alias: MetricsCollector → LegacyMetricsCollector
export { LegacyMetricsCollector as MetricsCollector } from "./LegacyMetricsCollector";

// Factory
export { createMetricsCollector } from "./metricsFactory";

// HTTP observer
export {
  type HttpMetricsObserver,
  getHttpMetricsObserver,
  setHttpMetricsObserver,
} from "./httpObserver";

// Server & registries
export { MetricsServer } from "./MetricsServer";
export { PrometheusRegistry } from "./PrometheusRegistry";
export { CanonicalPrometheusRegistry } from "./CanonicalPrometheusRegistry";

// Accumulators (exposed for advanced usage / testing)
export {
  HistogramAccumulator,
  MultiLabelCounter,
  GaugeMetric,
  TIME_BUCKETS,
  SIZE_BUCKETS,
} from "./accumulators";
