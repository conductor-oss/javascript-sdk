import { jest, test, expect } from "@jest/globals";
import { TaskRunner } from "../TaskRunner";
import { RunnerArgs } from "../types";
import { mockLogger } from "../../../integration-tests/utils/mockLogger";
import { TaskResource } from "../../common/open-api";
import { TaskResultStatusEnum } from "../../common";
import { Client } from "../../common/open-api/client/types.gen";
import { Task } from "../../common/open-api";

jest.mock("../../common/open-api", () => ({
  TaskResource: {
    batchPoll: jest.fn(),
    updateTask: jest.fn(),
  },
}));

test("polls tasks", async () => {
  const mockClient = {} as Client;
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
  runner.startPolling();
  await new Promise((r) => setTimeout(() => r(true), 10));
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
  const mockClient = {} as Client;
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
  runner.startPolling();
  await new Promise((r) => setTimeout(() => r(true), 10));
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
