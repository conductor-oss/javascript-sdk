import type { WorkflowTask } from "../../../open-api";
import { TaskType } from "../../../open-api";

export interface WaitForWebhookOptions {
  /** Match conditions for incoming webhook (key-value pairs) */
  matches?: Record<string, unknown>;
  optional?: boolean;
}

export const waitForWebhookTask = (
  taskReferenceName: string,
  options?: WaitForWebhookOptions
): WorkflowTask => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.WAIT_FOR_WEBHOOK,
  inputParameters: {
    ...options?.matches,
  },
  optional: options?.optional,
});
