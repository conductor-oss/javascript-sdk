import { expect, describe, test, jest } from "@jest/globals";
import { SetVariableTaskDef, TaskType, WorkflowDef } from "../../src/common";
import { orkesConductorClient } from "../../src/orkes";
import { WorkflowExecutor } from "../../src/core/executor";
import { v4 as uuidv4 } from "uuid";
import { waitForWorkflowStatus } from "../utils/waitForWorkflowStatus";
import { httpTask } from "../../src/core/sdk";
import { TaskClient } from "../../src/core/taskClient";

describe("Executor", () => {
  const clientPromise = orkesConductorClient();

  jest.setTimeout(15000);
  const name = `jsSdkTest-Workflow-${Date.now()}`;
  const version = 1;
  test("Should be able to register a workflow", async () => {
    const client = await clientPromise;
    const executor = new WorkflowExecutor(client);

    const workflowDefinition: WorkflowDef = {
      name,
      version,
      tasks: [
        {
          type: TaskType.SET_VARIABLE,
          name: "setVariable",
          taskReferenceName: "httpTaskRef",
          inputParameters: {
            hello: "world",
          },
        },
      ],
      inputParameters: [],
      timeoutSeconds: 15,
    };

    await expect(
      executor.registerWorkflow(true, workflowDefinition)
    ).resolves.not.toThrow();
    const workflowDefinitionFromApi = await client.metadataResource.get(
      name,
      version
    );
    expect(workflowDefinitionFromApi.name).toEqual(name);
    expect(workflowDefinitionFromApi.version).toEqual(version);
    expect(workflowDefinitionFromApi.tasks[0].name).toEqual(
      workflowDefinition.tasks[0].name
    );
    expect(workflowDefinitionFromApi.tasks[0].taskReferenceName).toEqual(
      workflowDefinition.tasks[0].taskReferenceName
    );
    expect(workflowDefinitionFromApi.tasks[0].inputParameters).toEqual(
      (workflowDefinition.tasks[0] as SetVariableTaskDef).inputParameters
    );
  });

  let executionId: string | undefined = undefined;
  test("Should be able to start a workflow", async () => {
    const client = await clientPromise;
    const executor = new WorkflowExecutor(client);
    executionId = await executor.startWorkflow({ name, version });
    expect(executionId).toBeTruthy();
  });

  test("Should be able to execute workflow synchronously", async () => {
    const client = await clientPromise;
    const executor = new WorkflowExecutor(client);
    const workflowRun = await executor.executeWorkflow(
      {
        name: name,
        version: version,
      },
      name,
      version,
      uuidv4()
    );
    expect(workflowRun.status).toEqual("COMPLETED");
  });

  test("Should be able to get workflow execution status ", async () => {
    const client = await clientPromise;
    const executor = new WorkflowExecutor(client);
    expect(executionId).toBeDefined();
    if (!executionId) {
      throw new Error("Execution ID is undefined");
    }
    const workflowStatus = await executor.getWorkflowStatus(
      executionId,
      true,
      true
    );
    expect(workflowStatus.status).toBeTruthy();
  });

  test("Should return workflow status detail", async () => {
    const client = await clientPromise;
    const executor = new WorkflowExecutor(client);
    const workflowStatus = await executor.getWorkflow(executionId!, true);

    expect(workflowStatus.status).toBeTruthy();
    expect(workflowStatus.tasks?.length).toBe(1);
  });
  test("Should execute a workflow with indempotency key", async () => {
    const client = await clientPromise;
    const executor = new WorkflowExecutor(client);
    const idempotencyKey = uuidv4();
    const executionId = await executor.startWorkflow({
      name: name,
      version: version,
      idempotencyKey,
      idempotencyStrategy: "RETURN_EXISTING",
    });

    const executionDetails = await executor.getWorkflow(executionId!, true);
    expect(executionDetails.idempotencyKey).toEqual(idempotencyKey);
  });

  test("Should run workflow with http task with asyncComplete true", async () => {
    const client = await clientPromise;
    const executor = new WorkflowExecutor(client);
    const workflowName = `jsSdkTest-wf_with_asyncComplete_http_task-${Date.now()}`;
    const taskName = `jsSdkTest-http_task_with_asyncComplete_true-${Date.now()}`;

    await executor.registerWorkflow(true, {
      name: workflowName,
      version: 1,
      ownerEmail: "developers@orkes.io",
      tasks: [
        httpTask(
          taskName,
          { uri: "http://www.yahoo.com", method: "GET" },
          true
        ),
      ],
      inputParameters: [],
      outputParameters: {},
      timeoutSeconds: 300,
    });

    const executionId = await executor.startWorkflow({
      name: workflowName,
      input: {},
      version: 1,
    });

    const workflowStatusBefore = await waitForWorkflowStatus(
      executor,
      executionId,
      "RUNNING"
    );

    expect(["IN_PROGRESS", "SCHEDULED"]).toContain(
      workflowStatusBefore.tasks?.[0]?.status
    );

    const taskClient = new TaskClient(client);
    taskClient.updateTaskResult(executionId, taskName, "COMPLETED", {
      hello: "From manuall api call updating task result",
    });

    const workflowStatusAfter = await waitForWorkflowStatus(
      executor,
      executionId,
      "COMPLETED"
    );

    expect(workflowStatusAfter.tasks?.[0]?.status).toEqual("COMPLETED");
  });

  test("Should run workflow with an optional http task", async () => {
    const executor = new WorkflowExecutor(await clientPromise);
    const workflowName = `jsSdkTest-wf_with_optional_http_task-${Date.now()}`;
    const taskName = `jsSdkTest-optional_http_task-${Date.now()}`;

    await executor.registerWorkflow(true, {
      name: workflowName,
      version: 1,
      ownerEmail: "developers@orkes.io",
      tasks: [
        httpTask(
          taskName,
          { uri: "uncorrect_uri", method: "GET" },
          false,
          true
        ),
      ],
      inputParameters: [],
      outputParameters: {},
      timeoutSeconds: 300,
    });

    const executionId = await executor.startWorkflow({
      name: workflowName,
      input: {},
      version: 1,
    });

    const workflowStatus = await waitForWorkflowStatus(
      executor,
      executionId,
      "COMPLETED"
    );
    expect(["FAILED", "COMPLETED_WITH_ERRORS"]).toContain(
      workflowStatus.tasks?.[0]?.status
    );
  });
});
