import type { WorkflowTask } from "../../../open-api";
import { TaskType } from "../../../open-api";

export const dynamicTask = (
  taskReferenceName: string,
  dynamicTaskName: string,
  dynamicTaskParam = "taskToExecute",
  optional?: boolean
): WorkflowTask => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.DYNAMIC,
  dynamicTaskNameParam: dynamicTaskParam,
  inputParameters: {
    [dynamicTaskParam]: dynamicTaskName,
  },
  optional,
});
