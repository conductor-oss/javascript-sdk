import { TaskType, JoinTaskDef } from "../../common/types";

export const joinTask = (
  taskReferenceName: string,
  joinOn: string[],
  optional?: boolean
): JoinTaskDef => ({
  name: taskReferenceName,
  taskReferenceName,
  joinOn,
  type: TaskType.JOIN,
  optional,
});
