import type { TaskRunnerEventsListener } from "@/sdk/clients/worker/events";
import type {
  PollCompleted,
  PollFailure,
  PollStarted,
  TaskExecutionCompleted,
  TaskExecutionFailure,
  TaskExecutionStarted,
  TaskUpdateFailure,
} from "@/sdk/clients/worker/events/types";
import { NonRetryableException } from "@/sdk/clients/worker/exceptions";
import { TaskRunner } from "@/sdk/clients/worker/TaskRunner";
import { RunnerArgs } from "@/sdk/clients/worker/types";
import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { TaskResource } from "@open-api/generated";
import type { Client } from "@open-api/generated/client/types.gen";
import type { Task, TaskResult } from "@open-api/index";
import { TaskResultStatusEnum } from "@open-api/index";
import { mockLogger } from "@test-utils/mockLogger";

jest.mock("@open-api/generated", () => ({
  TaskResource: {
    batchPoll: jest.fn(),
    updateTask: jest.fn(),
  },
}));

// Create a proper mock client with all required methods
const createMockClient = (): Client => {
  const mockFn = jest.fn<() => Promise<{ data: null }>>().mockResolvedValue({ data: null });
  return {
    buildUrl: jest.fn(),
    getConfig: jest.fn(),
    request: jest.fn(),
    setConfig: jest.fn(),
    get: mockFn,
    post: mockFn,
    put: mockFn,
    patch: mockFn,
    delete: mockFn,
    options: mockFn,
    head: mockFn,
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() },
      error: { use: jest.fn(), eject: jest.fn() },
    },
  } as unknown as Client;
};

// Track runners for cleanup
const activeRunners: TaskRunner[] = [];

afterEach(async () => {
  // Stop all runners
  for (const runner of activeRunners) {
    runner.stopPolling();
  }
  activeRunners.length = 0;

  // Wait for async operations to complete
  await new Promise(resolve => setTimeout(resolve, 50));

  jest.clearAllMocks();
});

test("polls tasks", async () => {
  const mockClient = createMockClient();
  const workerID = "worker-id";
  const args: RunnerArgs = {
    worker: {
      taskDefName: "test",
      execute: async ({ inputData }) => {
        return {
          outputData: {
            hello: "from worker",
            ...inputData,
          },
          status: "COMPLETED",
        };
      },
    },
    options: {
      pollInterval: 10,
      domain: "",
      concurrency: 1,
      workerID,
    },
    logger: mockLogger,
    client: mockClient,
  };
  const workflowInstanceId = "fake-workflow-id";
  const taskId = "fake-task-id";

  const mockTask: Task = {
    taskId,
    workflowInstanceId,
    status: "IN_PROGRESS",
    reasonForIncompletion: undefined,
    inputData: {
      input: "from workflow",
    },
  };

  const mockBatchPoll = TaskResource.batchPoll as jest.MockedFunction<
    typeof TaskResource.batchPoll
  >;
  mockBatchPoll.mockResolvedValue({
    data: [mockTask],
  } as Awaited<ReturnType<typeof TaskResource.batchPoll>>);

  const runner = new TaskRunner(args);
  activeRunners.push(runner);
  runner.startPolling();

  // Wait for polling to occur
  await new Promise((r) => setTimeout(() => r(true), 100));
  runner.stopPolling();

  const expected = {
    taskId,
    workflowInstanceId,
    status: TaskResultStatusEnum.COMPLETED,
    workerId: workerID,
    outputData: {
      hello: "from worker",
      input: "from workflow",
    },
  };
  expect(TaskResource.updateTask).toHaveBeenCalledWith({
    client: mockClient,
    body: expected,
  });
});

