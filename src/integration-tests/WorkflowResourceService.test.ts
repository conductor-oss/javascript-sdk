import { expect, describe, test, jest } from "@jest/globals";
import { MetadataClient } from "../sdk";
import { simpleTask, workflow } from "../sdk/builders";
import { orkesConductorClient } from "../sdk/createConductorClient";
import type { TaskDefTypes } from "../open-api";
import { WorkflowResource } from "../open-api/generated";

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
