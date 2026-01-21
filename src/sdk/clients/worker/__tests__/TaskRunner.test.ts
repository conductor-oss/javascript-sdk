import { afterEach, expect, jest, test } from "@jest/globals";
import { mockLogger } from "../../../../integration-tests/utils/mockLogger";
import type { Task } from "../../../../open-api";
import { TaskResultStatusEnum } from "../../../../open-api";
import { TaskResource } from "../../../../open-api/generated";
import type { Client } from "../../../../open-api/generated/client/types.gen";
import { TaskRunner } from "../TaskRunner";
import { RunnerArgs } from "../types";

jest.mock("../../../../open-api/generated", () => ({
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