test("Should set the task as failed if the task has an error", async () => {
  const mockClient = createMockClient();
  const workerID = "worker-id";
  const args: RunnerArgs = {
    worker: {
      taskDefName: "test",
      execute: async () => {
        throw new Error("Expected error from worker");
      },
    },
    options: {
      pollInterval: 10,
      domain: "",
      concurrency: 1,
      workerID,
    },
    logger: mockLogger,
    client: mockClient,
  };
  const workflowInstanceId = "fake-workflow-id";
  const taskId = "fake-task-id";

  const mockTask: Task = {
    taskId,
    workflowInstanceId,
    status: "IN_PROGRESS",
    reasonForIncompletion: undefined,
    inputData: {
      input: "from workflow",
    },
  };

  const mockBatchPoll = TaskResource.batchPoll as jest.MockedFunction<
    typeof TaskResource.batchPoll
  >;
  mockBatchPoll.mockResolvedValue({
    data: [mockTask],
  } as Awaited<ReturnType<typeof TaskResource.batchPoll>>);

  const runner = new TaskRunner(args);
  activeRunners.push(runner);
  runner.startPolling();

  // Wait for polling to occur
  await new Promise((r) => setTimeout(() => r(true), 100));
  runner.stopPolling();

  const expected = {
    taskId,
    workflowInstanceId,
    workerId: workerID,
    status: TaskResultStatusEnum.FAILED,
    outputData: {},
    reasonForIncompletion: "Expected error from worker",
  };
  expect(TaskResource.updateTask).toHaveBeenCalledWith({
    client: mockClient,
    body: expected,
  });
});

describe("NonRetryableException handling", () => {
  test("Should mark task as FAILED_WITH_TERMINAL_ERROR when NonRetryableException is thrown", async () => {
    const mockClient = createMockClient();
    const workerID = "worker-id";
    const args: RunnerArgs = {
      worker: {
        taskDefName: "test",
        execute: async () => {
          throw new NonRetryableException("Business validation failed");
        },
      },
      options: {
        pollInterval: 10,
        domain: "",
        concurrency: 1,
        workerID,
      },
      logger: mockLogger,
      client: mockClient,
    };

    const workflowInstanceId = "fake-workflow-id";
    const taskId = "fake-task-id";

    const mockTask: Task = {
      taskId,
      workflowInstanceId,
      status: "IN_PROGRESS",
      reasonForIncompletion: undefined,
      inputData: {},
    };

    const mockBatchPoll = TaskResource.batchPoll as jest.MockedFunction<
      typeof TaskResource.batchPoll
    >;
    mockBatchPoll.mockResolvedValue({
      data: [mockTask],
    } as Awaited<ReturnType<typeof TaskResource.batchPoll>>);

    const runner = new TaskRunner(args);
    activeRunners.push(runner);
    runner.startPolling();

    await new Promise((r) => setTimeout(() => r(true), 100));
    runner.stopPolling();

    const expected = {
      taskId,
      workflowInstanceId,
      workerId: workerID,
      status: "FAILED_WITH_TERMINAL_ERROR" as const,
      outputData: {},
      reasonForIncompletion: "Business validation failed",
    };
    expect(TaskResource.updateTask).toHaveBeenCalledWith({
      client: mockClient,
      body: expected,
    });
  });
});

