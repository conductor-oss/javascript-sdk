import { expect, describe, test, jest } from "@jest/globals";
import { TaskRunner } from "../../src/task/TaskRunner";
import { WorkflowExecutor, simpleTask } from "../../src/core";
import { orkesConductorClient } from "../../src/orkes";
import { TestUtil } from "../utils/test-util";

describe("TaskManager", () => {
  const clientPromise = orkesConductorClient();

  jest.setTimeout(15000);
  test("worker example ", async () => {
    const client = await clientPromise;
    const executor = new WorkflowExecutor(client);

    const taskRunner = new TaskRunner({
      taskResource: client.taskResource,
      worker: {
        taskDefName: "task-manager-int-test",
        execute: async () => {
          return {
            outputData: {
              hello: "From your worker",
            },
            status: "COMPLETED",
          };
        },
      },
      options: {
        pollInterval: 1000,
        domain: undefined,
        concurrency: 2,
        workerID: "",
      },
    });
    taskRunner.startPolling();

    expect(taskRunner.isPolling).toEqual(true);
    const workflowName = "task-manager-int-test-wf";
    await executor.registerWorkflow(true, {
      name: workflowName,
      version: 1,
      ownerEmail: "developers@orkes.io",
      tasks: [simpleTask("task-manager-int-test", "task-manager-int-test", {})],
      inputParameters: [],
      outputParameters: {},
      timeoutSeconds: 0,
    });

    const { workflowId: executionId } = await executor.executeWorkflow(
      {
        name: workflowName,
        version: 1,
      },
      workflowName,
      1,
      "RunnerIdentifier"
    );
    expect(executionId).toBeDefined();

    taskRunner.updateOptions({ concurrency: 1, pollInterval: 100 });

    const workflowStatus = await TestUtil.waitForWorkflowStatus(executor, executionId!, "COMPLETED");

    const [firstTask] = workflowStatus.tasks || [];
    expect(firstTask?.taskType).toEqual("task-manager-int-test");
    expect(workflowStatus.status).toEqual("COMPLETED");

    await taskRunner.stopPolling();

    expect(taskRunner.isPolling).toEqual(false);
    const taskDetails = await executor.getTask(firstTask?.taskId || "");
    expect(taskDetails.status).toEqual("COMPLETED");
  });
});
