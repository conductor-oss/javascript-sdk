import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { createMetricsCollector } from "../metricsFactory";
import { LegacyMetricsCollector } from "../LegacyMetricsCollector";
import { CanonicalMetricsCollector } from "../CanonicalMetricsCollector";
import {
  getHttpMetricsObserver,
  setHttpMetricsObserver,
} from "../httpObserver";

describe("createMetricsCollector", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    setHttpMetricsObserver(undefined);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    setHttpMetricsObserver(undefined);
  });

  it("should return LegacyMetricsCollector by default", () => {
    delete process.env.WORKER_CANONICAL_METRICS;

    const collector = createMetricsCollector();
    expect(collector).toBeInstanceOf(LegacyMetricsCollector);
  });

  it("should return CanonicalMetricsCollector when WORKER_CANONICAL_METRICS=true", () => {
    process.env.WORKER_CANONICAL_METRICS = "true";

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

  it('should return CanonicalMetricsCollector when WORKER_CANONICAL_METRICS="1"', () => {
    process.env.WORKER_CANONICAL_METRICS = "1";

    const collector = createMetricsCollector();
    expect(collector).toBeInstanceOf(CanonicalMetricsCollector);
  });

  it('should return CanonicalMetricsCollector when WORKER_CANONICAL_METRICS="yes"', () => {
    process.env.WORKER_CANONICAL_METRICS = "yes";

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

  it('legacy collector returns "legacy" from collectorName()', () => {
    delete process.env.WORKER_CANONICAL_METRICS;

    const collector = createMetricsCollector();
    expect(collector.collectorName()).toBe("legacy");
  });

  it('canonical collector returns "canonical" from collectorName()', () => {
    process.env.WORKER_CANONICAL_METRICS = "true";

    const collector = createMetricsCollector();
    expect(collector.collectorName()).toBe("canonical");
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
      "collectorName",
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

  it("does NOT register the legacy collector as the HTTP metrics observer", () => {
    delete process.env.WORKER_CANONICAL_METRICS;

    const collector = createMetricsCollector();
    expect(collector).toBeInstanceOf(LegacyMetricsCollector);
    // Legacy mode must leave the HTTP observer unset so http_api_client_request
    // stays dormant and legacy output matches main.
    expect(getHttpMetricsObserver()).toBeUndefined();
  });

  it("registers the canonical collector as the HTTP metrics observer", () => {
    process.env.WORKER_CANONICAL_METRICS = "true";

    const collector = createMetricsCollector();
    expect(collector).toBeInstanceOf(CanonicalMetricsCollector);
    expect(getHttpMetricsObserver()).toBe(collector);
  });

  it("legacy collector emits no http_api_client_request even if recordApiRequestTime is called", () => {
    delete process.env.WORKER_CANONICAL_METRICS;

    const collector = createMetricsCollector();
    collector.recordApiRequestTime("GET", "/api/workflow/abc-123", 200, 45, "/workflow/{workflowId}");
    expect(collector.toPrometheusText()).not.toContain("http_api_client_request");
  });
});