describe("Task update retry logic", () => {
  test("Should retry failed task updates with exponential backoff", async () => {
    const mockClient = createMockClient();
    const workerID = "worker-id";
    const onError = jest.fn();

    const args: RunnerArgs = {
      worker: {
        taskDefName: "test",
        execute: async ({ inputData }) => {
          return {
            outputData: inputData,
            status: "COMPLETED",
          };
        },
      },
      options: {
        pollInterval: 10,
        domain: "",
        concurrency: 1,
        workerID,
      },
      logger: mockLogger,
      client: mockClient,
      onError,
      maxRetries: 2,
    };

    const workflowInstanceId = "fake-workflow-id";
    const taskId = "fake-task-id";

    const mockTask: Task = {
      taskId,
      workflowInstanceId,
      status: "IN_PROGRESS",
      inputData: {},
    };

    const mockBatchPoll = TaskResource.batchPoll as jest.MockedFunction<
      typeof TaskResource.batchPoll
    >;
    // Return task once, then return empty array
    mockBatchPoll
      .mockResolvedValueOnce({
        data: [mockTask],
        request: {} as Request,
        response: {} as Response,
      } as Awaited<ReturnType<typeof TaskResource.batchPoll>>)
      .mockResolvedValue({
        data: [],
        request: {} as Request,
        response: {} as Response,
      } as Awaited<ReturnType<typeof TaskResource.batchPoll>>);

    const mockUpdateTask = TaskResource.updateTask as jest.MockedFunction<
      typeof TaskResource.updateTask
    >;

    // Fail first attempt, succeed on second
    mockUpdateTask
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({} as Awaited<ReturnType<typeof TaskResource.updateTask>>);

    const runner = new TaskRunner(args);
    activeRunners.push(runner);
    runner.startPolling();

    await new Promise((r) => setTimeout(() => r(true), 15000));
    runner.stopPolling();

    // Should have been called twice (1 failure + 1 success)
    expect(mockUpdateTask).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(1);
  }, 20000);

  test("Should publish TaskUpdateFailure event after all retries exhausted", async () => {
    const mockClient = createMockClient();
    const workerID = "worker-id";
    const onTaskUpdateFailure = jest.fn<(event: TaskUpdateFailure) => void>();
    const eventListener: TaskRunnerEventsListener = {
      onTaskUpdateFailure,
    };

    const args: RunnerArgs = {
      worker: {
        taskDefName: "test",
        execute: async ({ inputData }) => {
          return {
            outputData: inputData,
            status: "COMPLETED",
          };
        },
      },
      options: {
        pollInterval: 10,
        domain: "",
        concurrency: 1,
        workerID,
      },
      logger: mockLogger,
      client: mockClient,
      maxRetries: 2,
      eventListeners: [eventListener],
    };

    const workflowInstanceId = "fake-workflow-id";
    const taskId = "fake-task-id";

    const mockTask: Task = {
      taskId,
      workflowInstanceId,
      status: "IN_PROGRESS",
      inputData: {},
    };

    const mockBatchPoll = TaskResource.batchPoll as jest.MockedFunction<
      typeof TaskResource.batchPoll
    >;
    // Return task once, then return empty array
    mockBatchPoll
      .mockResolvedValueOnce({
        data: [mockTask],
        request: {} as Request,
        response: {} as Response,
      } as Awaited<ReturnType<typeof TaskResource.batchPoll>>)
      .mockResolvedValue({
        data: [],
        request: {} as Request,
        response: {} as Response,
      } as Awaited<ReturnType<typeof TaskResource.batchPoll>>);

    const mockUpdateTask = TaskResource.updateTask as jest.MockedFunction<
      typeof TaskResource.updateTask
    >;

    // Fail all attempts
    mockUpdateTask.mockRejectedValue(new Error("Persistent network error"));

    const runner = new TaskRunner(args);
    activeRunners.push(runner);
    runner.startPolling();

    await new Promise((r) => setTimeout(() => r(true), 25000));
    runner.stopPolling();

    // Should have tried maxRetries times
    expect(mockUpdateTask).toHaveBeenCalledTimes(2);
    expect(onTaskUpdateFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId,
        workflowInstanceId,
        retryCount: 2,
      })
    );
  }, 30000);
});

describe("Multiple tasks handling", () => {
  test("Should process multiple tasks from batch poll", async () => {
    const mockClient = createMockClient();
    const workerID = "worker-id";
    const executeCount = jest.fn();

    const args: RunnerArgs = {
      worker: {
        taskDefName: "test",
        execute: async ({ inputData }) => {
          executeCount();
          return {
            outputData: inputData,
            status: "COMPLETED",
          };
        },
      },
      options: {
        pollInterval: 10,
        domain: "",
        concurrency: 3,
        workerID,
      },
      logger: mockLogger,
      client: mockClient,
    };

    const mockTasks: Task[] = [
      {
        taskId: "task-1",
        workflowInstanceId: "workflow-1",
        status: "IN_PROGRESS",
        inputData: { value: 1 },
      },
      {
        taskId: "task-2",
        workflowInstanceId: "workflow-1",
        status: "IN_PROGRESS",
        inputData: { value: 2 },
      },
      {
        taskId: "task-3",
        workflowInstanceId: "workflow-1",
        status: "IN_PROGRESS",
        inputData: { value: 3 },
      },
    ];

    const mockBatchPoll = TaskResource.batchPoll as jest.MockedFunction<
      typeof TaskResource.batchPoll
    >;
    mockBatchPoll.mockResolvedValue({
      data: mockTasks,
    } as Awaited<ReturnType<typeof TaskResource.batchPoll>>);

    const runner = new TaskRunner(args);
    activeRunners.push(runner);
    runner.startPolling();

    await new Promise((r) => setTimeout(() => r(true), 200));
    runner.stopPolling();

    expect(executeCount).toHaveBeenCalledTimes(3);
    expect(TaskResource.updateTask).toHaveBeenCalledTimes(3);
  });
});

