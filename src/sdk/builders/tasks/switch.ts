import { TaskType, SwitchTaskDef, TaskDefTypes } from "../../../open-api";

export const switchTask = (
  taskReferenceName: string,
  expression: string,
  decisionCases: Record<string, TaskDefTypes[]> = {},
  defaultCase: TaskDefTypes[] = [],
  optional?: boolean,
  evaluatorType: SwitchTaskDef["evaluatorType"] = "value-param"
): SwitchTaskDef => ({
  name: taskReferenceName,
  taskReferenceName,
  decisionCases,
  evaluatorType,
  inputParameters:
    evaluatorType === "value-param" ? { switchCaseValue: expression } : {},
  expression: evaluatorType === "value-param" ? "switchCaseValue" : expression,
  defaultCase,
  type: TaskType.SWITCH,
  optional,
});
