import { expect, describe, test, jest } from "@jest/globals";
import { orkesConductorClient } from "../orkes";
import { WorkflowExecutor, simpleTask, generate } from "../core";
import { TaskType } from "../common";
import { TaskRunner } from "../task";

describe("TaskManager", () => {
  const clientPromise = orkesConductorClient();

  jest.setTimeout(20000);
  test("worker example ", async () => {
    const client = await clientPromise;
    const executor = new WorkflowExecutor(client);

    const taskRunner = new TaskRunner({
      taskResource: client.taskResource,
      worker: {
        taskDefName: "taskmanager-test",
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
      name: "my_first_js_wf",
      version: 1,
      ownerEmail: "developers@orkes.io",
      tasks: [simpleTask("taskmanager-test", "taskmanager-test", {})],
      inputParameters: [],
      outputParameters: {},
      timeoutSeconds: 0,
    });

    const executionId = await executor.startWorkflow({
      name: "my_first_js_wf",
      input: {},
      version: 1,
    });
    await new Promise((r) => setTimeout(() => r(true), 900));
    const workflowStatus = await executor.getWorkflow(executionId, true);

    const [firstTask] = workflowStatus.tasks || [];
    expect(firstTask?.taskType).toEqual("taskmanager-test");
    expect(workflowStatus.status).toEqual("COMPLETED");

    taskRunner.stopPolling();
    const taskDetails = await executor.getTask(firstTask?.taskId || "");
    expect(taskDetails.status).toEqual("COMPLETED");
  });

  test("update task example ", async () => {
    const client = await clientPromise;
    const executor = new WorkflowExecutor(client);
    const waitTaskReference = "wait_task_ref";
    const workflowWithWaitTask = generate({
      name: "waitTaskWf",
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
      "someId"
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

    // Create a workflow
    const sumTwoNumbers = generate({
      name: "sumTwoNumbers",
      tasks: [
        {
          name: "sum_two_numbers",
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
        result: "${sum_two_numbers_ref.output.result}",
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
      "workflowSummTwoNumbers"
    );

    const workflowStatus = await executor.getWorkflow(executionId!, true);

    expect(workflowStatus.status).toEqual("COMPLETED");
    expect(workflowStatus.output?.result).toEqual(3);
  });
});
