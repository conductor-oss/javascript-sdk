import { expect, describe, test, jest } from "@jest/globals";
import { MetadataClient } from "../../src/core";
import { simpleTask, workflow } from "../../src/core/sdk";
import { orkesConductorClient } from "../../src/orkes";
import { TaskDefTypes } from "../../src/common/types";
import { WorkflowResource } from "../../src/common/open-api/sdk.gen";

describe("WorkflowResourceService", () => {
  jest.setTimeout(120000);

  test("Should test a workflow", async () => {
    const client = await orkesConductorClient();
    const metadataClient = new MetadataClient(client);
    const tasks: TaskDefTypes[] = [
      simpleTask("simple_ref", "le_simple_task", {}),
    ];

    const wfDef = workflow(`jsSdkTest-test_wf-${Date.now()}`, tasks);
    wfDef.outputParameters = { message: "${simple_ref.output.message}" };
    await metadataClient.registerWorkflowDef(wfDef, true);

    const status = "COMPLETED";
    const output = { message: "Mocked message" };

    const { data: wf } = await WorkflowResource.testWorkflow({
      client: client,
      body: {
        name: wfDef.name,
        taskRefToMockOutput: {
          simple_ref: [{ status, output }],
        },
      },
    });

    if (!wf) {
      throw new Error("Workflow not found");
    }

    expect(wf.status).toEqual(status);
    expect(wf.output).toEqual(output);
  });
});
