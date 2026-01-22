import { afterEach, beforeAll, describe, expect, test } from "@jest/globals";
import type { Task } from "../open-api";
import {
  NonRetryableException,
  TaskHandler,
  WorkflowExecutor,
  clearWorkerRegistry,
  getRegisteredWorkers,
  orkesConductorClient,
  simpleTask,
  worker,
} from "../sdk";
import type {
  PollCompleted,
  PollStarted,
  TaskExecutionCompleted,
  TaskExecutionStarted,
} from "../sdk/clients/worker/events/types";
import { waitForWorkflowStatus } from "./utils/waitForWorkflowStatus";

describe("SDK Worker Registration", () => {
  const clientPromise = orkesConductorClient();
  let executor: WorkflowExecutor;

  beforeAll(async () => {
    const client = await clientPromise;
    executor = new WorkflowExecutor(client);
  });

  afterEach(() => {
    // Clean up worker registry after each test to prevent conflicts
    clearWorkerRegistry();
  });

  test("worker() function registers workers in global registry", async () => {
    const taskName = `sdk_test_basic_worker_${Date.now()}`;

    // Define worker using worker() function
    worker({ taskDefName: taskName })(
      async function basicWorker() {
        return {
          status: "COMPLETED" as const,
          outputData: { message: "Worker registered successfully" },
        };
      }
    );

    // Verify worker is registered
    const registeredWorkers = getRegisteredWorkers();
    expect(registeredWorkers.length).toBe(1);
    expect(registeredWorkers[0]?.taskDefName).toBe(taskName);
  });

  test("TaskHandler auto-discovers and executes decorated workers", async () => {
    const client = await clientPromise;
    const taskName = `sdk_test_auto_discover_${Date.now()}`;
    const workflowName = `sdk_test_auto_discover_wf_${Date.now()}`;

    let workerExecuted = false;

    // Define worker using worker() function
    worker({ taskDefName: taskName, pollInterval: 100 })(
      async function autoDiscoverWorker(task: Task) {
        workerExecuted = true;
        return {
          status: "COMPLETED" as const,
          outputData: {
            message: "Auto-discovered worker executed",
            inputReceived: task.inputData,
          },
        };
      }
    );

    // Create TaskHandler with auto-discovery
    const handler = new TaskHandler({
      client,
      scanForDecorated: true,
    });

    expect(handler.workerCount).toBe(1);
    expect(handler.running).toBe(false);

    // Register workflow
    await executor.registerWorkflow(true, {
      name: workflowName,
      version: 1,
      ownerEmail: "developers@orkes.io",
      tasks: [simpleTask(taskName, taskName, {})],
      inputParameters: [],
      outputParameters: {},
      timeoutSeconds: 0,
    });

    // Start workers
    handler.startWorkers();
    expect(handler.running).toBe(true);
    expect(handler.runningWorkerCount).toBe(1);

    // Execute workflow
    const { workflowId } = await executor.executeWorkflow(
      {
        name: workflowName,
        version: 1,
        input: { testData: "hello" },
      },
      workflowName,
      1,
      `${workflowName}-id`
    );

    if (!workflowId) {
      throw new Error("Workflow ID is undefined");
    }

    // Wait for workflow completion
    const workflowStatus = await waitForWorkflowStatus(
      executor,
      workflowId,
      "COMPLETED",
      30000
    );

    expect(workflowStatus.status).toBe("COMPLETED");
    expect(workerExecuted).toBe(true);

    const [firstTask] = workflowStatus.tasks || [];
    expect(firstTask?.taskType).toBe(taskName);
    expect(firstTask?.status).toBe("COMPLETED");
    expect(firstTask?.outputData?.message).toBe("Auto-discovered worker executed");
    expect(firstTask?.outputData?.inputReceived).toEqual({ testData: "hello" });

    // Stop workers
    await handler.stopWorkers();
    expect(handler.running).toBe(false);
    expect(handler.runningWorkerCount).toBe(0);
  }, 30000);

  test("worker with concurrency processes multiple tasks", async () => {
    const client = await clientPromise;
    const taskName = `sdk_test_concurrency_${Date.now()}`;
    const workflowName = `sdk_test_concurrency_wf_${Date.now()}`;

    let executionCount = 0;
    const executionTimes: number[] = [];

    // Define worker with concurrency
    worker({ taskDefName: taskName, concurrency: 3, pollInterval: 100 })(
      async function concurrentWorker(task: Task) {
        const startTime = Date.now();
        executionCount++;

        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 100));

        executionTimes.push(Date.now() - startTime);

        return {
          status: "COMPLETED" as const,
          outputData: {
            executionNumber: executionCount,
            taskId: task.taskId,
          },
        };
      }
    );

    const handler = new TaskHandler({
      client,
      scanForDecorated: true,
    });

    // Register workflow with multiple tasks
    await executor.registerWorkflow(true, {
      name: workflowName,
      version: 1,
      ownerEmail: "developers@orkes.io",
      tasks: [
        simpleTask(`${taskName}_1`, taskName, {}),
        simpleTask(`${taskName}_2`, taskName, {}),
        simpleTask(`${taskName}_3`, taskName, {}),
      ],
      inputParameters: [],
      outputParameters: {},
      timeoutSeconds: 0,
    });

    handler.startWorkers();

    const { workflowId } = await executor.executeWorkflow(
      {
        name: workflowName,
        version: 1,
      },
      workflowName,
      1,
      `${workflowName}-id`
    );

    if (!workflowId) {
      throw new Error("Workflow ID is undefined");
    }

    const workflowStatus = await waitForWorkflowStatus(
      executor,
      workflowId,
      "COMPLETED",
      30000
    );

    expect(workflowStatus.status).toBe("COMPLETED");
    expect(executionCount).toBe(3);

    await handler.stopWorkers();
  }, 30000);

  test("worker with domain isolation", async () => {
    const client = await clientPromise;
    const taskName = `sdk_test_domain_${Date.now()}`;
    const domain = "test_domain";

    // Define worker with domain
    worker({ taskDefName: taskName, domain, pollInterval: 100 })(
      async function domainWorker() {
        return {
          status: "COMPLETED" as const,
          outputData: { domain: "processed_in_domain" },
        };
      }
    );

    const handler = new TaskHandler({
      client,
      scanForDecorated: true,
    });

    expect(handler.workerCount).toBe(1);

    const registeredWorkers = getRegisteredWorkers();
    expect(registeredWorkers[0]?.domain).toBe(domain);

    handler.startWorkers();
    await handler.stopWorkers();
  });

  test("NonRetryableException marks task as terminal failure", async () => {
    const client = await clientPromise;
    const taskName = `sdk_test_non_retryable_${Date.now()}`;
    const workflowName = `sdk_test_non_retryable_wf_${Date.now()}`;

    // Define worker that throws NonRetryableException
    worker({ taskDefName: taskName, pollInterval: 100 })(
      async function nonRetryableWorker(task: Task) {
        const shouldFail = task.inputData?.shouldFail;

        if (shouldFail === "terminal") {
          throw new NonRetryableException("Order not found - terminal error");
        }

        return {
          status: "COMPLETED" as const,
          outputData: { message: "Success" },
        };
      }
    );

    const handler = new TaskHandler({
      client,
      scanForDecorated: true,
    });

    // Register workflow
    await executor.registerWorkflow(true, {
      name: workflowName,
      version: 1,
      ownerEmail: "developers@orkes.io",
      tasks: [simpleTask(taskName, taskName, {})],
      inputParameters: [],
      outputParameters: {},
      timeoutSeconds: 0,
    });

    handler.startWorkers();

    // Execute workflow with shouldFail flag
    const { workflowId } = await executor.executeWorkflow(
      {
        name: workflowName,
        version: 1,
        input: { shouldFail: "terminal" },
      },
      workflowName,
      1,
      `${workflowName}-id`
    );

    if (!workflowId) {
      throw new Error("Workflow ID is undefined");
    }

    // Wait for workflow to fail
    const workflowStatus = await waitForWorkflowStatus(
      executor,
      workflowId,
      "FAILED",
      30000
    );

    expect(workflowStatus.status).toBe("FAILED");

    const [firstTask] = workflowStatus.tasks || [];
    expect(firstTask?.status).toBe("FAILED_WITH_TERMINAL_ERROR");
    expect(firstTask?.reasonForIncompletion).toContain("Order not found - terminal error");

    await handler.stopWorkers();
  }, 30000);

  test("regular exceptions mark task for retry", async () => {
    const client = await clientPromise;
    const taskName = `sdk_test_retryable_${Date.now()}`;
    const workflowName = `sdk_test_retryable_wf_${Date.now()}`;

    let attemptCount = 0;

    // Define worker that throws regular exception first, then succeeds
    worker({ taskDefName: taskName, pollInterval: 100 })(
      async function retryableWorker() {
        attemptCount++;

        if (attemptCount === 1) {
          // First attempt fails with retryable error
          throw new Error("Temporary error - will retry");
        }

        // Second attempt succeeds
        return {
          status: "COMPLETED" as const,
          outputData: { message: "Success on retry", attempts: attemptCount },
        };
      }
    );

    const handler = new TaskHandler({
      client,
      scanForDecorated: true,
    });

    // Register workflow with retry policy
    await executor.registerWorkflow(true, {
      name: workflowName,
      version: 1,
      ownerEmail: "developers@orkes.io",
      tasks: [simpleTask(taskName, taskName, {})],
      inputParameters: [],
      outputParameters: {},
      timeoutSeconds: 0,
    });

    handler.startWorkers();

    const { workflowId } = await executor.executeWorkflow(
      {
        name: workflowName,
        version: 1,
      },
      workflowName,
      1,
      `${workflowName}-id`
    );

    if (!workflowId) {
      throw new Error("Workflow ID is undefined");
    }

    const workflowStatus = await waitForWorkflowStatus(
      executor,
      workflowId,
      "COMPLETED",
      30000
    );

    expect(workflowStatus.status).toBe("COMPLETED");
    expect(attemptCount).toBeGreaterThanOrEqual(2);

    const [firstTask] = workflowStatus.tasks || [];
    expect(firstTask?.status).toBe("COMPLETED");
    expect(firstTask?.outputData?.message).toBe("Success on retry");

    await handler.stopWorkers();
  }, 30000);

  test("event listeners receive lifecycle events", async () => {
    const client = await clientPromise;
    const taskName = `sdk_test_events_${Date.now()}`;
    const workflowName = `sdk_test_events_wf_${Date.now()}`;

    const events: string[] = [];

    // Define worker
    worker({ taskDefName: taskName, pollInterval: 100 })(
      async function eventWorker() {
        return {
          status: "COMPLETED" as const,
          outputData: { message: "Event test" },
        };
      }
    );

    // Define event listener
    const eventListener = {
      onPollStarted(event: PollStarted) {
        events.push(`poll_started:${event.workerId}`);
      },
      onPollCompleted(event: PollCompleted) {
        events.push(`poll_completed:${event.tasksReceived}`);
      },
      onTaskExecutionStarted(event: TaskExecutionStarted) {
        events.push(`task_started:${event.taskType}`);
      },
      onTaskExecutionCompleted(event: TaskExecutionCompleted) {
        events.push(`task_completed:${event.taskType}`);
      },
    };

    const handler = new TaskHandler({
      client,
      scanForDecorated: true,
      eventListeners: [eventListener],
    });

    // Register workflow
    await executor.registerWorkflow(true, {
      name: workflowName,
      version: 1,
      ownerEmail: "developers@orkes.io",
      tasks: [simpleTask(taskName, taskName, {})],
      inputParameters: [],
      outputParameters: {},
      timeoutSeconds: 0,
    });

    handler.startWorkers();

    const { workflowId } = await executor.executeWorkflow(
      {
        name: workflowName,
        version: 1,
      },
      workflowName,
      1,
      `${workflowName}-id`
    );

    if (!workflowId) {
      throw new Error("Workflow ID is undefined");
    }

    await waitForWorkflowStatus(executor, workflowId, "COMPLETED", 30000);

    // Verify events were captured
    expect(events.length).toBeGreaterThan(0);
    expect(events.some(e => e.startsWith("poll_started"))).toBe(true);
    expect(events.some(e => e.startsWith("task_started"))).toBe(true);
    expect(events.some(e => e.startsWith("task_completed"))).toBe(true);

    await handler.stopWorkers();
  }, 30000);

  test("multiple workers can be registered and executed", async () => {
    const client = await clientPromise;
    const taskName1 = `sdk_test_multi_1_${Date.now()}`;
    const taskName2 = `sdk_test_multi_2_${Date.now()}`;
    const workflowName = `sdk_test_multi_wf_${Date.now()}`;

    let worker1Executed = false;
    let worker2Executed = false;

    // Define first worker
    worker({ taskDefName: taskName1, pollInterval: 100 })(
      async function worker1() {
        worker1Executed = true;
        return {
          status: "COMPLETED" as const,
          outputData: { worker: "worker1" },
        };
      }
    );

    // Define second worker
    worker({ taskDefName: taskName2, pollInterval: 100 })(
      async function worker2() {
        worker2Executed = true;
        return {
          status: "COMPLETED" as const,
          outputData: { worker: "worker2" },
        };
      }
    );

    const handler = new TaskHandler({
      client,
      scanForDecorated: true,
    });

    expect(handler.workerCount).toBe(2);

    // Register workflow with both tasks
    await executor.registerWorkflow(true, {
      name: workflowName,
      version: 1,
      ownerEmail: "developers@orkes.io",
      tasks: [
        simpleTask(`${taskName1}_ref`, taskName1, {}),
        simpleTask(`${taskName2}_ref`, taskName2, {}),
      ],
      inputParameters: [],
      outputParameters: {},
      timeoutSeconds: 0,
    });

    handler.startWorkers();
    expect(handler.runningWorkerCount).toBe(2);

    const { workflowId } = await executor.executeWorkflow(
      {
        name: workflowName,
        version: 1,
      },
      workflowName,
      1,
      `${workflowName}-id`
    );

    if (!workflowId) {
      throw new Error("Workflow ID is undefined");
    }

    const workflowStatus = await waitForWorkflowStatus(
      executor,
      workflowId,
      "COMPLETED",
      30000
    );

    expect(workflowStatus.status).toBe("COMPLETED");
    expect(worker1Executed).toBe(true);
    expect(worker2Executed).toBe(true);

    await handler.stopWorkers();
  }, 30000);

  test("TaskHandler lifecycle - start and stop multiple times", async () => {
    const client = await clientPromise;
    const taskName = `sdk_test_lifecycle_${Date.now()}`;

    worker({ taskDefName: taskName, pollInterval: 100 })(
      async function lifecycleWorker() {
        return {
          status: "COMPLETED" as const,
          outputData: { message: "Lifecycle test" },
        };
      }
    );

    const handler = new TaskHandler({
      client,
      scanForDecorated: true,
    });

    // Initial state
    expect(handler.running).toBe(false);
    expect(handler.runningWorkerCount).toBe(0);

    // Start workers
    handler.startWorkers();
    expect(handler.running).toBe(true);
    expect(handler.runningWorkerCount).toBe(1);

    // Starting again should be idempotent
    handler.startWorkers();
    expect(handler.running).toBe(true);
    expect(handler.runningWorkerCount).toBe(1);

    // Stop workers
    await handler.stopWorkers();
    expect(handler.running).toBe(false);
    expect(handler.runningWorkerCount).toBe(0);

    // Stopping again should be idempotent
    await handler.stopWorkers();
    expect(handler.running).toBe(false);
    expect(handler.runningWorkerCount).toBe(0);

    // Can restart after stopping
    handler.startWorkers();
    expect(handler.running).toBe(true);
    expect(handler.runningWorkerCount).toBe(1);

    await handler.stopWorkers();
  });

  test("manual workers can be added alongside decorated workers", async () => {
    const client = await clientPromise;
    const decoratedTaskName = `sdk_test_decorated_${Date.now()}`;
    const manualTaskName = `sdk_test_manual_${Date.now()}`;

    // Define decorated worker
    worker({ taskDefName: decoratedTaskName, pollInterval: 100 })(
      async function decoratedWorker() {
        return {
          status: "COMPLETED" as const,
          outputData: { type: "decorated" },
        };
      }
    );

    // Create handler with manual worker
    const handler = new TaskHandler({
      client,
      scanForDecorated: true,
      workers: [
        {
          taskDefName: manualTaskName,
          execute: async () => {
            return {
              status: "COMPLETED" as const,
              outputData: { type: "manual" },
            };
          },
        },
      ],
    });

    expect(handler.workerCount).toBe(2);

    handler.startWorkers();
    expect(handler.runningWorkerCount).toBe(2);

    await handler.stopWorkers();
  });

  test("worker with custom configuration options", async () => {
    const taskName = `sdk_test_custom_config_${Date.now()}`;

    // Define worker with custom configuration
    worker({
      taskDefName: taskName,
      concurrency: 5,
      pollInterval: 200,
      domain: "custom_domain",
    })(
      async function customConfigWorker() {
        return {
          status: "COMPLETED" as const,
          outputData: { message: "Custom config test" },
        };
      }
    );

    const registeredWorkers = getRegisteredWorkers();
    expect(registeredWorkers.length).toBe(1);

    const workerConfig = registeredWorkers[0];
    expect(workerConfig?.taskDefName).toBe(taskName);
    expect(workerConfig?.concurrency).toBe(5);
    expect(workerConfig?.pollInterval).toBe(200);
    expect(workerConfig?.domain).toBe("custom_domain");
  });

  test("clearWorkerRegistry removes all registered workers", () => {
    const taskName1 = `sdk_test_clear_1_${Date.now()}`;
    const taskName2 = `sdk_test_clear_2_${Date.now()}`;

    worker({ taskDefName: taskName1 })(
      async function worker1() {
        return { status: "COMPLETED" as const, outputData: {} };
      }
    );

    worker({ taskDefName: taskName2 })(
      async function worker2() {
        return { status: "COMPLETED" as const, outputData: {} };
      }
    );

    expect(getRegisteredWorkers().length).toBe(2);

    clearWorkerRegistry();

    expect(getRegisteredWorkers().length).toBe(0);
  });
});
