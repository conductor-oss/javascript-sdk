import { expect, describe, test, jest } from "@jest/globals";
import { MetadataClient } from "../../src/core";
import { simpleTask, workflow } from "../../src/core/sdk";
import { orkesConductorClient } from "../../src/orkes";
import { TaskDefTypes } from "../../src/common/types";

describe("WorkflowResourceService", () => {
  jest.setTimeout(120000);

  test("Should test a workflow", async () => {
    const client = await orkesConductorClient();
    const metadataClient = new MetadataClient(client);
    const tasks: TaskDefTypes[] = [
      simpleTask("simple_ref", "le_simple_task", {}),
    ];

    const wfDef = workflow("unit_test_wf", tasks);
    wfDef.outputParameters = { message: "${simple_ref.output.message}" };
    metadataClient.registerWorkflowDef(wfDef, true);

    const status = "COMPLETED";
    const output = { message: "Mocked message" };

    const wf = await client.workflowResource.testWorkflow({
      name: wfDef.name,
      taskRefToMockOutput: {
        simple_ref: [{ status, output }],
      },
    });

    expect(wf.status).toEqual(status);
    expect(wf.output).toEqual(output);
  });
});
