import { jest, test, expect } from "@jest/globals";
import type { Mocked } from "jest-mock";

import { TaskRunner } from "../TaskRunner";
import { RunnerArgs } from "../types";
import { mockLogger } from "./mockLogger";
import { TaskResourceService } from "../../common/open-api";

test("polls tasks", async () => {
  const taskClientStub: Mocked<
    Pick<TaskResourceService, "batchPoll" | "updateTask">
  > = {
    batchPoll: jest.fn(),
    updateTask: jest.fn(),
  };
  const mockTaskClient = taskClientStub as unknown as TaskResourceService;
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
    taskResource: mockTaskClient,
  };
  const workflowInstanceId = "fake-workflow-id";
  const taskId = "fake-task-id";
  taskClientStub.batchPoll.mockResolvedValue([
    {
      taskId,
      workflowInstanceId,
      status: "IN_PROGRESS",
      reasonForIncompletion: undefined,
      inputData: {
        input: "from workflow",
      },
    },
  ]);

  const runner = new TaskRunner(args);
  runner.startPolling();
  await new Promise((r) => setTimeout(() => r(true), 10));
  runner.stopPolling();
  const expected = {
    taskId,
    workflowInstanceId,
    status: "COMPLETED",
    workerId: workerID,
    outputData: {
      hello: "from worker",
      input: "from workflow",
    },
  };
  expect(taskClientStub.updateTask).toHaveBeenCalledWith(expected);
});

test("Should set the task as failed if the task has an error", async () => {
  const taskClientStub: Mocked<
    Pick<TaskResourceService, "batchPoll" | "updateTask">
  > = {
    batchPoll: jest.fn(),
    updateTask: jest.fn(),
  };
  const mockTaskClient = taskClientStub as unknown as TaskResourceService;

  const workerID = "worker-id";
  const args: RunnerArgs = {
    worker: {
      taskDefName: "test",
      execute: async () => {
        throw new Error("Error from worker");
      },
    },
    options: {
      pollInterval: 10,
      domain: "",
      concurrency: 1,
      workerID,
    },
    logger: mockLogger,
    taskResource: mockTaskClient,
  };
  const workflowInstanceId = "fake-workflow-id";
  const taskId = "fake-task-id";
  taskClientStub.batchPoll.mockResolvedValue([
    {
      taskId,
      workflowInstanceId,
      status: "IN_PROGRESS",
      reasonForIncompletion: undefined,
      inputData: {
        input: "from workflow",
      },
    },
  ]);

  const runner = new TaskRunner(args);
  runner.startPolling();
  await new Promise((r) => setTimeout(() => r(true), 10));
  runner.stopPolling();
  const expected = {
    taskId,
    workflowInstanceId,
    workerId: workerID,
    status: "FAILED",
    outputData: {},
    reasonForIncompletion: "Error from worker",
  };
  expect(taskClientStub.updateTask).toHaveBeenCalledWith(expected);
});
