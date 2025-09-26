import { expect, describe, test, jest } from "@jest/globals";
import { simpleTask, taskDefinition, WorkflowExecutor } from "../../src/core";
import { orkesConductorClient } from "../../src/orkes";
import { TaskManager, ConductorWorker } from "../../src/task/index";
import { mockLogger } from "../utils/mockLogger";
import { TestUtil } from "../utils/test-util";


const BASE_TIME = 1000;
describe("TaskManager", () => {
  const clientPromise = orkesConductorClient();

  jest.setTimeout(30000);

  test("Should run workflow with worker", async () => {
    const client = await clientPromise;
    const executor = new WorkflowExecutor(client);
    const taskName = `jsSdkTest-taskmanager-test-${Date.now()}`;
    const workflowName = `jsSdkTest-taskmanager-test-wf-${Date.now()}`;

    const worker: ConductorWorker = {
      taskDefName: taskName,
      execute: async () => {
        return {
          outputData: {
            hello: "From your worker",
          },
          status: "COMPLETED",
        };
      },
    };

    const manager = new TaskManager(client, [worker], {
      options: { pollInterval: BASE_TIME },
    });
    manager.startPolling();

    await executor.registerWorkflow(true, {
      name: workflowName,
      version: 1,
      ownerEmail: "developers@orkes.io",
      tasks: [simpleTask(taskName, taskName, {})],
      inputParameters: [],
      outputParameters: {},
      timeoutSeconds: 0,
    });

    const executionId = await executor.startWorkflow({
      name: workflowName,
      input: {},
      version: 1,
    });

    const workflowStatus = await TestUtil.waitForWorkflowCompletion(executor, executionId, BASE_TIME * 30);

    expect(workflowStatus.status).toEqual("COMPLETED");

    await manager.stopPolling();
  });

  test("On error it should call the errorHandler provided", async () => {
    const client = await clientPromise;
    const executor = new WorkflowExecutor(client);
    const taskName = `jsSdkTest-taskmanager-error-handler-test-${Date.now()}`;
    const workflowName = `jsSdkTest-taskmanager-error-handler-test-wf-${Date.now()}`;

    const mockErrorHandler = jest.fn();

    const worker: ConductorWorker = {
      taskDefName: taskName,
      execute: async () => {
        throw new Error("This is a forced error for testing error handler");
      },
    };

    await client.metadataResource.registerTaskDef([taskDefinition({
      name: taskName,
      timeoutSeconds: 0,
      retryCount: 0,
    })]);

    const manager = new TaskManager(client, [worker], {
      options: { pollInterval: BASE_TIME },
      onError: mockErrorHandler,
    });

    manager.startPolling();

    await executor.registerWorkflow(true, {
      name: workflowName,
      version: 1,
      ownerEmail: "developers@orkes.io",
      tasks: [simpleTask(taskName, taskName, {})],
      inputParameters: [],
      outputParameters: {},
      timeoutSeconds: 0,
    });

    const status = await executor.startWorkflow({
      name: workflowName,
      input: {},
      version: 1,
      correlationId: `${workflowName}-id`
    });

    const workflowStatus = await TestUtil.waitForWorkflowCompletion(executor, status, BASE_TIME * 30);

    expect(workflowStatus.status).toEqual("FAILED");
    expect(mockErrorHandler).toHaveBeenCalledTimes(1);
    await manager.stopPolling();
  });

  test("If no error handler provided. it should just update the task", async () => {
    const client = await clientPromise;
    const executor = new WorkflowExecutor(client);
    const taskName = `jsSdkTest-taskmanager-error-test-${Date.now()}`;
    const workflowName = `jsSdkTest-taskmanager-error-test-wf-${Date.now()}`;

    const worker: ConductorWorker = {
      taskDefName: taskName,
      execute: async () => {
        throw new Error("This is a forced error");
      },
    };

    await client.metadataResource.registerTaskDef([taskDefinition({
      name: taskName,
      timeoutSeconds: 0,
      retryCount: 0,
    })]);

    const manager = new TaskManager(client, [worker], {
      options: { pollInterval: BASE_TIME },
    });

    manager.startPolling();

    await executor.registerWorkflow(true, {
      name: workflowName,
      version: 1,
      ownerEmail: "developers@orkes.io",
      tasks: [simpleTask(taskName, taskName, {})],
      inputParameters: [],
      outputParameters: {},
      timeoutSeconds: 0,
    });

    const executionId = await executor.startWorkflow({
      name: workflowName,
      input: {},
      version: 1,
      correlationId: `${workflowName}-id`
    });

    const workflowStatus = await TestUtil.waitForWorkflowCompletion(executor, executionId!, BASE_TIME * 30);
    expect(workflowStatus.status).toEqual("FAILED");
    await manager.stopPolling();
  });

  test("multi worker example", async () => {
    const client = await clientPromise;

    const executor = new WorkflowExecutor(client);
    // just create a bunch of worker names
    const workerNames: string[] = Array.from({ length: 3 })
      .fill(0)
      .map((_, i: number) => `jsSdkTest-taskman-multi-${1 + i}-${Date.now()}`);

    // names to actual workers
    const workers: ConductorWorker[] = workerNames.map((name) => ({
      taskDefName: name,
      execute: async () => {
        return {
          outputData: {
            hello: "From your worker",
          },
          status: "COMPLETED",
        };
      },
    }));

    //create the manager with initial configuations
    const manager = new TaskManager(client, workers, {
      options: { pollInterval: BASE_TIME, concurrency: 2 },
      // logger: console,
    });
    // start polling
    manager.startPolling();

    expect(manager.isPolling).toBeTruthy();

    const workflowName = `jsSdkTest-taskmanager-multi-test-wf-${Date.now()}`;

    // increase polling speed
    manager.updatePollingOptions({ concurrency: 4 });

    // create the workflow where we will run the test
    await executor.registerWorkflow(true, {
      name: workflowName,
      version: 1,
      ownerEmail: "developers@orkes.io",
      tasks: workerNames.map((name) => simpleTask(name, name, {})),
      inputParameters: [],
      outputParameters: {},
      timeoutSeconds: 0,
    });

    //Start workflow
    const executionId = await executor.startWorkflow({
      name: workflowName,
      version: 1,
      correlationId: `${workflowName}-id`
    });

    expect(executionId).toBeDefined();

    // decrease speed again
    manager.updatePollingOptions({ pollInterval: BASE_TIME, concurrency: 1 });

    const workflowStatus = await TestUtil.waitForWorkflowCompletion(executor, executionId, BASE_TIME * 30);

    expect(workflowStatus.status).toEqual("COMPLETED");
    await manager.stopPolling();

    expect(manager.isPolling).toBeFalsy();
    expect(manager.options.concurrency).toBe(1);
    expect(manager.options.pollInterval).toBe(BASE_TIME);
  });

  test("Should not be able to startPolling if TaskManager has no workers", async () => {
    const client = await clientPromise;
    const manager = new TaskManager(client, [], {
      options: { pollInterval: BASE_TIME, concurrency: 2 },
    });
    expect(() => manager.startPolling()).toThrow(
      "No workers supplied to TaskManager"
    );
  });

  test("Should not be able to startPolling if duplicate workers", async () => {
    const client = await clientPromise;
    const workerName = `jsSdkTest-worker-name-${Date.now()}`;

    const workerNames: string[] = Array.from({ length: 3 })
      .fill(0)
      .map(() => workerName);

    // names to actual workers
    const workers: ConductorWorker[] = workerNames.map((name) => ({
      taskDefName: name,
      execute: async () => {
        return {
          outputData: {
            hello: "From your worker",
          },
          status: "COMPLETED",
        };
      },
    }));

    const manager = new TaskManager(client, workers, {
      options: { pollInterval: BASE_TIME, concurrency: 2 },
    });
    expect(() => manager.startPolling()).toThrow(
      `Duplicate worker taskDefName: ${workerName}`
    );
  });

  test("Updates single worker properties", async () => {
    const client = await clientPromise;

    const executor = new WorkflowExecutor(client);
    const workerName = `jsSdkTest-taskman-single-worker-update-${Date.now()}`;
    // just create a bunch of worker names
    const workerNames: string[] = Array.from({ length: 3 })
      .fill(0)
      .map((_, i: number) => `${workerName}-${1 + i}`);

    const candidateWorkerUpdate = `${workerName}-1`;
    const initialCandidateWorkflowOptions = {
      concurrency: 1,
      pollInterval: BASE_TIME * 3,
    };

    // names to actual workers
    const workers: ConductorWorker[] = workerNames.map((name) => ({
      taskDefName: name,
      execute: async () => {
        return {
          outputData: {
            hello: "From your worker",
          },
          status: "COMPLETED",
        };
      },
      ...(name === candidateWorkerUpdate
        ? initialCandidateWorkflowOptions
        : {}),
    }));

    //create the manager with initial configuations
    const manager = new TaskManager(client, workers, {
      options: { pollInterval: BASE_TIME, concurrency: 2 },
      logger: mockLogger,
    });
    // start polling
    manager.startPolling();

    expect(manager.isPolling).toBeTruthy();

    const workflowName = `jsSdkTest-taskmanager-multi-single-worker-update-wf-${Date.now()}`;

    const updatedWorkerOptions = {
      concurrency: 3,
      pollInterval: BASE_TIME,
    };

    // change the polling options for a single worker
    manager.updatePollingOptionForWorker(
      candidateWorkerUpdate,
      updatedWorkerOptions
    );

    // create the workflow where we will run the test
    await executor.registerWorkflow(true, {
      name: workflowName,
      version: 1,
      ownerEmail: "developers@orkes.io",
      tasks: workerNames.map((name) => simpleTask(name, name, {})),
      inputParameters: [],
      outputParameters: {},
      timeoutSeconds: 0,
    });

    //Start workflow
    const executionId = await executor.startWorkflow({
      name: workflowName,
      version: 1,
      correlationId: `${workflowName}-id`
    });
    expect(executionId).toBeDefined();

    // decrease speed again
    manager.updatePollingOptions({ pollInterval: BASE_TIME, concurrency: 1 });

    const workflowStatus = await TestUtil.waitForWorkflowCompletion(executor, executionId, BASE_TIME * 30);

    expect(workflowStatus.status).toEqual("COMPLETED");
    await manager.stopPolling();

    expect(manager.isPolling).toBeFalsy();
    expect(manager.options.concurrency).toBe(1);
    expect(manager.options.pollInterval).toBe(BASE_TIME);
    expect(mockLogger.info).toHaveBeenCalledWith(
      `TaskWorker ${candidateWorkerUpdate} initialized with concurrency of ${initialCandidateWorkflowOptions.concurrency} and poll interval of ${initialCandidateWorkflowOptions.pollInterval}`
    );


    expect(mockLogger.info).toHaveBeenCalledWith(
      `TaskWorker ${candidateWorkerUpdate} configuration updated with concurrency of ${updatedWorkerOptions.concurrency} and poll interval of ${updatedWorkerOptions.pollInterval}`
    );
  });
});
