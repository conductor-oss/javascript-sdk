import { Workflow } from "../../open-api";
import { WorkflowExecutor } from "../../sdk";

/**
 * Wait for workflow to reach expected status
 */
export const waitForWorkflowStatus = async (
  workflowClient: WorkflowExecutor,
  workflowId: string,
  expectedStatus: string,
  maxWaitTimeMs = 90000,
  pollIntervalMs = 3000
): Promise<Workflow> => {
  const startTime = Date.now();

  let lastError: unknown;
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

      lastError = undefined;
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    } catch (error) {
      lastError = error;
      // Retry on transient errors (e.g. workflow not visible yet after start)
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  if (lastError) {
    throw new Error(`Failed to get workflow status: ${lastError}`);
  }

  throw new Error(
    `Workflow did not reach status ${expectedStatus} within ${maxWaitTimeMs}ms`
  );
};
