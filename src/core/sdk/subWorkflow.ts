import { TaskType, SubWorkflowTaskDef } from "../../common/types";

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
