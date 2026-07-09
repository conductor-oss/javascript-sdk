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
  let diagnosticLogged = false;

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

      // Log diagnostics once when we've used 80% of the wait budget
      const elapsed = Date.now() - startTime;
      if (!diagnosticLogged && elapsed > maxWaitTimeMs * 0.8) {
        diagnosticLogged = true;
        const pendingTasks = workflow?.tasks
          ?.filter((t) => t.status !== "COMPLETED")
          .map((t) => `${t.referenceTaskName}(${t.taskType}): ${t.status}`)
          .join(", ");
        console.warn(
          `[waitForWorkflowStatus] ${workflowId} still ${workflow?.status} after ${Math.round(elapsed / 1000)}s ` +
            `(waiting for ${expectedStatus}, timeout ${Math.round(maxWaitTimeMs / 1000)}s). ` +
            `Pending tasks: [${pendingTasks ?? "none"}]`
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
