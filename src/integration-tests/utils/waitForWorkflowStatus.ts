import { Workflow } from "../../open-api";
import { WorkflowExecutor } from "../../sdk";

/**
 * Wait for workflow to reach expected status
 */
const LOG_INTERVAL_MS = 15000;

export const waitForWorkflowStatus = async (
  workflowClient: WorkflowExecutor,
  workflowId: string,
  expectedStatus: string,
  maxWaitTimeMs = 90000,
  pollIntervalMs = 3000
): Promise<Workflow> => {
  const startTime = Date.now();
  let lastLogTime = 0;
  let lastStatus: string | undefined;

  let lastError: unknown;
  while (Date.now() - startTime < maxWaitTimeMs) {
    try {
      const workflow = await workflowClient.getWorkflow(workflowId, true);
      const elapsed = Date.now() - startTime;

      if (workflow?.status === expectedStatus) {
        if (process.env.CI && elapsed > 0) {
          console.log(
            `[waitForWorkflowStatus] workflowId=${workflowId} reached ${expectedStatus} in ${elapsed}ms`
          );
        }
        return workflow;
      }

      if (workflow?.status === "FAILED" || workflow?.status === "TERMINATED") {
        throw new Error(
          `Workflow ended in unexpected state: ${workflow?.status}`
        );
      }

      lastStatus = workflow?.status;

      if (process.env.CI && Date.now() - lastLogTime >= LOG_INTERVAL_MS) {
        lastLogTime = Date.now();
        console.log(
          `[waitForWorkflowStatus] workflowId=${workflowId} status=${workflow?.status ?? "undefined"} elapsed=${elapsed}ms (waiting for ${expectedStatus})`
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

  const lastStatusMsg = lastStatus !== undefined ? `; last status was ${lastStatus}` : "";
  throw new Error(
    `Workflow did not reach status ${expectedStatus} within ${maxWaitTimeMs}ms${lastStatusMsg}`
  );
};
