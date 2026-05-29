import type { ExtendedTaskDef } from "../../open-api";
import type { MetadataClient } from "../../sdk/clients/metadata/MetadataClient";

/**
 * Register a task definition with retry on transient server errors (502/503).
 * Follows the same pattern as registerWorkflowWithRetry. Safe to retry because
 * registerTask is idempotent (re-registering overwrites the existing definition).
 */
export async function registerTaskWithRetry(
  metadataClient: MetadataClient,
  taskDef: ExtendedTaskDef,
  maxAttempts = 5,
  delayMs = 2000
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await metadataClient.registerTask(taskDef);
      return;
    } catch (e) {
      lastError = e;
      if (attempt === maxAttempts) break;
      console.warn(
        `registerTask "${taskDef.name}" failed (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs * attempt}ms...`
      );
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw lastError;
}
