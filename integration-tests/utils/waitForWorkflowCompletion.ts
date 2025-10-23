import type { WorkflowExecutor } from "../../src/core/executor";

// Helper function to wait for workflow completion
export const waitForWorkflowCompletion = async (
  executor: WorkflowExecutor,
  workflowId: string,
  maxWaitMs = 300000, // 5 minutes default
  pollIntervalMs = 100 // 100ms default
) => {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const workflowStatus = await executor.getWorkflow(workflowId, true);

      if (!workflowStatus?.status) {
        throw new Error("Workflow status is undefined");
      }
      // Check if workflow is in a terminal state
      if (
        ["COMPLETED", "FAILED", "TERMINATED", "TIMED_OUT"].includes(
          workflowStatus.status
        )
      ) {
        console.debug(
          `Workflow ${workflowId} reached terminal state: ${workflowStatus.status}`
        );
        return workflowStatus;
      }

      console.debug(
        `Workflow ${workflowId} status: ${workflowStatus.status}, waiting...`
      );

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    } catch (error) {
      console.warn(`Error checking workflow status for ${workflowId}:`, error);
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  throw new Error(
    `Workflow ${workflowId} did not complete within ${maxWaitMs}ms`
  );
};
