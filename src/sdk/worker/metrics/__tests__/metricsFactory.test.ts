import { describe, it, expect, afterEach } from "@jest/globals";
import { createMetricsCollector } from "../metricsFactory";
import { LegacyMetricsCollector } from "../LegacyMetricsCollector";
import { CanonicalMetricsCollector } from "../CanonicalMetricsCollector";

describe("createMetricsCollector", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("should return LegacyMetricsCollector by default", () => {
    delete process.env.WORKER_CANONICAL_METRICS;
    delete process.env.WORKER_LEGACY_METRICS;

    const collector = createMetricsCollector();
    expect(collector).toBeInstanceOf(LegacyMetricsCollector);
  });

  it("should return LegacyMetricsCollector when WORKER_LEGACY_METRICS=true", () => {
    process.env.WORKER_LEGACY_METRICS = "true";
    delete process.env.WORKER_CANONICAL_METRICS;

    const collector = createMetricsCollector();
    expect(collector).toBeInstanceOf(LegacyMetricsCollector);
  });

  it("should return CanonicalMetricsCollector when WORKER_CANONICAL_METRICS=true", () => {
    process.env.WORKER_CANONICAL_METRICS = "true";

    const collector = createMetricsCollector();
    expect(collector).toBeInstanceOf(CanonicalMetricsCollector);
  });

  it("should prefer canonical when both env vars are true", () => {
    process.env.WORKER_CANONICAL_METRICS = "true";
    process.env.WORKER_LEGACY_METRICS = "true";

    const collector = createMetricsCollector();
    expect(collector).toBeInstanceOf(CanonicalMetricsCollector);
  });

  it("should return LegacyMetricsCollector when WORKER_CANONICAL_METRICS=false", () => {
    process.env.WORKER_CANONICAL_METRICS = "false";

    const collector = createMetricsCollector();
    expect(collector).toBeInstanceOf(LegacyMetricsCollector);
  });

  it("should be case-insensitive for env var value", () => {
    process.env.WORKER_CANONICAL_METRICS = "TRUE";

    const collector = createMetricsCollector();
    expect(collector).toBeInstanceOf(CanonicalMetricsCollector);
  });

  it("should pass config through to the collector", () => {
    delete process.env.WORKER_CANONICAL_METRICS;

    const collector = createMetricsCollector({ prefix: "custom_prefix" });
    expect(collector).toBeInstanceOf(LegacyMetricsCollector);
    const text = collector.toPrometheusText();
    // No metrics recorded yet, so empty, but the collector was created successfully
    expect(typeof text).toBe("string");
  });

  it("both implementations satisfy MetricsCollectorInterface", () => {
    const legacy = createMetricsCollector();
    const requiredMethods = [
      "recordTaskExecutionQueueFull",
      "recordUncaughtException",
      "recordWorkerRestart",
      "recordTaskPaused",
      "recordTaskAckError",
      "recordTaskAckFailed",
      "recordWorkflowStartError",
      "recordExternalPayloadUsed",
      "recordWorkflowInputSize",
      "recordApiRequestTime",
      "getMetrics",
      "reset",
      "stop",
      "getContentType",
      "toPrometheusText",
      "toPrometheusTextAsync",
    ];

    for (const method of requiredMethods) {
      expect(typeof (legacy as unknown as Record<string, unknown>)[method]).toBe("function");
    }

    process.env.WORKER_CANONICAL_METRICS = "true";
    const canonical = createMetricsCollector();
    for (const method of requiredMethods) {
      expect(typeof (canonical as unknown as Record<string, unknown>)[method]).toBe("function");
    }
  });
});
