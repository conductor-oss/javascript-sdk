import { expect, describe, test, jest } from "@jest/globals";
import { MetadataClient } from "../metadataClient";
import { taskDefinition } from "../sdk";
import { orkesConductorClient } from "../../orkes";

describe("MetadataClient", () => {
  const clientPromise = orkesConductorClient();

  jest.setTimeout(15000);
  test("Should register a task definition", async () => {
    const client = await clientPromise;
    const metadataClient = new MetadataClient(client);

    const newTaskDefinition = taskDefinition({
      name: "test_task_definition",
      description: "New Task Definition",
      retryCount: 4,
      timeoutSeconds: 7200,
      inputKeys: ["inputKey1", "inputKey2"],
      outputKeys: ["outputKey1", "outputKey2"],
      timeoutPolicy: "TIME_OUT_WF",
      retryLogic: "FIXED",
      retryDelaySeconds: 61,
      responseTimeoutSeconds: 601,
      concurrentExecLimit: 1,
      inputTemplate: {
        "inputKey1": "${workflow.input.inputKey1}",
      },
      rateLimitPerFrequency: 1,
      rateLimitFrequencyInSeconds: 2,
      pollTimeoutSeconds: 3601,
      backoffScaleFactor: 1,
    });

    await expect(
      metadataClient.registerTask(newTaskDefinition)
    ).resolves.not.toThrow();
    const taskDefinitionFromApi = await client.metadataResource.getTaskDef(
      newTaskDefinition.name
    );

    expect(taskDefinitionFromApi.name).toEqual(newTaskDefinition.name);
    expect(taskDefinitionFromApi.description).toEqual(newTaskDefinition.description);
    expect(taskDefinitionFromApi.retryCount).toEqual(newTaskDefinition.retryCount);
    expect(taskDefinitionFromApi.timeoutSeconds).toEqual(newTaskDefinition.timeoutSeconds);
    expect(taskDefinitionFromApi.inputKeys).toEqual(newTaskDefinition.inputKeys);
    expect(taskDefinitionFromApi.outputKeys).toEqual(newTaskDefinition.outputKeys);
    expect(taskDefinitionFromApi.timeoutPolicy).toEqual(newTaskDefinition.timeoutPolicy);
    expect(taskDefinitionFromApi.retryLogic).toEqual(newTaskDefinition.retryLogic);
    expect(taskDefinitionFromApi.retryDelaySeconds).toEqual(newTaskDefinition.retryDelaySeconds);
    expect(taskDefinitionFromApi.responseTimeoutSeconds).toEqual(newTaskDefinition.responseTimeoutSeconds);
    expect(taskDefinitionFromApi.concurrentExecLimit).toEqual(newTaskDefinition.concurrentExecLimit);
    expect(taskDefinitionFromApi.inputTemplate).toEqual(newTaskDefinition.inputTemplate);
    expect(taskDefinitionFromApi.rateLimitPerFrequency).toEqual(newTaskDefinition.rateLimitPerFrequency);
    expect(taskDefinitionFromApi.rateLimitFrequencyInSeconds).toEqual(newTaskDefinition.rateLimitFrequencyInSeconds);
    expect(taskDefinitionFromApi.pollTimeoutSeconds).toEqual(newTaskDefinition.pollTimeoutSeconds);
    expect(taskDefinitionFromApi.backoffScaleFactor).toEqual(newTaskDefinition.backoffScaleFactor);
  });

  test("Should update a task definition", async () => {
    const client = await clientPromise;
    const metadataClient = new MetadataClient(client);

    const newTaskDefinition = taskDefinition({
      name: "test_task_definition",
      description: "New Task Definition Update",
      retryCount: 5,
      timeoutSeconds: 7201,
      inputKeys: ["inputKey1_1", "inputKey2_1"],
      outputKeys: ["outputKey1_1", "outputKey2_2"],
      timeoutPolicy: "TIME_OUT_WF",
      retryLogic: "FIXED",
      retryDelaySeconds: 62,
      responseTimeoutSeconds: 602,
      concurrentExecLimit: 1,
      inputTemplate: {
        "inputKey2": "${workflow.input.inputKey2}",
      },
      rateLimitPerFrequency: 1,
      rateLimitFrequencyInSeconds: 3,
      pollTimeoutSeconds: 3602,
      backoffScaleFactor: 1,
    });

    await expect(
      metadataClient.updateTask(newTaskDefinition)
    ).resolves.not.toThrow();
    const taskDefinitionFromApi = await client.metadataResource.getTaskDef(
      newTaskDefinition.name
    );

    expect(taskDefinitionFromApi.description).toEqual(newTaskDefinition.description);
    expect(taskDefinitionFromApi.retryCount).toEqual(newTaskDefinition.retryCount);
    expect(taskDefinitionFromApi.timeoutSeconds).toEqual(newTaskDefinition.timeoutSeconds);
    expect(taskDefinitionFromApi.inputKeys).toEqual(newTaskDefinition.inputKeys);
    expect(taskDefinitionFromApi.outputKeys).toEqual(newTaskDefinition.outputKeys);
    expect(taskDefinitionFromApi.timeoutPolicy).toEqual(newTaskDefinition.timeoutPolicy);
    expect(taskDefinitionFromApi.retryLogic).toEqual(newTaskDefinition.retryLogic);
    expect(taskDefinitionFromApi.retryDelaySeconds).toEqual(newTaskDefinition.retryDelaySeconds);
    expect(taskDefinitionFromApi.responseTimeoutSeconds).toEqual(newTaskDefinition.responseTimeoutSeconds);
    expect(taskDefinitionFromApi.concurrentExecLimit).toEqual(newTaskDefinition.concurrentExecLimit);
    expect(taskDefinitionFromApi.inputTemplate).toEqual(newTaskDefinition.inputTemplate);
    expect(taskDefinitionFromApi.rateLimitPerFrequency).toEqual(newTaskDefinition.rateLimitPerFrequency);
    expect(taskDefinitionFromApi.rateLimitFrequencyInSeconds).toEqual(newTaskDefinition.rateLimitFrequencyInSeconds);
    expect(taskDefinitionFromApi.pollTimeoutSeconds).toEqual(newTaskDefinition.pollTimeoutSeconds);
    expect(taskDefinitionFromApi.backoffScaleFactor).toEqual(newTaskDefinition.backoffScaleFactor);

  });

  test("Should unregister a task definition", async () => {
    const client = await clientPromise;
    const metadataClient = new MetadataClient(client);
    const name ="test_task_definition";

    await expect(
      metadataClient.unregisterTask("test_task_definition")
    ).resolves.not.toThrow();

    await expect(client.metadataResource.getTaskDef(
      name
    )).rejects.toThrow();
  })
});