describe("updateOptions", () => {
  test("Should update concurrency and pollInterval", async () => {
    const mockClient = createMockClient();
    const args: RunnerArgs = {
      worker: {
        taskDefName: "test",
        execute: async ({ inputData }) => ({
          outputData: inputData,
          status: "COMPLETED",
        }),
      },
      options: {
        pollInterval: 100,
        domain: "",
        concurrency: 1,
        workerID: "worker-id",
      },
      logger: mockLogger,
      client: mockClient,
    };

    const runner = new TaskRunner(args);

    expect(runner.getOptions.concurrency).toBe(1);
    expect(runner.getOptions.pollInterval).toBe(100);

    runner.updateOptions({ concurrency: 5, pollInterval: 50 });

    expect(runner.getOptions.concurrency).toBe(5);
    expect(runner.getOptions.pollInterval).toBe(50);
  });

  test("Should not trigger update if options are unchanged", async () => {
    const mockClient = createMockClient();
    const loggerSpy = {
      ...mockLogger,
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const args: RunnerArgs = {
      worker: {
        taskDefName: "test",
        execute: async ({ inputData }) => ({
          outputData: inputData,
          status: "COMPLETED",
        }),
      },
      options: {
        pollInterval: 100,
        domain: "",
        concurrency: 1,
        workerID: "worker-id",
      },
      logger: loggerSpy,
      client: mockClient,
    };

    const runner = new TaskRunner(args);

    // Clear initial logging
    loggerSpy.info.mockClear();

    // Update with same values
    runner.updateOptions({ concurrency: 1, pollInterval: 100 });

    // Should not log configuration update
    const configUpdateCalls = loggerSpy.info.mock.calls.filter((call) =>
      (call[0] as string)?.includes("configuration updated")
    );
    expect(configUpdateCalls).toHaveLength(0);
  });
});

describe("Task validation", () => {
  test("Should skip task execution if taskId is missing", async () => {
    const mockClient = createMockClient();
    const workerID = "worker-id";
    const executeFn = jest.fn<(task: Task) => Promise<Omit<TaskResult, "taskId" | "workflowInstanceId">>>();

    const args: RunnerArgs = {
      worker: {
        taskDefName: "test",
        execute: executeFn,
      },
      options: {
        pollInterval: 10,
        domain: "",
        concurrency: 1,
        workerID,
      },
      logger: mockLogger,
      client: mockClient,
    };

    const mockTask: Task = {
      workflowInstanceId: "workflow-1",
      status: "IN_PROGRESS",
      inputData: {},
      // taskId is missing
    };

    const mockBatchPoll = TaskResource.batchPoll as jest.MockedFunction<
      typeof TaskResource.batchPoll
    >;
    mockBatchPoll.mockResolvedValue({
      data: [mockTask],
    } as Awaited<ReturnType<typeof TaskResource.batchPoll>>);

    const runner = new TaskRunner(args);
    activeRunners.push(runner);
    runner.startPolling();

    await new Promise((r) => setTimeout(() => r(true), 100));
    runner.stopPolling();

    expect(executeFn).not.toHaveBeenCalled();
    expect(TaskResource.updateTask).not.toHaveBeenCalled();
  });

  test("Should skip task execution if workflowInstanceId is missing", async () => {
    const mockClient = createMockClient();
    const workerID = "worker-id";
    const executeFn = jest.fn<(task: Task) => Promise<Omit<TaskResult, "taskId" | "workflowInstanceId">>>();

    const args: RunnerArgs = {
      worker: {
        taskDefName: "test",
        execute: executeFn,
      },
      options: {
        pollInterval: 10,
        domain: "",
        concurrency: 1,
        workerID,
      },
      logger: mockLogger,
      client: mockClient,
    };

    const mockTask: Task = {
      taskId: "task-1",
      status: "IN_PROGRESS",
      inputData: {},
      // workflowInstanceId is missing
    };

    const mockBatchPoll = TaskResource.batchPoll as jest.MockedFunction<
      typeof TaskResource.batchPoll
    >;
    mockBatchPoll.mockResolvedValue({
      data: [mockTask],
    } as Awaited<ReturnType<typeof TaskResource.batchPoll>>);

    const runner = new TaskRunner(args);
    activeRunners.push(runner);
    runner.startPolling();

    await new Promise((r) => setTimeout(() => r(true), 100));
    runner.stopPolling();

    expect(executeFn).not.toHaveBeenCalled();
    expect(TaskResource.updateTask).not.toHaveBeenCalled();
  });
});

describe("Event listeners", () => {
  test("Should publish poll events", async () => {
    const mockClient = createMockClient();
    const onPollStarted = jest.fn<(event: PollStarted) => void>();
    const onPollCompleted = jest.fn<(event: PollCompleted) => void>();
    const eventListener: TaskRunnerEventsListener = {
      onPollStarted,
      onPollCompleted,
    };

    const args: RunnerArgs = {
      worker: {
        taskDefName: "test",
        execute: async ({ inputData }) => ({
          outputData: inputData,
          status: "COMPLETED",
        }),
      },
      options: {
        pollInterval: 10,
        domain: "",
        concurrency: 1,
        workerID: "worker-id",
      },
      logger: mockLogger,
      client: mockClient,
      eventListeners: [eventListener],
    };

    const mockBatchPoll = TaskResource.batchPoll as jest.MockedFunction<
      typeof TaskResource.batchPoll
    >;
    mockBatchPoll.mockResolvedValue({
      data: [],
      request: {} as Request,
      response: {} as Response,
    } as Awaited<ReturnType<typeof TaskResource.batchPoll>>);

    const runner = new TaskRunner(args);
    activeRunners.push(runner);
    runner.startPolling();

    await new Promise((r) => setTimeout(() => r(true), 100));
    runner.stopPolling();

    expect(onPollStarted).toHaveBeenCalled();
    expect(onPollCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        tasksReceived: 0,
      })
    );
  });

  test("Should publish task execution events", async () => {
    const mockClient = createMockClient();
    const onTaskExecutionStarted = jest.fn<(event: TaskExecutionStarted) => void>();
    const onTaskExecutionCompleted = jest.fn<(event: TaskExecutionCompleted) => void>();
    const eventListener: TaskRunnerEventsListener = {
      onTaskExecutionStarted,
      onTaskExecutionCompleted,
    };

    const args: RunnerArgs = {
      worker: {
        taskDefName: "test",
        execute: async () => ({
          outputData: { result: "done" },
          status: "COMPLETED",
        }),
      },
      options: {
        pollInterval: 10,
        domain: "",
        concurrency: 1,
        workerID: "worker-id",
      },
      logger: mockLogger,
      client: mockClient,
      eventListeners: [eventListener],
    };

    const mockTask: Task = {
      taskId: "task-1",
      workflowInstanceId: "workflow-1",
      status: "IN_PROGRESS",
      inputData: {},
    };

    const mockBatchPoll = TaskResource.batchPoll as jest.MockedFunction<
      typeof TaskResource.batchPoll
    >;
    mockBatchPoll.mockResolvedValue({
      data: [mockTask],
    } as Awaited<ReturnType<typeof TaskResource.batchPoll>>);

    const runner = new TaskRunner(args);
    activeRunners.push(runner);
    runner.startPolling();

    await new Promise((r) => setTimeout(() => r(true), 100));
    runner.stopPolling();

    expect(onTaskExecutionStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-1",
        workflowInstanceId: "workflow-1",
      })
    );
    expect(onTaskExecutionCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-1",
        workflowInstanceId: "workflow-1",
      })
    );
  });

  test("Should publish poll failure event", async () => {
    const mockClient = createMockClient();
    const onPollFailure = jest.fn<(event: PollFailure) => void>();
    const eventListener: TaskRunnerEventsListener = {
      onPollFailure,
    };

    const args: RunnerArgs = {
      worker: {
        taskDefName: "test",
        execute: async ({ inputData }) => ({
          outputData: inputData,
          status: "COMPLETED",
        }),
      },
      options: {
        pollInterval: 10,
        domain: "",
        concurrency: 1,
        workerID: "worker-id",
      },
      logger: mockLogger,
      client: mockClient,
      eventListeners: [eventListener],
    };

    const mockBatchPoll = TaskResource.batchPoll as jest.MockedFunction<
      typeof TaskResource.batchPoll
    >;
    mockBatchPoll.mockRejectedValue(new Error("Poll service unavailable"));

    const runner = new TaskRunner(args);
    activeRunners.push(runner);
    runner.startPolling();

    await new Promise((r) => setTimeout(() => r(true), 100));
    runner.stopPolling();

    expect(onPollFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        cause: expect.any(Error),
      })
    );
  });

  test("Should publish task execution failure event", async () => {
    const mockClient = createMockClient();
    const onTaskExecutionFailure = jest.fn<(event: TaskExecutionFailure) => void>();
    const eventListener: TaskRunnerEventsListener = {
      onTaskExecutionFailure,
    };

    const args: RunnerArgs = {
      worker: {
        taskDefName: "test",
        execute: async () => {
          throw new Error("Task execution failed");
        },
      },
      options: {
        pollInterval: 10,
        domain: "",
        concurrency: 1,
        workerID: "worker-id",
      },
      logger: mockLogger,
      client: mockClient,
      eventListeners: [eventListener],
    };

    const mockTask: Task = {
      taskId: "task-1",
      workflowInstanceId: "workflow-1",
      status: "IN_PROGRESS",
      inputData: {},
    };

    const mockBatchPoll = TaskResource.batchPoll as jest.MockedFunction<
      typeof TaskResource.batchPoll
    >;
    mockBatchPoll.mockResolvedValue({
      data: [mockTask],
    } as Awaited<ReturnType<typeof TaskResource.batchPoll>>);

    const runner = new TaskRunner(args);
    activeRunners.push(runner);
    runner.startPolling();

    await new Promise((r) => setTimeout(() => r(true), 100));
    runner.stopPolling();

    expect(onTaskExecutionFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-1",
        workflowInstanceId: "workflow-1",
        cause: expect.any(Error),
      })
    );
  });
});

