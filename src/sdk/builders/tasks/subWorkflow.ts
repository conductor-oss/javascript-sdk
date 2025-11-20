import { TaskType, SubWorkflowTaskDef } from "../../../open-api";

export const subWorkflowTask = (
  taskReferenceName: string,
  workflowName: string,
  version?: number,
  optional?: boolean
): SubWorkflowTaskDef => ({
  name: taskReferenceName,
  taskReferenceName,
  subWorkflowParam: {
    name: workflowName,
    version,
  },
  type: TaskType.SUB_WORKFLOW,
  optional,
});
