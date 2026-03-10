import { expect, describe, test, jest, afterEach } from "@jest/globals";
import {
  MetadataClient,
  simpleTask,
  taskDefinition,
  WorkflowExecutor,
  orkesConductorClient,
  TaskManager,
  ConductorWorker,
} from "../sdk";
import { mockLogger } from "./utils/mockLogger";
import { waitForWorkflowCompletion } from "./utils/waitForWorkflowCompletion";

const BASE_TIME = 1000;
describe("TaskManager", () => {
  const clientPromise = orkesConductorClient();
  const workflowsToCleanup: { name: string; version: number }[] = [];
  const tasksToCleanup: string[] = [];
  const activeManagers: TaskManager[] = [];

  jest.setTimeout(60000);

  afterEach(async () => {
    for (const m of activeManagers) {
      try {
        await m.stopPolling();
      } catch {
        // ignore
      }
    }
    activeManagers.length = 0;

    const client = await clientPromise;
    const metadataClient = new MetadataClient(client);
    await Promise.allSettled(
      workflowsToCleanup.map((w) =>
        metadataClient.unregisterWorkflow(w.name, w.version)
      )
    );
    await Promise.allSettled(
      tasksToCleanup.map((t) => metadataClient.unregisterTask(t))
    );
    workflowsToCleanup.length = 0;
    tasksToCleanup.length = 0;
  });

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
    activeManagers.push(manager);

    await executor.registerWorkflow(true, {
      name: workflowName,
      version: 1,
      ownerEmail: "developers@orkes.io",
      tasks: [simpleTask(taskName, taskName, {})],
      inputParameters: [],
      outputParameters: {},
      timeoutSeconds: 0,
    });
    workflowsToCleanup.push({ name: workflowName, version: 1 });

    const executionId = await executor.startWorkflow({
      name: workflowName,
      input: {},
      version: 1,
    });

    if (!executionId) {
      throw new Error("Execution ID is undefined");
    }

    const workflowStatus = await waitForWorkflowCompletion(
      executor,
      executionId,
      BASE_TIME * 30
    );

    expect(workflowStatus.status).toEqual("COMPLETED");

    await manager.stopPolling();
  });

  test("On error it should call the errorHandler provided", async () => {
    const client = await clientPromise;
    const executor = new WorkflowExecutor(client);
    const metadataClient = new MetadataClient(client);
    const taskName = `jsSdkTest-taskmanager-error-handler-test-${Date.now()}`;
    const workflowName = `jsSdkTest-taskmanager-error-handler-test-wf-${Date.now()}`;

    const mockErrorHandler = jest.fn();

    const worker: ConductorWorker = {
      taskDefName: taskName,
      execute: async () => {
        throw new Error("This is a forced error for testing error handler");
      },
    };

    // Let previous test's cleanup settle on the server; retry register in case of transient failure
    await new Promise((r) => setTimeout(r, 1500));
    const taskDef = taskDefinition({
      name: taskName,
      timeoutSeconds: 0,
      retryCount: 0,
    });
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await metadataClient.registerTask(taskDef);
        break;
      } catch (e) {
        if (attempt === 3) throw e;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    tasksToCleanup.push(taskName);

    const manager = new TaskManager(client, [worker], {
      options: { pollInterval: BASE_TIME },
      onError: mockErrorHandler,
    });

    manager.startPolling();
    activeManagers.push(manager);

    await executor.registerWorkflow(true, {
      name: workflowName,
      version: 1,
      ownerEmail: "developers@orkes.io",
      tasks: [simpleTask(taskName, taskName, {})],
      inputParameters: [],
      outputParameters: {},
      timeoutSeconds: 0,
    });
    workflowsToCleanup.push({ name: workflowName, version: 1 });

    const status = await executor.startWorkflow({
      name: workflowName,
      input: {},
      version: 1,
      correlationId: `${workflowName}-id`,
    });

    if (!status) {
      throw new Error("Status is undefined");
    }

    const workflowStatus = await waitForWorkflowCompletion(
      executor,
      status,
      BASE_TIME * 30
    );

    expect(workflowStatus.status).toEqual("FAILED");

    // Error handler is invoked after updateTaskWithRetry resolves, so it may run
    // after we observe FAILED. Wait for it with a short poll to avoid flakiness.
    const handlerWaitMs = 5000;
    const pollMs = 100;
    const deadline = Date.now() + handlerWaitMs;
    while (mockErrorHandler.mock.calls.length < 1 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, pollMs));
    }
    expect(mockErrorHandler).toHaveBeenCalledTimes(1);
    await manager.stopPolling();
  });

  test("If no error handler provided. it should just update the task", async () => {
    const client = await clientPromise;
    const executor = new WorkflowExecutor(client);
    const metadataClient = new MetadataClient(client);
    const taskName = `jsSdkTest-taskmanager-error-test-${Date.now()}`;
    const workflowName = `jsSdkTest-taskmanager-error-test-wf-${Date.now()}`;

    const worker: ConductorWorker = {
      taskDefName: taskName,
      execute: async () => {
        throw new Error("This is a forced error");
      },
    };

    await metadataClient.registerTask(
      taskDefinition({
        name: taskName,
        timeoutSeconds: 0,
        retryCount: 0,
      })
    );
    tasksToCleanup.push(taskName);

    const manager = new TaskManager(client, [worker], {
      options: { pollInterval: BASE_TIME },
    });

    manager.startPolling();
    activeManagers.push(manager);

    await executor.registerWorkflow(true, {
      name: workflowName,
      version: 1,
      ownerEmail: "developers@orkes.io",
      tasks: [simpleTask(taskName, taskName, {})],
      inputParameters: [],
      outputParameters: {},
      timeoutSeconds: 0,
    });
    workflowsToCleanup.push({ name: workflowName, version: 1 });

    const executionId = await executor.startWorkflow({
      name: workflowName,
      input: {},
      version: 1,
      correlationId: `${workflowName}-id`,
    });

    if (!executionId) {
      throw new Error("Execution ID is undefined");
    }

    const workflowStatus = await waitForWorkflowCompletion(
      executor,
      executionId,
      BASE_TIME * 30
    );
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
    activeManagers.push(manager);

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
    workflowsToCleanup.push({ name: workflowName, version: 1 });

    //Start workflow
    const executionId = await executor.startWorkflow({
      name: workflowName,
      version: 1,
      correlationId: `${workflowName}-id`,
    });

    expect(executionId).toBeDefined();
    if (!executionId) {
      throw new Error("Execution ID is undefined");
    }

    // decrease speed again
    manager.updatePollingOptions({ pollInterval: BASE_TIME, concurrency: 1 });

    const workflowStatus = await waitForWorkflowCompletion(
      executor,
      executionId,
      BASE_TIME * 30
    );

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
    activeManagers.push(manager);

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
    workflowsToCleanup.push({ name: workflowName, version: 1 });

    //Start workflow
    const executionId = await executor.startWorkflow({
      name: workflowName,
      version: 1,
      correlationId: `${workflowName}-id`,
    });
    expect(executionId).toBeDefined();
    if (!executionId) {
      throw new Error("Execution ID is undefined");
    }

    // decrease speed again
    manager.updatePollingOptions({ pollInterval: BASE_TIME, concurrency: 1 });

    const workflowStatus = await waitForWorkflowCompletion(
      executor,
      executionId,
      BASE_TIME * 30
    );

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
