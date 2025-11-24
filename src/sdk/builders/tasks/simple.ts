import { TaskType, SimpleTaskDef } from "../../../open-api";

export const simpleTask = (
  taskReferenceName: string,
  name: string,
  inputParameters: Record<string, unknown>,
  optional?: boolean
): SimpleTaskDef => ({
  name,
  taskReferenceName,
  inputParameters,
  type: TaskType.SIMPLE,
  optional,
});
