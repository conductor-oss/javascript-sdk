import { TaskType, WaitTaskDef } from "../../common/types";

export const waitTaskDuration = (
  taskReferenceName: string,
  duration: string,
  optional?: boolean
): WaitTaskDef => ({
  name: taskReferenceName,
  taskReferenceName,
  inputParameters: {
    duration,
  },
  type: TaskType.WAIT,
  optional,
});

export const waitTaskUntil = (
  taskReferenceName: string,
  until: string,
  optional?: boolean
): WaitTaskDef => ({
  name: taskReferenceName,
  taskReferenceName,
  inputParameters: {
    until,
  },
  type: TaskType.WAIT,
  optional,
});