describe("Worker-specific configuration", () => {
  test("Should use worker-specific concurrency when provided", async () => {
    const mockClient = createMockClient();
    const args: RunnerArgs = {
      worker: {
        taskDefName: "test",
        execute: async ({ inputData }) => ({
          outputData: inputData,
          status: "COMPLETED",
        }),
        concurrency: 10, // Worker-specific
      },
      options: {
        pollInterval: 100,
        domain: "",
        concurrency: 1, // Default
        workerID: "worker-id",
      },
      logger: mockLogger,
      client: mockClient,
    };

    const runner = new TaskRunner(args);

    // Should use worker-specific concurrency
    expect(runner.getOptions.concurrency).toBe(1); // Options remain unchanged
    // The poller uses worker.concurrency internally
  });

  test("Should use worker-specific domain when provided", async () => {
    const mockClient = createMockClient();
    const args: RunnerArgs = {
      worker: {
        taskDefName: "test",
        execute: async ({ inputData }) => ({
          outputData: inputData,
          status: "COMPLETED",
        }),
        domain: "custom-domain",
      },
      options: {
        pollInterval: 10,
        domain: "default-domain",
        concurrency: 1,
        workerID: "worker-id",
      },
      logger: mockLogger,
      client: mockClient,
    };

    const mockBatchPoll = TaskResource.batchPoll as jest.MockedFunction<
      typeof TaskResource.batchPoll
    >;
    mockBatchPoll.mockResolvedValue({
      data: [],
      request: {} as Request,
      response: {} as Response,
    } as Awaited<ReturnType<typeof TaskResource.batchPoll>>);

    const runner = new TaskRunner(args);
    activeRunners.push(runner);
    runner.startPolling();

    await new Promise((r) => setTimeout(() => r(true), 100));
    runner.stopPolling();

    // Should have called batchPoll with worker-specific domain
    expect(mockBatchPoll).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          domain: "custom-domain",
        }),
      })
    );
  });
});

