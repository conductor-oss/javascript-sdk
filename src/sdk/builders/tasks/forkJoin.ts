import {
  TaskType,
  ForkJoinTaskDef,
  TaskDefTypes,
  JoinTaskDef,
} from "../../../open-api";
import { generateJoinTask } from "../../generators";

export const forkTask = (
  taskReferenceName: string,
  forkTasks: TaskDefTypes[]
): ForkJoinTaskDef => ({
  taskReferenceName,
  name: taskReferenceName,
  type: TaskType.FORK_JOIN,
  forkTasks: [forkTasks],
});

export const forkTaskJoin = (
  taskReferenceName: string,
  forkTasks: TaskDefTypes[],
  optional?: boolean
): [ForkJoinTaskDef, JoinTaskDef] => [
  forkTask(taskReferenceName, forkTasks),
  generateJoinTask({ name: `${taskReferenceName}_join`, optional }),
];
