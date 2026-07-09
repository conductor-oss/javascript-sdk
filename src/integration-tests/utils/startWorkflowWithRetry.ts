import type { WorkflowExecutor } from "../../sdk/clients/workflow/WorkflowExecutor";
import type { StartWorkflowRequest } from "../../open-api";

/**
 * Start a workflow with automatic retry on transient server errors (502/503).
 * startWorkflow uses HTTP POST which is not retried by the transport layer,
 * so this wrapper provides test-level resilience for flaky CI environments.
 */
export async function startWorkflowWithRetry(
  executor: WorkflowExecutor,
  request: StartWorkflowRequest,
  maxAttempts = 5,
  delayMs = 2000
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await executor.startWorkflow(request);
    } catch (e) {
      lastError = e;
      if (attempt === maxAttempts) break;
      console.warn(
        `startWorkflow "${request.name}" failed (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs * attempt}ms...`
      );
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw lastError;
}
