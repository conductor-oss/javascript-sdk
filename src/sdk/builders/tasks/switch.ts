import { TaskType, SwitchTaskDef, TaskDefTypes } from "../../../open-api";

export const switchTask = (
  taskReferenceName: string,
  expression: string,
  decisionCases: Record<string, TaskDefTypes[]> = {},
  defaultCase: TaskDefTypes[] = [],
  optional?: boolean
): SwitchTaskDef => ({
  name: taskReferenceName,
  taskReferenceName,
  decisionCases,
  evaluatorType: "value-param",
  inputParameters: {
    switchCaseValue: expression,
  },
  expression: "switchCaseValue",
  defaultCase,
  type: TaskType.SWITCH,
  optional,
});
