import { expect, describe, test, jest } from "@jest/globals";
import { orkesConductorClient } from "../../src/orkes";
import { WorkflowExecutor, simpleTask, generate } from "../../src/core";
import { TaskType } from "../../src/common";
import { TaskRunner } from "../../src/task";
import { waitForWorkflowStatus } from "../utils/waitForWorkflowStatus";

describe("TaskManager", () => {
  const clientPromise = orkesConductorClient();

  jest.setTimeout(30000);
  test("worker example ", async () => {
    const client = await clientPromise;
    const executor = new WorkflowExecutor(client);
    const workflowName = `jsSdkTest-my_first_js_wf-${Date.now()}`;
    const taskName = `jsSdkTest-taskmanager-test-${Date.now()}`;

    const taskRunner = new TaskRunner({
      taskResource: client.taskResource,
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
        pollInterval: 10,
        domain: undefined,
        concurrency: 1,
        workerID: "",
      },
    });
    taskRunner.startPolling();

    
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

    const workflowStatus = await waitForWorkflowStatus(executor, executionId, "COMPLETED");

    const [firstTask] = workflowStatus.tasks || [];
    expect(firstTask?.taskType).toEqual(taskName);
    expect(workflowStatus.status).toEqual("COMPLETED");

    taskRunner.stopPolling();
    const taskDetails = await executor.getTask(firstTask?.taskId || "");
    expect(taskDetails.status).toEqual("COMPLETED");
  });

  test("update task example ", async () => {
    const client = await clientPromise;
    const executor = new WorkflowExecutor(client);
    const waitTaskReference = `jsSdkTest-wait_task_ref-${Date.now()}`;
    const workflowWithWaitTask = generate({
      name: `jsSdkTest-waitTaskWf-${Date.now()}`,
      tasks: [{ type: TaskType.WAIT, taskReferenceName: waitTaskReference }],
    });
    await executor.registerWorkflow(true, workflowWithWaitTask);

    const { workflowId: executionId } = await executor.executeWorkflow(
      {
        name: workflowWithWaitTask.name,
        input: {},
        version: 1,
      },
      workflowWithWaitTask.name,
      1,
      `${workflowWithWaitTask.name}-id`
    );
    const workflowStatus = await executor.getWorkflow(executionId!, true);

    const [firstTask] = workflowStatus.tasks || [];
    expect(firstTask?.referenceTaskName).toEqual(waitTaskReference);
    const changedValue = { greet: "changed value" };
    await executor.updateTaskByRefName(
      firstTask!.referenceTaskName!,
      executionId!,
      "IN_PROGRESS",
      changedValue
    );

    const taskDetails = await executor.getTask(firstTask?.taskId || "");
    expect(taskDetails.outputData).toEqual(changedValue);
    const newChange = { greet: "bye" };

    await executor.updateTask(
      firstTask!.taskId!,
      executionId!,
      "COMPLETED",
      newChange
    );

    const taskAfterUpdate = await executor.getTask(firstTask?.taskId || "");
    expect(taskAfterUpdate.outputData).toEqual(newChange);
  });

  test("Should create and run a workflow that sums two numbers", async () => {
    const client = await clientPromise;

    //Create new workflow executor
    const executor = new WorkflowExecutor(client);
    const taskName = `jsSdkTest-sum_two_numbers-task-${Date.now()}`;
    const workflowName = `jsSdkTest-sumTwoNumbersWf-${Date.now()}`;

    // Create a workflow
    const sumTwoNumbers = generate({
      name: workflowName,
      tasks: [
        {
          name: taskName,
          inputParameters: {
            numberOne: "${workflow.input.numberOne}",
            numberTwo: "${workflow.input.numberTwo}",
            expression: function ($: { numberOne: number; numberTwo: number }) {
              // The returned function will be executed by conductors. INLINE task
              return function () {
                return $.numberOne + $.numberTwo;
              };
            },
          },
          type: TaskType.INLINE,
        },
      ],
      inputParameters: ["numberOne", "numberTwo"],
      outputParameters: {
        result: `\${${taskName}_ref.output.result}`,
      },
    });

    await executor.registerWorkflow(true, sumTwoNumbers);

    const { workflowId: executionId } = await executor.executeWorkflow(
      {
        name: sumTwoNumbers.name,
        version: 1,

        input: {
          numberOne: 1,
          numberTwo: 2,
        },
      },
      sumTwoNumbers.name,
      1,
      `workflow${sumTwoNumbers.name}`
    );

    const workflowStatus = await waitForWorkflowStatus(executor, executionId!, "COMPLETED");

    expect(workflowStatus.status).toEqual("COMPLETED");
    expect(workflowStatus.output?.result).toEqual(3);
  });
});
