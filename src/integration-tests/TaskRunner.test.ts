import { expect, describe, test, jest } from "@jest/globals";
import {
  TaskRunner,
  WorkflowExecutor,
  simpleTask,
  orkesConductorClient,
} from "../sdk";
import { waitForWorkflowStatus } from "./utils/waitForWorkflowStatus";

describe("TaskRunner", () => {
  const clientPromise = orkesConductorClient();

  jest.setTimeout(30000);
  test("worker example ", async () => {
    const client = await clientPromise;
    const executor = new WorkflowExecutor(client);
    const taskName = `jsSdkTest-task-manager-int-test-${Date.now()}`;
    const workflowName = `jsSdkTest-task-manager-int-test-wf-${Date.now()}`;

    const taskRunner = new TaskRunner({
      client: client,
      worker: {
        taskDefName: taskName,
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

    await executor.registerWorkflow(true, {
      name: workflowName,
      version: 1,
      ownerEmail: "developers@orkes.io",
      tasks: [simpleTask(taskName, taskName, {})],
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
      `${workflowName}-id`
    );
    expect(executionId).toBeDefined();

    taskRunner.updateOptions({ concurrency: 1, pollInterval: 100 });

    expect(executionId).toBeDefined();
    if (!executionId) {
      throw new Error("Execution ID is undefined");
    }

    const workflowStatus = await waitForWorkflowStatus(
      executor,
      executionId,
      "COMPLETED"
    );

    const [firstTask] = workflowStatus.tasks || [];
    expect(firstTask?.taskType).toEqual(taskName);
    expect(workflowStatus.status).toEqual("COMPLETED");

    await taskRunner.stopPolling();

    expect(taskRunner.isPolling).toEqual(false);
    const taskDetails = await executor.getTask(firstTask?.taskId || "");
    expect(taskDetails?.status).toEqual("COMPLETED");
  });
});
