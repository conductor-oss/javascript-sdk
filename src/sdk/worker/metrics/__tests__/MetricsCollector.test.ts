import { describe, it, expect, beforeEach } from "@jest/globals";
import { MetricsCollector } from "../MetricsCollector";

describe("MetricsCollector", () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe("poll metrics", () => {
    it("should count polls via onPollStarted", () => {
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
      collector.onPollStarted({
        taskType: "task_b",
        workerId: "w1",
        pollCount: 3,
        timestamp: new Date(),
      });

      const metrics = collector.getMetrics();
      expect(metrics.pollTotal.get("task_a")).toBe(2);
      expect(metrics.pollTotal.get("task_b")).toBe(1);
    });

    it("should record poll duration via onPollCompleted", () => {
      collector.onPollCompleted({
        taskType: "task_a",
        durationMs: 10,
        tasksReceived: 3,
        timestamp: new Date(),
      });
      collector.onPollCompleted({
        taskType: "task_a",
        durationMs: 15,
        tasksReceived: 0,
        timestamp: new Date(),
      });

      const metrics = collector.getMetrics();
      expect(metrics.pollDurationMs.get("task_a")).toEqual([10, 15]);
    });

    it("should count poll errors and record duration via onPollFailure", () => {
      collector.onPollFailure({
        taskType: "task_a",
        durationMs: 5000,
        cause: new Error("timeout"),
        timestamp: new Date(),
      });

      const metrics = collector.getMetrics();
      expect(metrics.pollErrorTotal.get("task_a")).toBe(1);
      expect(metrics.pollDurationMs.get("task_a")).toEqual([5000]);
    });
  });

  describe("execution metrics", () => {
    it("should count executions and record duration via onTaskExecutionCompleted", () => {
      collector.onTaskExecutionCompleted({
        taskType: "task_a",
        taskId: "t1",
        workerId: "w1",
        workflowInstanceId: "wf1",
        durationMs: 200,
        outputSizeBytes: 1024,
        timestamp: new Date(),
      });
      collector.onTaskExecutionCompleted({
        taskType: "task_a",
        taskId: "t2",
        workerId: "w1",
        workflowInstanceId: "wf2",
        durationMs: 300,
        timestamp: new Date(),
      });

      const metrics = collector.getMetrics();
      expect(metrics.taskExecutionTotal.get("task_a")).toBe(2);
      expect(metrics.executionDurationMs.get("task_a")).toEqual([200, 300]);
      expect(metrics.outputSizeBytes.get("task_a")).toEqual([1024]);
    });

    it("should count execution errors by taskType:exception via onTaskExecutionFailure", () => {
      const err = new TypeError("invalid input");
      collector.onTaskExecutionFailure({
        taskType: "task_a",
        taskId: "t1",
        workerId: "w1",
        workflowInstanceId: "wf1",
        cause: err,
        durationMs: 50,
        timestamp: new Date(),
      });

      const metrics = collector.getMetrics();
      expect(metrics.taskExecutionErrorTotal.get("task_a:TypeError")).toBe(1);
      expect(metrics.executionDurationMs.get("task_a")).toEqual([50]);
    });
  });

  describe("task update failure metrics", () => {
    it("should count update failures via onTaskUpdateFailure", () => {
      collector.onTaskUpdateFailure({
        taskType: "task_a",
        taskId: "t1",
        workerId: "w1",
        workflowInstanceId: "wf1",
        cause: new Error("server error"),
        retryCount: 4,
        taskResult: {},
        timestamp: new Date(),
      });

      const metrics = collector.getMetrics();
      expect(metrics.taskUpdateFailureTotal.get("task_a")).toBe(1);
    });
  });

  describe("reset", () => {
    it("should clear all metrics", () => {
      collector.onPollStarted({
        taskType: "task_a",
        workerId: "w1",
        pollCount: 1,
        timestamp: new Date(),
      });
      collector.onTaskExecutionCompleted({
        taskType: "task_a",
        taskId: "t1",
        workerId: "w1",
        workflowInstanceId: "wf1",
        durationMs: 100,
        timestamp: new Date(),
      });

      expect(collector.getMetrics().pollTotal.size).toBeGreaterThan(0);

      collector.reset();

      const metrics = collector.getMetrics();
      expect(metrics.pollTotal.size).toBe(0);
      expect(metrics.taskExecutionTotal.size).toBe(0);
      expect(metrics.executionDurationMs.size).toBe(0);
    });
  });

  describe("getMetrics", () => {
    it("should return all metric maps", () => {
      const metrics = collector.getMetrics();
      expect(metrics).toHaveProperty("pollTotal");
      expect(metrics).toHaveProperty("pollErrorTotal");
      expect(metrics).toHaveProperty("taskExecutionTotal");
      expect(metrics).toHaveProperty("taskExecutionErrorTotal");
      expect(metrics).toHaveProperty("taskUpdateFailureTotal");
      expect(metrics).toHaveProperty("pollDurationMs");
      expect(metrics).toHaveProperty("executionDurationMs");
      expect(metrics).toHaveProperty("outputSizeBytes");
    });
  });
});
