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
): [ForkJoinTaskDef, JoinTaskDef] => {
  const fork = forkTask(taskReferenceName, forkTasks);
  // The server checks joinOn with allMatch(), which short-circuits to true on an
  // empty list — a JOIN with no joinOn completes without waiting for any branch.
  // Join on the last task of every branch so the JOIN blocks until each finishes.
  const joinOn = fork.forkTasks
    .map((branch) => branch[branch.length - 1]?.taskReferenceName)
    .filter((ref): ref is string => ref !== undefined);
  return [
    fork,
    generateJoinTask({ name: `${taskReferenceName}_join`, joinOn, optional }),
  ];
};
