import { ForkJoinDynamicDef, TaskType } from "../../../open-api/types";
import { nameTaskNameGenerator } from "./common";

export const generateForkJoinDynamic = (
  overrides: Partial<ForkJoinDynamicDef> = {}
): ForkJoinDynamicDef => ({
  ...nameTaskNameGenerator("forkJoinDynamic", overrides),
  inputParameters: {
    dynamicTasks: "",
    dynamicTasksInput: "",
  },
  dynamicForkTasksParam: "dynamicTasks",
  dynamicForkTasksInputParamName: "dynamicTasksInput",
  startDelay: 0,
  optional: false,
  asyncComplete: false,
  ...overrides,
  type: TaskType.FORK_JOIN_DYNAMIC,
});
