import { describe, it, expect, beforeEach } from "@jest/globals";
import { CanonicalMetricsCollector } from "../CanonicalMetricsCollector";

describe("CanonicalMetricsCollector", () => {
  let collector: CanonicalMetricsCollector;

  beforeEach(() => {
    collector = new CanonicalMetricsCollector();
  });

  describe("poll metrics", () => {
    it("should emit task_poll_total counter on onPollStarted", () => {
      collector.onPollStarted({
        taskType: "task_a",
        workerId: "w1",
        pollCount: 5,
        timestamp: new Date(),
      });
      collector.onPollStarted({
        taskType: "task_a",
        workerId: "w1",
        pollCount: 5,
        timestamp: new Date(),
      });

      const text = collector.toPrometheusText();
      expect(text).toContain("# TYPE task_poll_total counter");
      expect(text).toContain('task_poll_total{taskType="task_a"} 2');
    });

    it("should emit task_poll_time_seconds histogram on onPollCompleted", () => {
      collector.onPollCompleted({
        taskType: "task_a",
        durationMs: 100,
        tasksReceived: 3,
        timestamp: new Date(),
      });

      const text = collector.toPrometheusText();
      expect(text).toContain("# TYPE task_poll_time_seconds histogram");
      expect(text).toContain('task_poll_time_seconds_bucket{taskType="task_a",status="SUCCESS",le="0.1"} 1');
      expect(text).toContain('task_poll_time_seconds_sum{taskType="task_a",status="SUCCESS"} 0.1');
      expect(text).toContain('task_poll_time_seconds_count{taskType="task_a",status="SUCCESS"} 1');
    });

    it("should emit task_poll_error_total with exception label on onPollFailure", () => {
      collector.onPollFailure({
        taskType: "task_a",
        durationMs: 5000,
        cause: new TypeError("timeout"),
        timestamp: new Date(),
      });

      const text = collector.toPrometheusText();
      expect(text).toContain('task_poll_error_total{taskType="task_a",exception="TypeError"} 1');
      expect(text).toContain('task_poll_time_seconds_bucket{taskType="task_a",status="FAILURE"');
    });
  });

  describe("execution metrics", () => {
    it("should emit task_execution_started_total on onTaskExecutionStarted", () => {
      collector.onTaskExecutionStarted({
        taskType: "task_a",
        taskId: "t1",
        workerId: "w1",
        timestamp: new Date(),
      });

      const text = collector.toPrometheusText();
      expect(text).toContain('task_execution_started_total{taskType="task_a"} 1');
    });

    it("should track active_workers gauge", () => {
      collector.onTaskExecutionStarted({
        taskType: "task_a",
        taskId: "t1",
        workerId: "w1",
        timestamp: new Date(),
      });
      collector.onTaskExecutionStarted({
        taskType: "task_a",
        taskId: "t2",
        workerId: "w1",
        timestamp: new Date(),
      });

      let text = collector.toPrometheusText();
      expect(text).toContain('active_workers{taskType="task_a"} 2');

      collector.onTaskExecutionCompleted({
        taskType: "task_a",
        taskId: "t1",
        workerId: "w1",
        durationMs: 200,
        timestamp: new Date(),
      });

      text = collector.toPrometheusText();
      expect(text).toContain('active_workers{taskType="task_a"} 1');
    });

    it("should emit task_execute_time_seconds histogram on completion", () => {
      collector.onTaskExecutionCompleted({
        taskType: "task_a",
        taskId: "t1",
        workerId: "w1",
        durationMs: 500,
        timestamp: new Date(),
      });

      const text = collector.toPrometheusText();
      expect(text).toContain("# TYPE task_execute_time_seconds histogram");
      expect(text).toContain('task_execute_time_seconds_sum{taskType="task_a",status="SUCCESS"} 0.5');
    });

    it("should emit task_result_size_bytes histogram on completion", () => {
      collector.onTaskExecutionCompleted({
        taskType: "task_a",
        taskId: "t1",
        workerId: "w1",
        durationMs: 200,
        outputSizeBytes: 5000,
        timestamp: new Date(),
      });

      const text = collector.toPrometheusText();
      expect(text).toContain("# TYPE task_result_size_bytes histogram");
      expect(text).toContain('task_result_size_bytes_sum{taskType="task_a"} 5000');
    });

    it("should emit task_execute_error_total with exception label on failure", () => {
      const err = new TypeError("invalid input");
      collector.onTaskExecutionFailure({
        taskType: "task_a",
        taskId: "t1",
        workerId: "w1",
        cause: err,
        durationMs: 50,
        timestamp: new Date(),
      });

      const text = collector.toPrometheusText();
      expect(text).toContain('task_execute_error_total{taskType="task_a",exception="TypeError"} 1');
      expect(text).toContain('task_execute_time_seconds_bucket{taskType="task_a",status="FAILURE"');
    });
  });

  describe("task update metrics", () => {
    it("should emit task_update_time_seconds histogram on completion", () => {
      collector.onTaskUpdateCompleted({
        taskType: "task_a",
        taskId: "t1",
        workerId: "w1",
        durationMs: 25,
        timestamp: new Date(),
      });

      const text = collector.toPrometheusText();
      expect(text).toContain("# TYPE task_update_time_seconds histogram");
      expect(text).toContain('task_update_time_seconds_sum{taskType="task_a",status="SUCCESS"} 0.025');
    });

    it("should emit task_update_error_total with exception label on failure", () => {
      collector.onTaskUpdateFailure({
        taskType: "task_a",
        taskId: "t1",
        workerId: "w1",
        cause: new Error("server error"),
        retryCount: 4,
        taskResult: {},
        timestamp: new Date(),
      });

      const text = collector.toPrometheusText();
      expect(text).toContain('task_update_error_total{taskType="task_a",exception="Error"} 1');
    });
  });

  describe("direct recording methods", () => {
    it("recordTaskExecutionQueueFull should emit counter", () => {
      collector.recordTaskExecutionQueueFull("task_a");
      collector.recordTaskExecutionQueueFull("task_a");

      const text = collector.toPrometheusText();
      expect(text).toContain('task_execution_queue_full_total{taskType="task_a"} 2');
    });

    it("recordUncaughtException should emit counter with exception label", () => {
      collector.recordUncaughtException("RangeError");
      collector.recordUncaughtException("RangeError");
      collector.recordUncaughtException("TypeError");

      const text = collector.toPrometheusText();
      expect(text).toContain('thread_uncaught_exceptions_total{exception="RangeError"} 2');
      expect(text).toContain('thread_uncaught_exceptions_total{exception="TypeError"} 1');
    });

    it("recordWorkerRestart should be a noop (N/A for JS)", () => {
      collector.recordWorkerRestart();
      const text = collector.toPrometheusText();
      expect(text).not.toContain("worker_restart");
    });

    it("recordTaskPaused should emit counter", () => {
      collector.recordTaskPaused("paused_task");
      const text = collector.toPrometheusText();
      expect(text).toContain('task_paused_total{taskType="paused_task"} 1');
    });

    it("recordTaskAckError should emit counter with exception label", () => {
      collector.recordTaskAckError("task_a", "TimeoutError");
      const text = collector.toPrometheusText();
      expect(text).toContain('task_ack_error_total{taskType="task_a",exception="TimeoutError"} 1');
    });

    it("recordTaskAckFailed should emit counter", () => {
      collector.recordTaskAckFailed("task_a");
      const text = collector.toPrometheusText();
      expect(text).toContain('task_ack_failed_total{taskType="task_a"} 1');
    });

    it("recordWorkflowStartError should emit counter with labels", () => {
      collector.recordWorkflowStartError("my_workflow", "NetworkError");
      const text = collector.toPrometheusText();
      expect(text).toContain('workflow_start_error_total{workflowType="my_workflow",exception="NetworkError"} 1');
    });

    it("recordExternalPayloadUsed should emit counter with labels", () => {
      collector.recordExternalPayloadUsed("TASK_OUTPUT", "myEntity", "WRITE");
      const text = collector.toPrometheusText();
      expect(text).toContain('external_payload_used_total{entityName="myEntity",operation="WRITE",payloadType="TASK_OUTPUT"} 1');
    });

    it("recordWorkflowInputSize should emit histogram", () => {
      collector.recordWorkflowInputSize("order_flow", 50000, "1");
      const text = collector.toPrometheusText();
      expect(text).toContain("# TYPE workflow_input_size_bytes histogram");
      expect(text).toContain('workflow_input_size_bytes_sum{workflowType="order_flow",version="1"} 50000');
    });

    it("recordApiRequestTime should emit histogram in seconds", () => {
      collector.recordApiRequestTime("GET", "/api/workflow", 200, 45);
      const text = collector.toPrometheusText();
      expect(text).toContain("# TYPE http_api_client_request_seconds histogram");
      expect(text).toContain('http_api_client_request_seconds_sum{method="GET",uri="/api/workflow",status="200"} 0.045');
    });
  });

  describe("onTaskPaused event", () => {
    it("should increment task_paused_total", () => {
      collector.onTaskPaused({
        taskType: "paused_task",
        timestamp: new Date(),
      });
      const text = collector.toPrometheusText();
      expect(text).toContain('task_paused_total{taskType="paused_task"} 1');
    });
  });

  describe("reset", () => {
    it("should clear all canonical metrics", () => {
      collector.onPollStarted({
        taskType: "task_a",
        workerId: "w1",
        pollCount: 1,
        timestamp: new Date(),
      });
      collector.recordUncaughtException("Error");
      collector.recordTaskAckFailed("task_a");

      collector.reset();

      const text = collector.toPrometheusText();
      expect(text).toBe("");
    });
  });

  describe("output format", () => {
    it("should not apply a prefix to canonical metric names", () => {
      collector.onPollStarted({
        taskType: "t",
        workerId: "w",
        pollCount: 1,
        timestamp: new Date(),
      });
      const text = collector.toPrometheusText();
      expect(text).not.toContain("conductor_worker");
      expect(text).toContain("task_poll_total{");
    });

    it("should use seconds for time histograms", () => {
      collector.onPollCompleted({
        taskType: "t",
        durationMs: 1000,
        tasksReceived: 1,
        timestamp: new Date(),
      });
      const text = collector.toPrometheusText();
      expect(text).toContain("task_poll_time_seconds");
      expect(text).toContain('_sum{taskType="t",status="SUCCESS"} 1');
    });

    it("should use camelCase taskType label", () => {
      collector.onPollStarted({
        taskType: "my_task",
        workerId: "w",
        pollCount: 1,
        timestamp: new Date(),
      });
      const text = collector.toPrometheusText();
      expect(text).toContain("taskType=");
      expect(text).not.toContain("task_type=");
    });
  });

  describe("stop", () => {
    it("should not throw when no server is running", async () => {
      await expect(collector.stop()).resolves.toBeUndefined();
    });
  });
});
