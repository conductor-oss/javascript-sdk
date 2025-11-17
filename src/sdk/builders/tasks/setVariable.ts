import { TaskType, SetVariableTaskDef } from "../../../open-api/types";

export const setVariableTask = (
  taskReferenceName: string,
  inputParameters: Record<string, unknown>,
  optional?: boolean
): SetVariableTaskDef => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.SET_VARIABLE,
  inputParameters,
  optional,
});
