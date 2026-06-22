import { describe, it, expect, beforeEach } from "@jest/globals";
import { CanonicalPrometheusRegistry } from "../CanonicalPrometheusRegistry";

describe("CanonicalPrometheusRegistry", () => {
  let registry: CanonicalPrometheusRegistry;

  beforeEach(async () => {
    try {
      const promClient = await import("prom-client");
      promClient.register.clear();
    } catch {
      // prom-client not installed — skip cleanup
    }
    registry = new CanonicalPrometheusRegistry();
  });

  describe("before initialization", () => {
    it("should not be available", () => {
      expect(registry.available).toBe(false);
    });

    it("should return default content type", () => {
      expect(registry.contentType).toBe(
        "text/plain; version=0.0.4; charset=utf-8"
      );
    });

    it("should return empty string from metrics()", async () => {
      expect(await registry.metrics()).toBe("");
    });

    it("should not throw when incrementCounter is called", () => {
      expect(() =>
        registry.incrementCounter("task_poll_total", { taskType: "t" })
      ).not.toThrow();
    });

    it("should not throw when observeHistogram is called", () => {
      expect(() =>
        registry.observeHistogram("task_poll_time_seconds", { taskType: "t" }, 0.1)
      ).not.toThrow();
    });

    it("should not throw when setGauge is called", () => {
      expect(() =>
        registry.setGauge("active_workers", { taskType: "t" }, 5)
      ).not.toThrow();
    });
  });

  describe("initialize()", () => {
    it("should return true when prom-client is installed", async () => {
      const result = await registry.initialize();
      expect(result).toBe(true);
      expect(registry.available).toBe(true);
    });

    it("should set contentType from prom-client registry", async () => {
      await registry.initialize();
      expect(registry.contentType).toBeDefined();
      expect(registry.contentType.length).toBeGreaterThan(0);
    });
  });

  describe("after initialization", () => {
    beforeEach(async () => {
      await registry.initialize();
    });

    it("should be available", () => {
      expect(registry.available).toBe(true);
    });

    it("should return metrics text from prom-client", async () => {
      const text = await registry.metrics();
      expect(typeof text).toBe("string");
    });

    it("should increment a counter and see it in metrics output", async () => {
      registry.incrementCounter("task_poll_total", { taskType: "test_t" });
      registry.incrementCounter("task_poll_total", { taskType: "test_t" });
      const text = await registry.metrics();
      expect(text).toContain("task_poll_total");
      expect(text).toContain("test_t");
    });

    it("should observe a histogram and see it in metrics output", async () => {
      registry.observeHistogram(
        "task_poll_time_seconds",
        { taskType: "test_t", status: "SUCCESS" },
        0.05
      );
      const text = await registry.metrics();
      expect(text).toContain("task_poll_time_seconds");
      expect(text).toContain("test_t");
    });

    it("should set a gauge and see it in metrics output", async () => {
      registry.setGauge("active_workers", { taskType: "test_t" }, 3);
      const text = await registry.metrics();
      expect(text).toContain("active_workers");
      expect(text).toContain("test_t");
    });

    it("should handle unknown counter key as no-op", () => {
      expect(() =>
        registry.incrementCounter("nonexistent", { x: "y" })
      ).not.toThrow();
    });

    it("should handle unknown histogram key as no-op", () => {
      expect(() =>
        registry.observeHistogram("nonexistent", { x: "y" }, 1)
      ).not.toThrow();
    });

    it("should handle unknown gauge key as no-op", () => {
      expect(() =>
        registry.setGauge("nonexistent", { x: "y" }, 1)
      ).not.toThrow();
    });

    it("should accept custom increment value for counter", () => {
      expect(() =>
        registry.incrementCounter("task_poll_total", { taskType: "t" }, 5)
      ).not.toThrow();
    });

    it("should record all counter types", async () => {
      registry.incrementCounter("task_poll_total", { taskType: "t" });
      registry.incrementCounter("task_execution_started_total", { taskType: "t" });
      registry.incrementCounter("task_poll_error_total", { taskType: "t", exception: "Error" });
      registry.incrementCounter("task_execute_error_total", { taskType: "t", exception: "Error" });
      registry.incrementCounter("task_update_error_total", { taskType: "t", exception: "Error" });
      registry.incrementCounter("task_ack_error_total", { taskType: "t", exception: "Error" });
      registry.incrementCounter("task_ack_failed_total", { taskType: "t" });
      registry.incrementCounter("task_execution_queue_full_total", { taskType: "t" });
      registry.incrementCounter("task_paused_total", { taskType: "t" });
      registry.incrementCounter("thread_uncaught_exceptions_total", { exception: "Error" });
      registry.incrementCounter("external_payload_used_total", { entityName: "e", operation: "o", payloadType: "p" });
      registry.incrementCounter("workflow_start_error_total", { workflowType: "w", exception: "Error" });

      const text = await registry.metrics();
      expect(text).toContain("task_poll_total");
      expect(text).toContain("task_execution_started_total");
      expect(text).toContain("task_poll_error_total");
      expect(text).toContain("task_ack_failed_total");
      expect(text).toContain("thread_uncaught_exceptions_total");
      expect(text).toContain("external_payload_used_total");
      expect(text).toContain("workflow_start_error_total");
    });

    it("should record all histogram types", async () => {
      registry.observeHistogram("task_poll_time_seconds", { taskType: "t", status: "SUCCESS" }, 0.1);
      registry.observeHistogram("task_execute_time_seconds", { taskType: "t", status: "SUCCESS" }, 0.5);
      registry.observeHistogram("task_update_time_seconds", { taskType: "t", status: "SUCCESS" }, 0.02);
      registry.observeHistogram("http_api_client_request_seconds", { method: "GET", uri: "/api", status: "200" }, 0.1);
      registry.observeHistogram("task_result_size_bytes", { taskType: "t" }, 1024);
      registry.observeHistogram("workflow_input_size_bytes", { workflowType: "w", version: "1" }, 512);

      const text = await registry.metrics();
      expect(text).toContain("task_poll_time_seconds");
      expect(text).toContain("task_execute_time_seconds");
      expect(text).toContain("task_update_time_seconds");
      expect(text).toContain("http_api_client_request_seconds");
      expect(text).toContain("task_result_size_bytes");
      expect(text).toContain("workflow_input_size_bytes");
    });

    it("should record gauge metric", async () => {
      registry.setGauge("active_workers", { taskType: "t" }, 7);
      const text = await registry.metrics();
      expect(text).toContain("active_workers");
    });
  });
});
