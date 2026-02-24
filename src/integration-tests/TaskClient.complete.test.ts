import {
  expect,
  describe,
  test,
  jest,
  beforeAll,
  afterAll,
} from "@jest/globals";
import {
  TaskType,
  type WorkflowDef,
  type Client,
} from "../open-api";
import {
  MetadataClient,
  WorkflowExecutor,
  TaskClient,
  orkesConductorClient,
} from "../sdk";
import { waitForWorkflowStatus } from "./utils/waitForWorkflowStatus";

/**
 * E2E Integration Tests for TaskClient — Complete Coverage
 *
 * Uses a WAIT task (which goes IN_PROGRESS automatically) for testing
 * task queries, logs, and updates.
 */
describe("TaskClient Complete Coverage", () => {
  jest.setTimeout(60000);

  let client: Client;
  let executor: WorkflowExecutor;
  let metadataClient: MetadataClient;
  let taskClient: TaskClient;

  const suffix = Date.now();
  const wfName = `jsSdkTest_taskClient_wf_${suffix}`;

  let workflowId: string;
  let taskId: string;

  beforeAll(async () => {
    client = await orkesConductorClient();
    executor = new WorkflowExecutor(client);
    metadataClient = new MetadataClient(client);
    taskClient = new TaskClient(client);

    // Register workflow with WAIT task (goes IN_PROGRESS automatically)
    const wfDef: WorkflowDef = {
      name: wfName,
      version: 1,
      tasks: [
        {
          name: "wait_task",
          taskReferenceName: "wait_ref",
          type: TaskType.WAIT,
        },
      ],
      inputParameters: [],
      outputParameters: {},
      timeoutSeconds: 600,
    };
    await executor.registerWorkflow(true, wfDef);

    // Start workflow — WAIT task will be IN_PROGRESS
    workflowId = await executor.startWorkflow({
      name: wfName,
      version: 1,
      input: { test: "data" },
    });

    // Wait for the task to be in progress
    await waitForWorkflowStatus(executor, workflowId, "RUNNING");
    await new Promise((r) => setTimeout(r, 2000));

    // Get the task ID
    const execution = await executor.getExecution(workflowId);
    const task = execution.tasks?.find(
      (t) => t.referenceTaskName === "wait_ref"
    );
    if (task?.taskId) {
      taskId = task.taskId;
    }
  });

  afterAll(async () => {
    try {
      await executor.terminate(workflowId, "Test cleanup");
    } catch {
      // May already be completed
    }
    try {
      await metadataClient.unregisterWorkflow(wfName, 1);
    } catch (e) {
      console.debug(`Cleanup workflow failed:`, e);
    }
  });

  // ==================== Task Queries ====================

  describe("Task Queries", () => {
    test("getTask should return task details by ID", async () => {
      expect(taskId).toBeDefined();

      const task = await taskClient.getTask(taskId);

      expect(task).toBeDefined();
      expect(task.taskId).toEqual(taskId);
      expect(task.workflowInstanceId).toEqual(workflowId);
    });

    test("search should find tasks", async () => {
      const result = await taskClient.search(
        0,
        10,
        "",
        "*",
        `workflowId="${workflowId}"`
      );

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
    });

    test("getQueueSizeForTask should return queue sizes", async () => {
      const sizes = await taskClient.getQueueSizeForTask(["WAIT"]);

      expect(sizes).toBeDefined();
      expect(typeof sizes).toBe("object");
    });

    test("getTaskPollData should return poll data", async () => {
      const pollData = await taskClient.getTaskPollData("WAIT");

      expect(Array.isArray(pollData)).toBe(true);
    });
  });

  // ==================== Task Logs ====================

  describe("Task Logs", () => {
    test("addTaskLog should add a log entry to a task", async () => {
      expect(taskId).toBeDefined();

      await expect(
        taskClient.addTaskLog(taskId, "Test log message from JS SDK integration test")
      ).resolves.not.toThrow();
    });

    test("addTaskLog should add multiple log entries", async () => {
      await expect(
        taskClient.addTaskLog(taskId, "Second log entry")
      ).resolves.not.toThrow();

      await expect(
        taskClient.addTaskLog(taskId, "Third log entry")
      ).resolves.not.toThrow();
    });

    test("getTaskLogs should return log entries", async () => {
      // Allow time for logs to be indexed
      await new Promise((r) => setTimeout(r, 1000));

      const logs = await taskClient.getTaskLogs(taskId);

      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==================== Task Result Update ====================

  describe("Task Result Update", () => {
    test("updateTaskResult should complete the WAIT task", async () => {
      // WAIT tasks can be completed by updating the task result
      const result = await taskClient.updateTaskResult(
        workflowId,
        "wait_ref",
        "COMPLETED",
        { completedBy: "integration-test" }
      );

      expect(result).toBeDefined();

      // Workflow should complete
      const finalWf = await waitForWorkflowStatus(
        executor,
        workflowId,
        "COMPLETED"
      );
      expect(finalWf.status).toEqual("COMPLETED");
    });
  });

  // ==================== Update Task Sync ====================

  describe("Update Task Sync", () => {
    test("updateTaskSync should complete task and return workflow", async () => {
      // Start a new workflow for this test
      const newWfId = await executor.startWorkflow({
        name: wfName,
        version: 1,
        input: { syncTest: true },
      });

      await waitForWorkflowStatus(executor, newWfId, "RUNNING");
      await new Promise((r) => setTimeout(r, 2000));

      const workflow = await taskClient.updateTaskSync(
        newWfId,
        "wait_ref",
        "COMPLETED",
        { syncResult: "done" }
      );

      expect(workflow).toBeDefined();
      expect(workflow.workflowId).toEqual(newWfId);
    });
  });

  // ==================== Error Paths ====================

  describe("Error Paths", () => {
    test("getTask should throw for non-existent task ID", async () => {
      await expect(
        taskClient.getTask("nonexistent-task-id-999999")
      ).rejects.toThrow();
    });

    test("addTaskLog for non-existent task should throw or no-op", async () => {
      try {
        await taskClient.addTaskLog("nonexistent-task-id-999999", "test log");
        // Some servers accept log writes for any task ID
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test("updateTaskResult should throw for non-existent workflow", async () => {
      await expect(
        taskClient.updateTaskResult(
          "nonexistent-workflow-id-999999",
          "nonexistent_ref",
          "COMPLETED",
          {}
        )
      ).rejects.toThrow();
    });

    test("updateTaskSync should throw for non-existent workflow", async () => {
      await expect(
        taskClient.updateTaskSync(
          "nonexistent-workflow-id-999999",
          "nonexistent_ref",
          "COMPLETED",
          {}
        )
      ).rejects.toThrow();
    });
  });
});
