import { Workflow } from "../../src/common";
import { WorkflowExecutor } from "../../src/core";

/**
 * Wait for workflow to reach expected status
 */
export const waitForWorkflowStatus = async (
  workflowClient: WorkflowExecutor,
  workflowId: string,
  expectedStatus: string,
  maxWaitTimeMs = 60000,
  pollIntervalMs = 3000
): Promise<Workflow> => {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTimeMs) {
    try {
      const workflow = await workflowClient.getWorkflow(workflowId, true);

      if (workflow?.status === expectedStatus) {
        return workflow;
      }

      if (workflow?.status === "FAILED" || workflow?.status === "TERMINATED") {
        throw new Error(
          `Workflow ended in unexpected state: ${workflow?.status}`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    } catch (error) {
      throw new Error(`Failed to get workflow status: ${error}`);
    }
  }

  throw new Error(
    `Workflow did not reach status ${expectedStatus} within ${maxWaitTimeMs}ms`
  );
};
