import type { WorkflowExecutor } from "../../sdk/clients/workflow/WorkflowExecutor";
import type { StartWorkflowRequest } from "../../open-api";

/**
 * Execute a workflow with automatic retry on transient failures.
 * Useful in CI/CD environments where the Conductor server might be under load.
 *
 * @param executor - The WorkflowExecutor instance
 * @param request - The workflow execution request
 * @param workflowName - Workflow name
 * @param version - Workflow version
 * @param correlationId - Optional correlation ID
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param initialDelayMs - Initial delay before first retry in ms (default: 500)
 * @returns Workflow execution result
 */
export async function executeWorkflowWithRetry(
  executor: WorkflowExecutor,
  request: StartWorkflowRequest,
  workflowName: string,
  version: number,
  correlationId?: string,
  maxRetries = 3,
  initialDelayMs = 500
): Promise<{ workflowId?: string }> {
  let lastError: Error | undefined;
  let delayMs = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await executor.executeWorkflow(
        request,
        workflowName,
        version,
        correlationId
      );
    } catch (error: unknown) {
      lastError = error as Error;
      const errorMessage = lastError.message?.toLowerCase() || "";

      // Only retry on transient network errors, not business logic errors
      const isRetryable =
        errorMessage.includes("fetch failed") ||
        errorMessage.includes("network") ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("econnrefused") ||
        errorMessage.includes("econnreset");

      if (!isRetryable || attempt === maxRetries) {
        throw lastError;
      }

      // Exponential backoff with jitter
      const jitter = Math.random() * 100;
      await new Promise((resolve) => setTimeout(resolve, delayMs + jitter));
      delayMs *= 2; // Exponential backoff: 500ms, 1000ms, 2000ms
    }
  }

  throw lastError;
}
