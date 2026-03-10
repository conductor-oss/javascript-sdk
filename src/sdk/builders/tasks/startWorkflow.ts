import type { WorkflowTask } from "../../../open-api";
import { TaskType } from "../../../open-api";

export const startWorkflowTask = (
  taskReferenceName: string,
  workflowName: string,
  input?: Record<string, unknown>,
  version?: number,
  correlationId?: string,
  optional?: boolean
): WorkflowTask => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.START_WORKFLOW,
  inputParameters: {
    startWorkflow: {
      name: workflowName,
      version,
      input,
      correlationId,
    },
  },
  optional,
});
