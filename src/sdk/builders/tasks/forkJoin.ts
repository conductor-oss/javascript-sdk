import {
  TaskType,
  ForkJoinTaskDef,
  TaskDefTypes,
  JoinTaskDef,
} from "../../../open-api";
import { generateJoinTask } from "../../generators";

/**
 * Creates a FORK_JOIN task. Pass a list of branches (`TaskDefTypes[][]`) to run
 * them in parallel; a flat list of tasks is treated as a single branch.
 */
export const forkTask = (
  taskReferenceName: string,
  forkTasks: TaskDefTypes[] | TaskDefTypes[][]
): ForkJoinTaskDef => ({
  taskReferenceName,
  name: taskReferenceName,
  type: TaskType.FORK_JOIN,
  forkTasks:
    forkTasks.length > 0 && forkTasks.every((branch) => Array.isArray(branch))
      ? (forkTasks as TaskDefTypes[][])
      : [forkTasks as TaskDefTypes[]],
});

export const forkTaskJoin = (
  taskReferenceName: string,
  forkTasks: TaskDefTypes[],
  optional?: boolean
): [ForkJoinTaskDef, JoinTaskDef] => [
  forkTask(taskReferenceName, forkTasks),
  generateJoinTask({ name: `${taskReferenceName}_join`, optional }),
];
