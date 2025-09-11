import { TaskType, ForkJoinDynamicDef, TaskDefTypes } from "../../common/types";

export const dynamicForkTask = (
  taskReferenceName: string,
  preForkTasks: TaskDefTypes[] = [],
  dynamicTasksInput: string = "",
  optional?: boolean
): ForkJoinDynamicDef => ({
  name: taskReferenceName,
  taskReferenceName,
  inputParameters: {
    dynamicTasks: preForkTasks,
    dynamicTasksInput,
  },
  type: TaskType.FORK_JOIN_DYNAMIC,
  dynamicForkTasksParam: "dynamicTasks",
  dynamicForkTasksInputParamName: "dynamicTasksInput",
  optional,
});
