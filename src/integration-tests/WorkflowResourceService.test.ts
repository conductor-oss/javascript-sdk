import { expect, describe, test, jest, afterEach } from "@jest/globals";
import { MetadataClient } from "../sdk";
import { simpleTask, workflow } from "../sdk/builders";
import { orkesConductorClient } from "../sdk/createConductorClient";
import type { TaskDefTypes } from "../open-api";
import { WorkflowResource } from "../open-api/generated";

describe("WorkflowResourceService", () => {
  jest.setTimeout(120000);
  const workflowsToCleanup: { name: string; version: number }[] = [];

  afterEach(async () => {
    const client = await orkesConductorClient();
    const metadataClient = new MetadataClient(client);
    await Promise.allSettled(
      workflowsToCleanup.map((w) =>
        metadataClient.unregisterWorkflow(w.name, w.version)
      )
    );
    workflowsToCleanup.length = 0;
  });

  test("Should test a workflow", async () => {
    const client = await orkesConductorClient();
    const metadataClient = new MetadataClient(client);
    const tasks: TaskDefTypes[] = [
      simpleTask("simple_ref", "le_simple_task", {}),
    ];

    const wfDef = workflow(`jsSdkTest-test_wf-${Date.now()}`, tasks);
    wfDef.outputParameters = { message: "${simple_ref.output.message}" };
    await metadataClient.registerWorkflowDef(wfDef, true);
    workflowsToCleanup.push({
      name: wfDef.name,
      version: wfDef.version ?? 1,
    });

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
