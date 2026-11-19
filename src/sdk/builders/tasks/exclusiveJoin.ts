import type { WorkflowTask } from "../../../open-api";
import { TaskType } from "../../../open-api";

export const exclusiveJoinTask = (
  taskReferenceName: string,
  joinOn: string[],
  defaultExclusiveJoinTask?: string[],
  optional?: boolean
): WorkflowTask => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.EXCLUSIVE_JOIN,
  joinOn,
  defaultExclusiveJoinTask,
  inputParameters: {},
  optional,
});
