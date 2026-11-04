import { TaskType, NoopTaskDef } from "../../../open-api";

export const noopTask = (
  taskReferenceName: string,
  optional?: boolean
): NoopTaskDef => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.NOOP,
  inputParameters: {},
  optional,
});
