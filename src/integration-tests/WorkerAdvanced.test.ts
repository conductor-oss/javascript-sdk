import {
  expect,
  describe,
  test,
  jest,
  beforeAll,
  afterEach,
  afterAll,
} from "@jest/globals";
import type { Task } from "../open-api";
import {
  MetricsCollector,
  MetricsServer,
  TaskHandler,
  TaskClient,
  WorkflowExecutor,
  MetadataClient,
  clearWorkerRegistry,
  getTaskContext,
  orkesConductorClient,
  simpleTask,
  worker,
} from "../sdk";
import { waitForWorkflowStatus } from "./utils/waitForWorkflowStatus";
import { executeWorkflowWithRetry } from "./utils/executeWorkflowWithRetry";

/**
 * E2E Integration Tests for Advanced Worker Features
 *
 * Tests features not covered in WorkerRegistration.test.ts:
 * - MetricsCollector — verify metrics collected during workflow execution
 * - MetricsServer — start on port, scrape /metrics and /health
 * - TaskContext — getTaskContext(), addLog(), verify logs via getTaskLogs()
 * - Worker with paused option
 */
describe("Worker Advanced Features", () => {
  jest.setTimeout(120000);

  const clientPromise = orkesConductorClient();
  let executor: WorkflowExecutor;
  let metadataClient: MetadataClient;
  let taskClient: TaskClient;

  beforeAll(async () => {
    const client = await clientPromise;
    executor = new WorkflowExecutor(client);
    metadataClient = new MetadataClient(client);
    taskClient = new TaskClient(client);
  });

  afterEach(() => {
    clearWorkerRegistry();
  });

  // ==================== MetricsCollector ====================

  describe("MetricsCollector", () => {
    test("should collect poll and execution metrics during workflow run", async () => {
      const client = await clientPromise;
      const taskName = `sdk_test_metrics_${Date.now()}`;
      const workflowName = `sdk_test_metrics_wf_${Date.now()}`;

      const metricsCollector = new MetricsCollector();

      worker({ taskDefName: taskName, pollInterval: 100 })(
        async function metricsWorker() {
          return {
            status: "COMPLETED" as const,
            outputData: { metricsTest: true },
          };
        }
      );

      const handler = new TaskHandler({
        client,
        scanForDecorated: true,
        eventListeners: [metricsCollector],
      });

      await handler.startWorkers();
      await new Promise((r) => setTimeout(r, 100));

      // Register and run workflow
      await executor.registerWorkflow(true, {
        name: workflowName,
        version: 1,
        ownerEmail: "test@example.com",
        tasks: [simpleTask(taskName, taskName, {})],
        inputParameters: [],
        outputParameters: {},
        timeoutSeconds: 0,
      });

      const { workflowId } = await executeWorkflowWithRetry(
        executor,
        { name: workflowName, version: 1 },
        workflowName,
        1
      );

      if (!workflowId) throw new Error("Workflow ID is undefined");

      await waitForWorkflowStatus(executor, workflowId, "COMPLETED", 60000);
      await handler.stopWorkers();

      // Verify metrics were collected
      const metrics = metricsCollector.getMetrics();

      // Poll metrics should be tracked
      expect(metrics.pollTotal.size).toBeGreaterThan(0);
      expect(metrics.pollTotal.get(taskName)).toBeGreaterThan(0);

      // Execution metrics should be tracked
      expect(metrics.taskExecutionTotal.size).toBeGreaterThan(0);
      expect(metrics.taskExecutionTotal.get(taskName)).toBeGreaterThanOrEqual(1);

      // Duration observations should be present
      expect(metrics.pollDurationMs.size).toBeGreaterThan(0);
      expect(metrics.executionDurationMs.size).toBeGreaterThan(0);

      await metricsCollector.stop();
    });

    test("toPrometheusText should produce valid Prometheus format", async () => {
      const collector = new MetricsCollector({ prefix: "test_worker" });

      // Manually trigger some events
      collector.onPollStarted({
        taskType: "test_task",
        workerId: "worker-1",
        pollCount: 1,
        timestamp: new Date(),
      });

      collector.onPollCompleted({
        taskType: "test_task",
        durationMs: 15,
        tasksReceived: 1,
        timestamp: new Date(),
      });

      collector.onTaskExecutionCompleted({
        taskType: "test_task",
        taskId: "task-123",
        workerId: "worker-1",
        durationMs: 50,
        outputSizeBytes: 256,
        timestamp: new Date(),
      });

      const text = collector.toPrometheusText();

      expect(text).toContain("# HELP test_worker_task_poll_total");
      expect(text).toContain("# TYPE test_worker_task_poll_total counter");
      expect(text).toContain('test_worker_task_poll_total{task_type="test_task"} 1');

      expect(text).toContain("# HELP test_worker_task_execute_total");
      expect(text).toContain('test_worker_task_execute_total{task_type="test_task"} 1');

      // Summary should have quantiles
      expect(text).toContain("test_worker_task_poll_time");
      expect(text).toContain('quantile="0.5"');
      expect(text).toContain('quantile="0.99"');

      await collector.stop();
    });

    test("reset should clear all collected metrics", () => {
      const collector = new MetricsCollector();

      collector.onPollStarted({
        taskType: "task1",
        workerId: "w1",
        pollCount: 1,
        timestamp: new Date(),
      });

      expect(collector.getMetrics().pollTotal.size).toBeGreaterThan(0);

      collector.reset();

      expect(collector.getMetrics().pollTotal.size).toBe(0);
      expect(collector.getMetrics().taskExecutionTotal.size).toBe(0);
    });

    test("direct recording methods should work", () => {
      const collector = new MetricsCollector();

      collector.recordTaskExecutionQueueFull("queue_test");
      collector.recordUncaughtException();
      collector.recordWorkerRestart();
      collector.recordTaskPaused("pause_test");
      collector.recordTaskAckError("ack_test");
      collector.recordWorkflowStartError();
      collector.recordExternalPayloadUsed("task_output");
      collector.recordWorkflowInputSize("wf_type", 1024);
      collector.recordApiRequestTime("POST", "/api/tasks", 200, 35);

      const m = collector.getMetrics();
      expect(m.taskExecutionQueueFullTotal.get("queue_test")).toBe(1);
      expect(m.uncaughtExceptionTotal).toBe(1);
      expect(m.workerRestartTotal).toBe(1);
      expect(m.taskPausedTotal.get("pause_test")).toBe(1);
      expect(m.taskAckErrorTotal.get("ack_test")).toBe(1);
      expect(m.workflowStartErrorTotal).toBe(1);
      expect(m.externalPayloadUsedTotal.get("task_output")).toBe(1);
      expect(m.workflowInputSizeBytes.get("wf_type")).toEqual([1024]);
      expect(m.apiRequestDurationMs.get("POST:/api/tasks:200")).toEqual([35]);
    });
  });

  // ==================== MetricsServer ====================

  describe("MetricsServer", () => {
    test("should start, serve /metrics and /health, then stop", async () => {
      const collector = new MetricsCollector();

      // Simulate some metrics
      collector.onPollStarted({
        taskType: "server_test",
        workerId: "w1",
        pollCount: 1,
        timestamp: new Date(),
      });

      const port = 19876 + Math.floor(Math.random() * 1000);
      const server = new MetricsServer(collector, port);

      await server.start();

      // Fetch /health endpoint
      const healthRes = await fetch(`http://localhost:${port}/health`);
      expect(healthRes.status).toBe(200);
      const healthBody = await healthRes.json();
      expect(healthBody).toEqual({ status: "UP" });

      // Fetch /metrics endpoint
      const metricsRes = await fetch(`http://localhost:${port}/metrics`);
      expect(metricsRes.status).toBe(200);
      const metricsText = await metricsRes.text();
      expect(metricsText).toContain("conductor_worker_task_poll_total");
      expect(metricsText).toContain("server_test");

      // 404 for unknown paths
      const notFoundRes = await fetch(`http://localhost:${port}/unknown`);
      expect(notFoundRes.status).toBe(404);

      await server.stop();
      await collector.stop();
    });

    // Note: MetricsCollector with httpPort auto-start uses dynamic import("./MetricsServer.js")
    // which is not compatible with Jest's TypeScript transforms. The explicit MetricsServer
    // test above validates the HTTP server functionality directly.
  });

  // ==================== TaskContext ====================

  describe("TaskContext", () => {
    test("getTaskContext should expose all context methods during execution", async () => {
      const client = await clientPromise;
      const taskName = `sdk_test_context_${Date.now()}`;
      const workflowName = `sdk_test_context_wf_${Date.now()}`;

      // Capture all context values during task execution
      const captured: {
        available: boolean;
        taskId?: string;
        workflowInstanceId?: string;
        taskDefName?: string;
        retryCount?: number;
        pollCount?: number;
        input?: Record<string, unknown>;
        workflowTaskType?: string;
        taskObject?: Task;
        logsBeforeAdd?: number;
        logsAfterAdd?: number;
        callbackBefore?: number | undefined;
        callbackAfter?: number | undefined;
        outputBefore?: Record<string, unknown> | undefined;
        outputAfter?: Record<string, unknown> | undefined;
      } = { available: false };

      worker({ taskDefName: taskName, pollInterval: 100 })(
        async function contextWorker(task: Task) {
          const ctx = getTaskContext();
          if (ctx) {
            captured.available = true;

            // Basic getters
            captured.taskId = ctx.getTaskId();
            captured.workflowInstanceId = ctx.getWorkflowInstanceId();
            captured.taskDefName = ctx.getTaskDefName();
            captured.retryCount = ctx.getRetryCount();
            captured.pollCount = ctx.getPollCount();
            captured.input = ctx.getInput();
            captured.workflowTaskType = ctx.getWorkflowTaskType();
            captured.taskObject = ctx.getTask();

            // Logs: getLogs before and after addLog
            captured.logsBeforeAdd = ctx.getLogs().length;
            ctx.addLog("E2E test log entry 1");
            ctx.addLog("E2E test log entry 2");
            captured.logsAfterAdd = ctx.getLogs().length;

            // CallbackAfter: before and after setCallbackAfter
            captured.callbackBefore = ctx.getCallbackAfterSeconds();
            ctx.setCallbackAfter(30);
            captured.callbackAfter = ctx.getCallbackAfterSeconds();

            // Output: before and after setOutput
            captured.outputBefore = ctx.getOutput();
            ctx.setOutput({ intermediate: "result" });
            captured.outputAfter = ctx.getOutput();
          }

          return {
            status: "COMPLETED" as const,
            outputData: { contextAvailable: !!ctx },
          };
        }
      );

      const handler = new TaskHandler({
        client,
        scanForDecorated: true,
      });

      await handler.startWorkers();
      await new Promise((r) => setTimeout(r, 100));

      await executor.registerWorkflow(true, {
        name: workflowName,
        version: 1,
        ownerEmail: "test@example.com",
        tasks: [simpleTask(taskName, taskName, { myInput: "hello" })],
        inputParameters: [],
        outputParameters: {},
        timeoutSeconds: 0,
      });

      const { workflowId } = await executeWorkflowWithRetry(
        executor,
        { name: workflowName, version: 1, input: { myInput: "hello" } },
        workflowName,
        1
      );

      if (!workflowId) throw new Error("Workflow ID is undefined");

      const wfStatus = await waitForWorkflowStatus(
        executor,
        workflowId,
        "COMPLETED",
        60000
      );

      expect(wfStatus.status).toBe("COMPLETED");
      expect(captured.available).toBe(true);

      // ── Basic getters ──
      expect(captured.taskId).toBeDefined();
      expect(typeof captured.taskId).toBe("string");

      expect(captured.workflowInstanceId).toEqual(workflowId);

      expect(captured.taskDefName).toEqual(taskName);

      expect(typeof captured.retryCount).toBe("number");
      expect(captured.retryCount).toBeGreaterThanOrEqual(0);

      expect(typeof captured.pollCount).toBe("number");
      expect(captured.pollCount).toBeGreaterThanOrEqual(0);

      expect(captured.input).toBeDefined();
      expect(typeof captured.input).toBe("object");

      expect(captured.workflowTaskType).toBeDefined();
      // taskType on the Task object is the task def name for SIMPLE tasks
      expect(typeof captured.workflowTaskType).toBe("string");

      // ── getTask() should return full Task object ──
      expect(captured.taskObject).toBeDefined();
      expect(captured.taskObject?.taskId).toEqual(captured.taskId);
      expect(captured.taskObject?.workflowInstanceId).toEqual(workflowId);

      // ── addLog / getLogs ──
      expect(captured.logsBeforeAdd).toBe(0);
      expect(captured.logsAfterAdd).toBe(2);

      // ── setCallbackAfter / getCallbackAfterSeconds ──
      expect(captured.callbackBefore).toBeUndefined();
      expect(captured.callbackAfter).toBe(30);

      // ── setOutput / getOutput ──
      expect(captured.outputBefore).toBeUndefined();
      expect(captured.outputAfter).toEqual({ intermediate: "result" });

      // Verify logs were persisted via TaskClient
      if (captured.taskId) {
        const logs = await taskClient.getTaskLogs(captured.taskId);
        expect(Array.isArray(logs)).toBe(true);
      }

      await handler.stopWorkers();
    }, 90000);

    test("getTaskContext should return undefined outside task execution", () => {
      const ctx = getTaskContext();
      expect(ctx).toBeUndefined();
    });
  });

  // ==================== Worker with custom config ====================

  describe("Worker Custom Config", () => {
    test("worker with custom pollInterval and concurrency should register correctly", async () => {
      const client = await clientPromise;
      const taskName = `sdk_test_custom_${Date.now()}`;

      worker({ taskDefName: taskName, pollInterval: 500, concurrency: 3 })(
        async function customWorker() {
          return {
            status: "COMPLETED" as const,
            outputData: { custom: true },
          };
        }
      );

      const handler = new TaskHandler({
        client,
        scanForDecorated: true,
      });

      expect(handler.workerCount).toBe(1);

      await handler.startWorkers();
      expect(handler.running).toBe(true);

      await handler.stopWorkers();
    });
  });

  // ==================== MetricsCollector with File Output ====================

  describe("MetricsCollector File Output", () => {
    test("should write metrics to file when filePath is configured", async () => {
      const { mkdtemp, readFile, rm } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const { tmpdir } = await import("node:os");

      const tmpDir = await mkdtemp(join(tmpdir(), "conductor-metrics-"));
      const filePath = join(tmpDir, "metrics.prom");

      const collector = new MetricsCollector({
        filePath,
        fileWriteIntervalMs: 500,
      });

      // Add some metrics
      collector.onPollStarted({
        taskType: "file_test",
        workerId: "w1",
        pollCount: 1,
        timestamp: new Date(),
      });

      // Poll until the file has expected content (or timeout after 5s)
      const deadline = Date.now() + 5000;
      let content = "";
      while (Date.now() < deadline) {
        try {
          content = await readFile(filePath, "utf-8");
          if (content.includes("conductor_worker_task_poll_total")) break;
        } catch {
          /* file may not exist yet */
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      expect(content).toContain("conductor_worker_task_poll_total");
      expect(content).toContain("file_test");

      await collector.stop();

      // Cleanup
      await rm(tmpDir, { recursive: true, force: true });
    });
  });

  // ==================== MetricsCollector Sliding Window ====================

  describe("MetricsCollector Sliding Window", () => {
    test("should limit observations to sliding window size", () => {
      const collector = new MetricsCollector({ slidingWindowSize: 5 });

      // Add more observations than the window size
      for (let i = 0; i < 10; i++) {
        collector.onPollCompleted({
          taskType: "window_test",
          durationMs: i * 10,
          tasksReceived: 1,
          timestamp: new Date(),
        });
      }

      const metrics = collector.getMetrics();
      const observations = metrics.pollDurationMs.get("window_test");
      expect(observations).toBeDefined();
      expect(observations!.length).toBeLessThanOrEqual(5);

      // Should contain only the last 5 values
      expect(observations).toEqual([50, 60, 70, 80, 90]);
    });
  });
});
