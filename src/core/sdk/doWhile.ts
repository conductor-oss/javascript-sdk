import { TaskType, DoWhileTaskDef, TaskDefTypes } from "../../common/types";

export const doWhileTask = (
  taskRefName: string,
  terminationCondition: string,
  tasks: TaskDefTypes[],
  optional?: boolean
): DoWhileTaskDef => ({
  name: taskRefName,
  taskReferenceName: taskRefName,
  loopCondition: terminationCondition,
  inputParameters: {},
  type: TaskType.DO_WHILE,
  loopOver: tasks,
  optional,
});

const loopForCondition = (taskRefName: string, valueKey: string) =>
  `if ( $.${taskRefName}['iteration'] < $.${valueKey} ) { true; } else { false; }`;

export const newLoopTask = (
  taskRefName: string,
  iterations: number,
  tasks: TaskDefTypes[],
  optional?: boolean
): DoWhileTaskDef => ({
  name: taskRefName,
  taskReferenceName: taskRefName,
  loopCondition: loopForCondition(taskRefName, "value"),
  inputParameters: {
    value: iterations,
  },
  type: TaskType.DO_WHILE,
  loopOver: tasks,
  optional,
});