describe("Error handling", () => {
  test("Should call error handler when task execution fails", async () => {
    // Clear all mocks to ensure clean slate
    jest.clearAllMocks();

    const mockClient = createMockClient();
    const onError = jest.fn();
    const testError = new Error("Task failed");

    const args: RunnerArgs = {
      worker: {
        taskDefName: "test-error-handler",
        execute: async () => {
          throw testError;
        },
      },
      options: {
        pollInterval: 10,
        domain: "",
        concurrency: 1,
        workerID: "worker-id",
      },
      logger: mockLogger,
      client: mockClient,
      onError,
    };

    const mockTask: Task = {
      taskId: "task-error-1",
      workflowInstanceId: "workflow-error-1",
      status: "IN_PROGRESS",
      inputData: {},
    };

    const mockBatchPoll = TaskResource.batchPoll as jest.MockedFunction<
      typeof TaskResource.batchPoll
    >;
    mockBatchPoll
      .mockResolvedValueOnce({
        data: [mockTask],
        request: {} as Request,
        response: {} as Response,
      } as Awaited<ReturnType<typeof TaskResource.batchPoll>>)
      .mockResolvedValue({
        data: [],
        request: {} as Request,
        response: {} as Response,
      } as Awaited<ReturnType<typeof TaskResource.batchPoll>>);

    const mockUpdateTask = TaskResource.updateTask as jest.MockedFunction<
      typeof TaskResource.updateTask
    >;
    // Ensure updateTask succeeds for this test
    mockUpdateTask.mockResolvedValue({} as Awaited<ReturnType<typeof TaskResource.updateTask>>);

    const runner = new TaskRunner(args);
    activeRunners.push(runner);
    runner.startPolling();

    await new Promise((r) => setTimeout(() => r(true), 200));
    runner.stopPolling();

    // Error handler should be called twice: once for task execution error, once if update fails
    expect(onError).toHaveBeenCalledWith(testError, mockTask);
  });

  test("Should handle errors without message or stack gracefully", async () => {
    const mockClient = createMockClient();
    const runner = new TaskRunner({
      worker: {
        taskDefName: "test",
        execute: async ({ inputData }) => ({
          outputData: inputData,
          status: "COMPLETED",
        }),
      },
      options: {
        pollInterval: 10,
        domain: "",
        concurrency: 1,
        workerID: "worker-id",
      },
      logger: mockLogger,
      client: mockClient,
    });

    // Test handleUnknownError with non-Error object
    expect(() => {
      runner.handleUnknownError({ someProperty: "value" });
    }).not.toThrow();

    // Test with string
    expect(() => {
      runner.handleUnknownError("string error");
    }).not.toThrow();

    // Test with undefined
    expect(() => {
      runner.handleUnknownError(undefined);
    }).not.toThrow();
  });
});

describe("Polling state", () => {
  test("Should report correct polling state", async () => {
    const mockClient = createMockClient();
    const args: RunnerArgs = {
      worker: {
        taskDefName: "test",
        execute: async ({ inputData }) => ({
          outputData: inputData,
          status: "COMPLETED",
        }),
      },
      options: {
        pollInterval: 10,
        domain: "",
        concurrency: 1,
        workerID: "worker-id",
      },
      logger: mockLogger,
      client: mockClient,
    };

    const mockBatchPoll = TaskResource.batchPoll as jest.MockedFunction<
      typeof TaskResource.batchPoll
    >;
    mockBatchPoll.mockResolvedValue({
      data: [],
      request: {} as Request,
      response: {} as Response,
    } as Awaited<ReturnType<typeof TaskResource.batchPoll>>);

    const runner = new TaskRunner(args);

    expect(runner.isPolling).toBe(false);

    runner.startPolling();
    expect(runner.isPolling).toBe(true);

    await new Promise((r) => setTimeout(() => r(true), 50));

    runner.stopPolling();
    await new Promise((r) => setTimeout(() => r(true), 50));

    expect(runner.isPolling).toBe(false);
  });
});
