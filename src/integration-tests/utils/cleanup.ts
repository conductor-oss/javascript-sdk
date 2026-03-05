import type { MetadataClient } from "../../sdk";

/** True if the error indicates the resource was already missing (safe to ignore). */
function isNotFoundError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    /no such task definition/i.test(msg) ||
    /no such workflow/i.test(msg) ||
    /not found/i.test(msg)
  );
}

/**
 * Unregister workflows and task definitions created during integration tests.
 * Swallows errors so one failed cleanup does not prevent others from running.
 * "Not found" errors are ignored (resource was never registered or already removed).
 */
export async function cleanupWorkflowsAndTasks(
  metadataClient: MetadataClient,
  options: {
    workflows?: Array<{ name: string; version: number }>;
    tasks?: string[];
  }
): Promise<void> {
  const { workflows = [], tasks = [] } = options;
  for (const wf of workflows) {
    try {
      await metadataClient.unregisterWorkflow(wf.name, wf.version);
    } catch (e) {
      if (!isNotFoundError(e)) {
        console.debug(`Cleanup workflow '${wf.name}' v${wf.version} failed:`, e);
      }
    }
  }
  for (const name of tasks) {
    try {
      await metadataClient.unregisterTask(name);
    } catch (e) {
      if (!isNotFoundError(e)) {
        console.debug(`Cleanup task '${name}' failed:`, e);
      }
    }
  }
}
