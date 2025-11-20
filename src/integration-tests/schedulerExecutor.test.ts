import { expect, describe, test, jest } from "@jest/globals";
import {
  ExtendedWorkflowDef,
  SaveScheduleRequest,
  TaskType,
} from "../open-api";
import {
  MetadataClient,
  orkesConductorClient,
  SchedulerClient,
} from "../sdk";

describe("ScheduleExecutor", () => {
  const clientPromise = orkesConductorClient();
  jest.setTimeout(15000);

  const now = Date.now();
  const name = `jsSdkTestSchedule_${now}`;
  const cronExpression = "0/5 * * ? * *"; //every 5 second

  const workflowName = `jsSdkTestScheduleWf_${now}`;
  const workflowVersion = 1;

  test("Should be able to register a workflow and retrieve it", async () => {
    const client = await clientPromise;
    const executor = new SchedulerClient(client);

    const workflowDefinition: ExtendedWorkflowDef = {
      name: workflowName,
      version: workflowVersion,
      description: "Test Workflow for Scheduler",
      tasks: [
        {
          type: TaskType.SET_VARIABLE,
          name: "setVariable",
          taskReferenceName: "httpTaskRef",
          inputParameters: {
            hello: "world",
          },
        },
      ],
      inputParameters: [],
      timeoutSeconds: 15,
    };

    const metadataClient = new MetadataClient(client);
    await metadataClient.registerWorkflowDef(workflowDefinition, true);

    const workflowDefinitionFromApi = await metadataClient.getWorkflowDef(
      workflowName,
      workflowVersion
    );

    expect(workflowDefinitionFromApi).toBeDefined();
    if (!workflowDefinitionFromApi) {
      throw new Error("Workflow definition is undefined");
    }
    expect(workflowDefinitionFromApi.name).toEqual(workflowName);
    expect(workflowDefinitionFromApi.version).toEqual(workflowVersion);

    const schedulerDefinition: SaveScheduleRequest = {
      name,
      cronExpression,

      paused: true,
      runCatchupScheduleInstances: false,
      startWorkflowRequest: {
        name: workflowDefinitionFromApi.name,
        version: workflowDefinitionFromApi.version,
        input: {},
        correlationId: "",
        taskToDomain: {},
        priority: 0,
      },
    };
    await expect(
      executor.saveSchedule(schedulerDefinition)
    ).resolves.not.toThrow();
    const scheduler = await executor.getSchedule(name);
    expect(scheduler).toBeDefined();
    if (!scheduler) {
      throw new Error("Scheduler is undefined");
    }
    expect(scheduler.name).toEqual(name);
    expect(scheduler.cronExpression).toEqual(cronExpression);
  });

  test("Should be able to resume the schedule", async () => {
    const client = await clientPromise;
    const executor = new SchedulerClient(client);
    await executor.resumeSchedule(name);
    const scheduler = await executor.getSchedule(name);
    expect(scheduler).toBeDefined();
    if (!scheduler) {
      throw new Error("Scheduler is undefined");
    }
    expect(scheduler.paused).toBeFalsy();
  });

  test("Should be able to see the result in executed schedule", async () => {
    const client = await clientPromise;
    const executor = new SchedulerClient(client);
    await new Promise((resolve) => setTimeout(resolve, 10000));
    const result = await executor.search(
      0,
      15,
      "startTime:DESC",
      "",
      `scheduleName IN (${name})`
    );
    expect(result?.results?.length).toBeGreaterThan(0);
  });

  test("Should be able to pause the schedule", async () => {
    const client = await clientPromise;
    const executor = new SchedulerClient(client);
    await executor.pauseSchedule(name);
    const scheduler = await executor.getSchedule(name);
    if (!scheduler) {
      throw new Error("Scheduler is undefined");
    }
    expect(scheduler.paused).toBeTruthy();
  });

  test("Should be able to delete the schedule", async () => {
    const client = await clientPromise;
    const executor = new SchedulerClient(client);
    const metadataClient = new MetadataClient(client);
    await executor.deleteSchedule(name);
    // delete workflowDef too
    await metadataClient.unregisterWorkflow(workflowName, workflowVersion);
    const schedulerList = await executor.getAllSchedules();
    if (!schedulerList) {
      throw new Error("Scheduler list is undefined");
    }
    const testSchedule = schedulerList.some(
      (schedule) => schedule.name === name
    );
    expect(testSchedule).toBeFalsy();
  });

  test("Should be able to retrieve  next (default 3) execution times for a scheduler", async () => {
    const cronExpression = "0 0 * ? * *"; //every hour
    const client = await clientPromise;
    const executor = new SchedulerClient(client);
    const result = await executor.getNextFewSchedules(cronExpression);
    expect(result?.length).toBeGreaterThan(0);
  });
});
