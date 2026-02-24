import { describe, it, expect, beforeEach } from "@jest/globals";
import { PrometheusRegistry } from "../PrometheusRegistry";

describe("PrometheusRegistry", () => {
  let registry: PrometheusRegistry;

  beforeEach(async () => {
    // Clear prom-client's default registry between tests to avoid duplicate metric errors
    try {
      const promClient = await import("prom-client");
      promClient.register.clear();
    } catch {
      // prom-client not installed — skip cleanup
    }
    registry = new PrometheusRegistry();
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
        registry.incrementCounter("poll_total", { task_type: "t" })
      ).not.toThrow();
    });

    it("should not throw when observeSummary is called", () => {
      expect(() =>
        registry.observeSummary("poll_time", { task_type: "t" }, 42)
      ).not.toThrow();
    });
  });

  describe("initialize()", () => {
    it("should return true when prom-client is installed", async () => {
      const result = await registry.initialize("conductor_worker");
      expect(result).toBe(true);
      expect(registry.available).toBe(true);
    });

    it("should set contentType from prom-client registry", async () => {
      await registry.initialize("test");
      // prom-client's content type includes openmetrics or text/plain
      expect(registry.contentType).toBeDefined();
      expect(registry.contentType.length).toBeGreaterThan(0);
    });
  });

  describe("after initialization", () => {
    beforeEach(async () => {
      await registry.initialize("test_prefix");
    });

    it("should be available", () => {
      expect(registry.available).toBe(true);
    });

    it("should return metrics text from prom-client", async () => {
      const text = await registry.metrics();
      expect(typeof text).toBe("string");
    });

    it("should increment a counter without error", () => {
      expect(() =>
        registry.incrementCounter("poll_total", { task_type: "my_task" })
      ).not.toThrow();
    });

    it("should observe a summary without error", () => {
      expect(() =>
        registry.observeSummary("poll_time", { task_type: "my_task" }, 42)
      ).not.toThrow();
    });

    it("should record counter increments in metrics output", async () => {
      registry.incrementCounter("poll_total", { task_type: "test_t" });
      registry.incrementCounter("poll_total", { task_type: "test_t" });
      const text = await registry.metrics();
      expect(text).toContain("test_prefix_task_poll_total");
      expect(text).toContain("test_t");
    });

    it("should record summary observations in metrics output", async () => {
      registry.observeSummary("execute_time", { task_type: "test_t" }, 100);
      registry.observeSummary("execute_time", { task_type: "test_t" }, 200);
      const text = await registry.metrics();
      expect(text).toContain("test_prefix_task_execute_time");
    });

    it("should handle unknown counter key as no-op", () => {
      expect(() =>
        registry.incrementCounter("nonexistent", { x: "y" })
      ).not.toThrow();
    });

    it("should handle unknown summary key as no-op", () => {
      expect(() =>
        registry.observeSummary("nonexistent", { x: "y" }, 1)
      ).not.toThrow();
    });

    it("should accept custom increment value", () => {
      expect(() =>
        registry.incrementCounter("poll_total", { task_type: "t" }, 5)
      ).not.toThrow();
    });

    it("should record global counters (no labels)", async () => {
      registry.incrementCounter("uncaught_total", {});
      registry.incrementCounter("restart_total", {});
      registry.incrementCounter("wf_start_error_total", {});
      const text = await registry.metrics();
      expect(text).toContain("uncaught_exceptions_total");
      expect(text).toContain("worker_restart_total");
      expect(text).toContain("workflow_start_error_total");
    });

    it("should record all summary types", async () => {
      registry.observeSummary("poll_time", { task_type: "t" }, 10);
      registry.observeSummary("execute_time", { task_type: "t" }, 20);
      registry.observeSummary("result_size", { task_type: "t" }, 1024);
      registry.observeSummary("wf_input_size", { workflow_type: "w" }, 512);
      registry.observeSummary("api_request", { endpoint: "GET:/api" }, 50);
      const text = await registry.metrics();
      expect(text).toContain("task_poll_time");
      expect(text).toContain("task_execute_time");
      expect(text).toContain("task_result_size_bytes");
      expect(text).toContain("workflow_input_size_bytes");
      expect(text).toContain("http_api_client_request");
    });
  });
});
