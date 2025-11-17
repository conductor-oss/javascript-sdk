import { SwitchTaskDef, TaskType, TaskDefTypes } from "../../../open-api/types";
import { nameTaskNameGenerator, mapArrValues } from "./common";
import { NestedTaskMapper, SwitchTaskDefGen } from "./types";

interface DefinedCases {
  decisionCases: Record<string, TaskDefTypes[]>;
  defaultCase: TaskDefTypes[];
}

const fillSwitchTaskBranches = (
  task: Partial<SwitchTaskDefGen>,
  mapper: NestedTaskMapper
): DefinedCases => ({
  decisionCases: mapArrValues(mapper, task?.decisionCases || {}),
  defaultCase: mapper(task?.defaultCase || []),
});

export const generateSwitchTask = (
  overrides: Partial<SwitchTaskDefGen> = {},
  nestedTasksMapper: NestedTaskMapper
): SwitchTaskDef => ({
  ...nameTaskNameGenerator("switch", overrides),
  inputParameters: {
    switchCaseValue: "",
  },
  evaluatorType: "value-param",
  expression: "switchCaseValue",
  ...overrides,
  ...fillSwitchTaskBranches(overrides, nestedTasksMapper),
  type: TaskType.SWITCH,
});
