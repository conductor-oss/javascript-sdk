import type { WorkflowDef } from "../../open-api";
import type { WorkflowExecutor } from "../../sdk/clients/workflow/WorkflowExecutor";
import type { MetadataClient } from "../../sdk/clients/metadata/MetadataClient";

/**
 * Register a workflow definition with retry on transient server errors (502/503).
 * Modeled after createClientWithRetry. Safe to retry because all calls use
 * overwrite=true, making the operation idempotent.
 */
export async function registerWorkflowWithRetry(
  executor: WorkflowExecutor,
  workflow: WorkflowDef,
  maxAttempts = 8,
  delayMs = 2000
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await executor.registerWorkflow(true, workflow);
      return;
    } catch (e) {
      lastError = e;
      if (attempt === maxAttempts) break;
      console.warn(
        `registerWorkflow "${workflow.name}" failed (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs * attempt}ms...`
      );
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw lastError;
}

/**
 * Same as registerWorkflowWithRetry but uses MetadataClient.registerWorkflowDef.
 */
export async function registerWorkflowDefWithRetry(
  metadataClient: MetadataClient,
  workflow: WorkflowDef,
  overwrite = true,
  maxAttempts = 8,
  delayMs = 2000
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await metadataClient.registerWorkflowDef(workflow, overwrite);
      return;
    } catch (e) {
      lastError = e;
      if (attempt === maxAttempts) break;
      console.warn(
        `registerWorkflowDef "${workflow.name}" failed (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs * attempt}ms...`
      );
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw lastError;
}
