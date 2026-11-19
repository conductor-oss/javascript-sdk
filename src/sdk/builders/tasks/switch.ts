import { TaskType, SwitchTaskDef, TaskDefTypes } from "../../../open-api";

/**
 * With the default `"value-param"` evaluator, `expression` is the value to
 * switch on. With any other evaluator, `expression` is passed through as-is:
 * a script for `"javascript"`, or the choice question name for `"decision"`
 * (set the decision inputs — `model`, `state`, `questions`, optional
 * `provider` — on `inputParameters`).
 */
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
