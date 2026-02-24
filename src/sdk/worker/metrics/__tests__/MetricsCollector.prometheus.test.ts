import { describe, it, expect, beforeEach } from "@jest/globals";
import { MetricsCollector } from "../MetricsCollector";

describe("MetricsCollector - Prometheus features", () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector({ slidingWindowSize: 1000 });
  });

  // ── toPrometheusText() ──────────────────────────────────────────

  describe("toPrometheusText()", () => {
    it("should return empty string for no metrics", () => {
      const text = collector.toPrometheusText();
      expect(text).toBe("");
    });

    it("should render counter with label in Prometheus format", () => {
      collector.onPollStarted({ taskType: "my_task", workerId: "w1", pollCount: 1, timestamp: new Date() });
      const text = collector.toPrometheusText();
      expect(text).toContain("# HELP conductor_worker_task_poll_total Total number of task polls");
      expect(text).toContain("# TYPE conductor_worker_task_poll_total counter");
      expect(text).toContain('conductor_worker_task_poll_total{task_type="my_task"} 1');
    });

    it("should render summary with quantiles", () => {
      collector.onPollCompleted({ taskType: "task_a", workerId: "w1", durationMs: 10, pollCount: 1, taskCount: 1, timestamp: new Date() });
      collector.onPollCompleted({ taskType: "task_a", workerId: "w1", durationMs: 20, pollCount: 2, taskCount: 1, timestamp: new Date() });
      const text = collector.toPrometheusText();
      expect(text).toContain("# TYPE conductor_worker_task_poll_time summary");
      expect(text).toContain('quantile="0.5"');
      expect(text).toContain('quantile="0.99"');
      expect(text).toContain("_count");
      expect(text).toContain("_sum");
    });

    it("should use custom prefix", () => {
      const c = new MetricsCollector({ prefix: "myapp" });
      c.onPollStarted({ taskType: "t", workerId: "w", pollCount: 1, timestamp: new Date() });
      const text = c.toPrometheusText();
      expect(text).toContain("myapp_task_poll_total");
      expect(text).not.toContain("conductor_worker");
    });

    it("should allow prefix override via parameter", () => {
      collector.onPollStarted({ taskType: "t", workerId: "w", pollCount: 1, timestamp: new Date() });
      const text = collector.toPrometheusText("override_prefix");
      expect(text).toContain("override_prefix_task_poll_total");
    });

    it("should render global counters without labels", () => {
      collector.recordUncaughtException();
      collector.recordUncaughtException();
      const text = collector.toPrometheusText();
      expect(text).toContain("conductor_worker_thread_uncaught_exceptions_total 2");
    });

    it("should not render zero global counters", () => {
      const text = collector.toPrometheusText();
      expect(text).not.toContain("uncaught_exceptions");
      expect(text).not.toContain("worker_restart");
    });
  });

  // ── toPrometheusTextAsync() ─────────────────────────────────────

  describe("toPrometheusTextAsync()", () => {
    it("should return same as sync when no prom-client", async () => {
      collector.onPollStarted({ taskType: "t", workerId: "w", pollCount: 1, timestamp: new Date() });
      const sync = collector.toPrometheusText();
      const asyncResult = await collector.toPrometheusTextAsync();
      expect(asyncResult).toBe(sync);
    });
  });

  // ── getContentType() ────────────────────────────────────────────

  describe("getContentType()", () => {
    it("should return default Prometheus content type", () => {
      expect(collector.getContentType()).toBe("text/plain; version=0.0.4; charset=utf-8");
    });
  });

  // ── Direct recording methods ────────────────────────────────────

  describe("recordTaskExecutionQueueFull()", () => {
    it("should increment taskExecutionQueueFullTotal", () => {
      collector.recordTaskExecutionQueueFull("task_a");
      collector.recordTaskExecutionQueueFull("task_a");
      collector.recordTaskExecutionQueueFull("task_b");
      const m = collector.getMetrics();
      expect(m.taskExecutionQueueFullTotal.get("task_a")).toBe(2);
      expect(m.taskExecutionQueueFullTotal.get("task_b")).toBe(1);
    });
  });

  describe("recordUncaughtException()", () => {
    it("should increment global uncaughtExceptionTotal", () => {
      collector.recordUncaughtException();
      collector.recordUncaughtException();
      expect(collector.getMetrics().uncaughtExceptionTotal).toBe(2);
    });
  });

  describe("recordWorkerRestart()", () => {
    it("should increment global workerRestartTotal", () => {
      collector.recordWorkerRestart();
      expect(collector.getMetrics().workerRestartTotal).toBe(1);
    });
  });

  describe("recordTaskPaused()", () => {
    it("should increment taskPausedTotal by taskType", () => {
      collector.recordTaskPaused("paused_task");
      expect(collector.getMetrics().taskPausedTotal.get("paused_task")).toBe(1);
    });
  });

  describe("recordTaskAckError()", () => {
    it("should increment taskAckErrorTotal by taskType", () => {
      collector.recordTaskAckError("ack_task");
      collector.recordTaskAckError("ack_task");
      expect(collector.getMetrics().taskAckErrorTotal.get("ack_task")).toBe(2);
    });
  });

  describe("recordWorkflowStartError()", () => {
    it("should increment global workflowStartErrorTotal", () => {
      collector.recordWorkflowStartError();
      collector.recordWorkflowStartError();
      collector.recordWorkflowStartError();
      expect(collector.getMetrics().workflowStartErrorTotal).toBe(3);
    });
  });

  describe("recordExternalPayloadUsed()", () => {
    it("should increment externalPayloadUsedTotal by type", () => {
      collector.recordExternalPayloadUsed("workflow_input");
      collector.recordExternalPayloadUsed("task_output");
      collector.recordExternalPayloadUsed("workflow_input");
      const m = collector.getMetrics();
      expect(m.externalPayloadUsedTotal.get("workflow_input")).toBe(2);
      expect(m.externalPayloadUsedTotal.get("task_output")).toBe(1);
    });
  });

  describe("recordWorkflowInputSize()", () => {
    it("should observe workflowInputSizeBytes", () => {
      collector.recordWorkflowInputSize("order_flow", 1024);
      collector.recordWorkflowInputSize("order_flow", 2048);
      const m = collector.getMetrics();
      expect(m.workflowInputSizeBytes.get("order_flow")).toEqual([1024, 2048]);
    });
  });

  describe("recordApiRequestTime()", () => {
    it("should observe apiRequestDurationMs by endpoint key", () => {
      collector.recordApiRequestTime("GET", "/api/workflow", 200, 45);
      collector.recordApiRequestTime("GET", "/api/workflow", 200, 55);
      const m = collector.getMetrics();
      expect(m.apiRequestDurationMs.get("GET:/api/workflow:200")).toEqual([45, 55]);
    });
  });

  // ── Sliding window ──────────────────────────────────────────────

  describe("sliding window", () => {
    it("should trim observations beyond window size", () => {
      const small = new MetricsCollector({ slidingWindowSize: 5 });
      for (let i = 0; i < 10; i++) {
        small.onPollCompleted({ taskType: "t", workerId: "w", durationMs: i, pollCount: i, taskCount: 1, timestamp: new Date() });
      }
      const vals = small.getMetrics().pollDurationMs.get("t")!;
      expect(vals).toHaveLength(5);
      expect(vals).toEqual([5, 6, 7, 8, 9]);
    });
  });

  // ── Quantile accuracy ──────────────────────────────────────────

  describe("quantile calculation", () => {
    it("should compute accurate quantiles in Prometheus output", () => {
      for (let i = 1; i <= 100; i++) {
        collector.onPollCompleted({ taskType: "t", workerId: "w", durationMs: i, pollCount: i, taskCount: 1, timestamp: new Date() });
      }
      const text = collector.toPrometheusText();
      // p50 ≈ 50.5
      expect(text).toMatch(/quantile="0\.5"\} 50/);
      // p99 ≈ 99.01
      expect(text).toMatch(/quantile="0\.99"\} 99/);
      // count = 100
      expect(text).toContain('_count{task_type="t"} 100');
      // sum = 5050
      expect(text).toContain('_sum{task_type="t"} 5050');
    });
  });

  // ── reset() clears new metrics ─────────────────────────────────

  describe("reset()", () => {
    it("should reset all new metric types", () => {
      collector.recordUncaughtException();
      collector.recordWorkerRestart();
      collector.recordWorkflowStartError();
      collector.recordTaskExecutionQueueFull("t");
      collector.recordTaskPaused("t");
      collector.recordTaskAckError("t");
      collector.recordExternalPayloadUsed("t");
      collector.recordWorkflowInputSize("t", 100);
      collector.recordApiRequestTime("GET", "/", 200, 10);

      collector.reset();

      const m = collector.getMetrics();
      expect(m.uncaughtExceptionTotal).toBe(0);
      expect(m.workerRestartTotal).toBe(0);
      expect(m.workflowStartErrorTotal).toBe(0);
      expect(m.taskExecutionQueueFullTotal.size).toBe(0);
      expect(m.taskPausedTotal.size).toBe(0);
      expect(m.taskAckErrorTotal.size).toBe(0);
      expect(m.externalPayloadUsedTotal.size).toBe(0);
      expect(m.workflowInputSizeBytes.size).toBe(0);
      expect(m.apiRequestDurationMs.size).toBe(0);
    });
  });

  // ── stop() ─────────────────────────────────────────────────────

  describe("stop()", () => {
    it("should not throw when no server is running", async () => {
      await expect(collector.stop()).resolves.toBeUndefined();
    });
  });
});
