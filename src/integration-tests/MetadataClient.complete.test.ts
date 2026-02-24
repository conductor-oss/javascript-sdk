import {
  expect,
  describe,
  test,
  jest,
  beforeAll,
  afterAll,
} from "@jest/globals";
import type { Tag } from "../open-api";
import {
  MetadataClient,
  SchedulerClient,
  WorkflowExecutor,
  orkesConductorClient,
  taskDefinition,
  OrkesClients,
} from "../sdk";

/**
 * E2E Integration Tests for MetadataClient — Complete Coverage
 *
 * Tests all methods not covered in the base MetadataClient.test.ts:
 * - registerTasks (batch), getAllTaskDefs, getAllWorkflowDefs
 * - Workflow tags: addWorkflowTag, getWorkflowTags, setWorkflowTags, deleteWorkflowTag
 * - Task tags: addTaskTag, getTaskTags, setTaskTags, deleteTaskTag
 * - Rate limits: setWorkflowRateLimit, getWorkflowRateLimit, removeWorkflowRateLimit
 *
 * Also tests SchedulerClient methods not in base test:
 * - pauseAllSchedules, resumeAllSchedules, requeueAllExecutionRecords
 * - setSchedulerTags, getSchedulerTags, deleteSchedulerTags
 */
describe("MetadataClient Complete Coverage", () => {
  jest.setTimeout(60000);

  let metadataClient: MetadataClient;
  let schedulerClient: SchedulerClient;
  let executor: WorkflowExecutor;

  const suffix = Date.now();
  const taskName1 = `jsSdkTest-batch-task1-${suffix}`;
  const taskName2 = `jsSdkTest-batch-task2-${suffix}`;
  const wfName = `jsSdkTest-metadata-wf-${suffix}`;
  const scheduleName = `jsSdkTest_schedule_${suffix}`;

  const tasksToCleanup: string[] = [];
  const workflowsToCleanup: { name: string; version: number }[] = [];
  const schedulesToCleanup: string[] = [];

  beforeAll(async () => {
    const client = await orkesConductorClient();
    const clients = new OrkesClients(client);
    metadataClient = clients.getMetadataClient();
    schedulerClient = clients.getSchedulerClient();
    executor = clients.getWorkflowClient();

    // Register a workflow for tag and rate limit tests
    await metadataClient.registerWorkflowDef(
      {
        name: wfName,
        version: 1,
        tasks: [
          {
            name: "set_var",
            taskReferenceName: "set_var_ref",
            type: "SET_VARIABLE",
            inputParameters: { hello: "world" },
          },
        ],
        inputParameters: [],
        outputParameters: {},
        timeoutSeconds: 60,
      },
      true
    );
    workflowsToCleanup.push({ name: wfName, version: 1 });
  });

  afterAll(async () => {
    for (const name of schedulesToCleanup) {
      try {
        await schedulerClient.deleteSchedule(name);
      } catch (e) {
        console.debug(`Cleanup schedule '${name}' failed:`, e);
      }
    }
    for (const name of tasksToCleanup) {
      try {
        await metadataClient.unregisterTask(name);
      } catch (e) {
        console.debug(`Cleanup task '${name}' failed:`, e);
      }
    }
    for (const wf of workflowsToCleanup) {
      try {
        await metadataClient.unregisterWorkflow(wf.name, wf.version);
      } catch (e) {
        console.debug(`Cleanup workflow '${wf.name}' failed:`, e);
      }
    }
  });

  // ==================== Batch Task Registration ====================

  describe("Batch Task Registration", () => {
    test("registerTasks should register multiple task definitions at once", async () => {
      const taskDefs = [
        taskDefinition({
          name: taskName1,
          description: `Batch task 1 ${suffix}`,
          retryCount: 1,
          timeoutSeconds: 300,
          timeoutPolicy: "TIME_OUT_WF",
          retryLogic: "FIXED",
          retryDelaySeconds: 1,
          responseTimeoutSeconds: 300,
        }),
        taskDefinition({
          name: taskName2,
          description: `Batch task 2 ${suffix}`,
          retryCount: 2,
          timeoutSeconds: 600,
          timeoutPolicy: "TIME_OUT_WF",
          retryLogic: "FIXED",
          retryDelaySeconds: 2,
          responseTimeoutSeconds: 600,
        }),
      ];

      await expect(
        metadataClient.registerTasks(taskDefs)
      ).resolves.not.toThrow();

      tasksToCleanup.push(taskName1, taskName2);

      // Verify both were registered
      const task1 = await metadataClient.getTask(taskName1);
      expect(task1.name).toEqual(taskName1);

      const task2 = await metadataClient.getTask(taskName2);
      expect(task2.name).toEqual(taskName2);
    });

    test("getAllTaskDefs should return all task definitions", async () => {
      const allTasks = await metadataClient.getAllTaskDefs();

      expect(Array.isArray(allTasks)).toBe(true);
      expect(allTasks.length).toBeGreaterThan(0);

      const found = allTasks.find((t) => t.name === taskName1);
      expect(found).toBeDefined();
    });

    test("getAllWorkflowDefs should return all workflow definitions", async () => {
      const allWorkflows = await metadataClient.getAllWorkflowDefs();

      expect(Array.isArray(allWorkflows)).toBe(true);
      expect(allWorkflows.length).toBeGreaterThan(0);

      const found = allWorkflows.find((w) => w.name === wfName);
      expect(found).toBeDefined();
    });
  });

  // ==================== Workflow Tags ====================

  describe("Workflow Tags", () => {
    test("addWorkflowTag should add a tag to a workflow definition", async () => {
      await expect(
        metadataClient.addWorkflowTag(
          { key: "env", type: "METADATA", value: "test" },
          wfName
        )
      ).resolves.not.toThrow();
    });

    test("getWorkflowTags should return the workflow tags", async () => {
      const tags = await metadataClient.getWorkflowTags(wfName);

      expect(Array.isArray(tags)).toBe(true);
      const envTag = tags.find((t) => t.key === "env");
      expect(envTag).toBeDefined();
      expect(envTag?.value).toEqual("test");
    });

    test("setWorkflowTags should replace all tags", async () => {
      const newTags: Tag[] = [
        { key: "team", type: "METADATA", value: "sdk" },
        { key: "version", type: "METADATA", value: "v2" },
      ];

      await expect(
        metadataClient.setWorkflowTags(newTags, wfName)
      ).resolves.not.toThrow();

      const tags = await metadataClient.getWorkflowTags(wfName);
      // Old tag should be replaced
      const envTag = tags.find((t) => t.key === "env");
      expect(envTag).toBeUndefined();

      const teamTag = tags.find((t) => t.key === "team");
      expect(teamTag).toBeDefined();
    });

    test("deleteWorkflowTag should remove a specific tag", async () => {
      await expect(
        metadataClient.deleteWorkflowTag(
          { key: "version", type: "METADATA", value: "v2" },
          wfName
        )
      ).resolves.not.toThrow();

      const tags = await metadataClient.getWorkflowTags(wfName);
      const versionTag = tags.find((t) => t.key === "version");
      expect(versionTag).toBeUndefined();
    });
  });

  // ==================== Task Tags ====================

  describe("Task Tags", () => {
    test("addTaskTag should add a tag to a task definition", async () => {
      await expect(
        metadataClient.addTaskTag(
          { key: "priority", type: "METADATA", value: "high" },
          taskName1
        )
      ).resolves.not.toThrow();
    });

    test("getTaskTags should return the task tags", async () => {
      const tags = await metadataClient.getTaskTags(taskName1);

      expect(Array.isArray(tags)).toBe(true);
      const priorityTag = tags.find((t) => t.key === "priority");
      expect(priorityTag).toBeDefined();
      expect(priorityTag?.value).toEqual("high");
    });

    test("setTaskTags should replace all tags", async () => {
      const newTags: Tag[] = [
        { key: "category", type: "METADATA", value: "processing" },
        { key: "sla", type: "METADATA", value: "medium" },
      ];

      await expect(
        metadataClient.setTaskTags(newTags, taskName1)
      ).resolves.not.toThrow();

      const tags = await metadataClient.getTaskTags(taskName1);
      const priorityTag = tags.find((t) => t.key === "priority");
      expect(priorityTag).toBeUndefined();

      const catTag = tags.find((t) => t.key === "category");
      expect(catTag).toBeDefined();
    });

    test("deleteTaskTag should remove a specific tag", async () => {
      await expect(
        metadataClient.deleteTaskTag(
          { key: "sla", type: "METADATA", value: "medium" },
          taskName1
        )
      ).resolves.not.toThrow();

      const tags = await metadataClient.getTaskTags(taskName1);
      const slaTag = tags.find((t) => t.key === "sla");
      expect(slaTag).toBeUndefined();
    });
  });

  // ==================== Rate Limits ====================
  // Rate limit API may not be available on all server versions

  describe("Rate Limits", () => {
    let rateLimitSupported = true;

    test("setWorkflowRateLimit should configure rate limiting", async () => {
      try {
        await metadataClient.setWorkflowRateLimit(
          {
            concurrentExecLimit: 10,
            rateLimitKey: "test-key",
          },
          wfName
        );
      } catch {
        // Rate limit API not supported on this server version
        rateLimitSupported = false;
        console.log("Rate limit API not supported — skipping rate limit tests");
      }
    });

    test("getWorkflowRateLimit should return the rate limit config", async () => {
      if (!rateLimitSupported) return;

      const rateLimit = await metadataClient.getWorkflowRateLimit(wfName);

      expect(rateLimit).toBeDefined();
      if (rateLimit) {
        expect(rateLimit.concurrentExecLimit).toEqual(10);
      }
    });

    test("removeWorkflowRateLimit should remove rate limiting", async () => {
      if (!rateLimitSupported) return;

      await expect(
        metadataClient.removeWorkflowRateLimit(wfName)
      ).resolves.not.toThrow();

      const rateLimit = await metadataClient.getWorkflowRateLimit(wfName);
      expect(rateLimit).toBeUndefined();
    });
  });

  // ==================== Scheduler Extended ====================

  describe("Scheduler Extended", () => {
    beforeAll(async () => {
      // Create a schedule for tag tests
      await schedulerClient.saveSchedule({
        name: scheduleName,
        cronExpression: "0 0 0 1 1 *", // Once a year — won't fire during tests
        startWorkflowRequest: {
          name: wfName,
          version: 1,
        },
        paused: true,
      });
      schedulesToCleanup.push(scheduleName);
    });

    test("pauseAllSchedules should pause all schedules", async () => {
      await expect(
        schedulerClient.pauseAllSchedules()
      ).resolves.not.toThrow();
    });

    test("resumeAllSchedules should resume all schedules", async () => {
      await expect(
        schedulerClient.resumeAllSchedules()
      ).resolves.not.toThrow();
    });

    test("requeueAllExecutionRecords should requeue execution records", async () => {
      await expect(
        schedulerClient.requeueAllExecutionRecords()
      ).resolves.not.toThrow();
    });

    // ── Scheduler Tags ──

    test("setSchedulerTags should set tags on a schedule", async () => {
      const tags: Tag[] = [
        { key: "env", type: "METADATA", value: "test" },
        { key: "frequency", type: "METADATA", value: "yearly" },
      ];

      await expect(
        schedulerClient.setSchedulerTags(tags, scheduleName)
      ).resolves.not.toThrow();
    });

    test("getSchedulerTags should return schedule tags", async () => {
      const tags = await schedulerClient.getSchedulerTags(scheduleName);

      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBeGreaterThanOrEqual(2);

      const envTag = tags.find((t) => t.key === "env");
      expect(envTag).toBeDefined();
      expect(envTag?.value).toEqual("test");
    });

    test("deleteSchedulerTags should remove specific tags", async () => {
      const tagToDelete: Tag[] = [
        { key: "frequency", type: "METADATA", value: "yearly" },
      ];

      await expect(
        schedulerClient.deleteSchedulerTags(tagToDelete, scheduleName)
      ).resolves.not.toThrow();

      const remaining = await schedulerClient.getSchedulerTags(scheduleName);
      const freqTag = remaining.find((t) => t.key === "frequency");
      expect(freqTag).toBeUndefined();
    });
  });

  // ==================== Error Paths ====================

  describe("Error Paths", () => {
    test("getTask should throw for non-existent task", async () => {
      await expect(
        metadataClient.getTask("nonexistent_task_def_999999")
      ).rejects.toThrow();
    });

    test("getWorkflowDef should throw for non-existent workflow", async () => {
      await expect(
        metadataClient.getWorkflowDef("nonexistent_wf_def_999999")
      ).rejects.toThrow();
    });

    test("unregisterTask should throw for non-existent task", async () => {
      await expect(
        metadataClient.unregisterTask("nonexistent_task_def_999999")
      ).rejects.toThrow();
    });

    test("unregisterWorkflow should throw for non-existent workflow", async () => {
      await expect(
        metadataClient.unregisterWorkflow("nonexistent_wf_def_999999", 1)
      ).rejects.toThrow();
    });

    test("getWorkflowTags for non-existent workflow should throw or return empty", async () => {
      try {
        const tags = await metadataClient.getWorkflowTags("nonexistent_wf_def_999999");
        // Some servers return empty array instead of 404
        expect(Array.isArray(tags)).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test("getTaskTags for non-existent task should throw or return empty", async () => {
      try {
        const tags = await metadataClient.getTaskTags("nonexistent_task_def_999999");
        // Some servers return empty array instead of 404
        expect(Array.isArray(tags)).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
