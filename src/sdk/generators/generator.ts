import { workflowGenerator } from "./WorkflowGenerator";
import { WorkflowDefGen, TaskDefTypesGen } from "./types";
import { generateSimpleTask } from "./SimpleTask";
import { generateDoWhileTask } from "./DoWhileTask";
import { generateEventTask } from "./EventTask";
import { generateForkJoinTask, generateJoinTask } from "./ForkJoin";
import { generateForkJoinDynamic } from "./ForkJoinDynamicTask";
import { generateHTTPTask } from "./HttpTask";
import { generateInlineTask } from "./InlineTask";
import { generateJQTransformTask } from "./JsonJQTransform";
import { generateKafkaPublishTask } from "./KafkaTask";
import { generateSubWorkflowTask } from "./SubWorkflowTask";
import { generateSetVariableTask } from "./SetVariableTask";
import { generateTerminateTask } from "./TerminateTask";
import { generateWaitTask } from "./WaitTask";
import { generateSwitchTask } from "./SwitchTask";
import { SimpleTaskDef, TaskDefTypes, TaskType } from "../../../open-api/types";

const filledTaskDef = (task: Partial<TaskDefTypesGen>): TaskDefTypes => {
  const taskType = task.type;
  switch (taskType) {
    case TaskType.SWITCH:
      return generateSwitchTask(task, taskGenMapper);
    case TaskType.SIMPLE:
      return generateSimpleTask(task);
    case TaskType.DO_WHILE:
      return generateDoWhileTask(task, taskGenMapper);
    case TaskType.EVENT:
      return generateEventTask(task);
    case TaskType.FORK_JOIN:
      return generateForkJoinTask(task, taskGenMapper);
    case TaskType.FORK_JOIN_DYNAMIC:
      return generateForkJoinDynamic(task);
    case TaskType.HTTP:
      return generateHTTPTask(task);
    case TaskType.INLINE:
      return generateInlineTask(task);
    case TaskType.JOIN:
      return generateJoinTask(task);
    case TaskType.JSON_JQ_TRANSFORM:
      return generateJQTransformTask(task);
    case TaskType.KAFKA_PUBLISH:
      return generateKafkaPublishTask(task);
    case TaskType.SUB_WORKFLOW:
      return generateSubWorkflowTask(task);
    case TaskType.SET_VARIABLE:
      return generateSetVariableTask(task);
    case TaskType.TERMINATE:
      return generateTerminateTask(task);
    case TaskType.WAIT:
      return generateWaitTask(task);
    default:
      return generateSimpleTask(task as SimpleTaskDef);
  }
};

export const taskGenMapper = (
  tasks: Partial<TaskDefTypesGen>[]
): TaskDefTypes[] =>
  tasks.reduce((acc: TaskDefTypes[], task, idx: number): TaskDefTypes[] => {
    const filledTask = filledTaskDef(task);
    const maybeNextTask = tasks.length >= idx + 1 ? tasks[idx + 1] : undefined;

    return acc.concat(maybeAddJoinTask(filledTask, maybeNextTask));
  }, []);

const maybeAddJoinTask = (
  currentTask: TaskDefTypes,
  maybeNextTask?: Partial<TaskDefTypesGen>
) => {
  if (
    (currentTask.type === TaskType.FORK_JOIN ||
      currentTask.type === TaskType.FORK_JOIN_DYNAMIC) &&
    maybeNextTask != null &&
    maybeNextTask.type !== TaskType.JOIN
  ) {
    return [currentTask, generateJoinTask({})];
  }
  return currentTask;
};

/**
 * Takes an optional partial WorkflowDefGen
 * generates a workflow replacing default/fake values with provided overrides
 *
 * @param overrides overrides for defaults
 * @returns a fully defined task
 */
export const generate = (overrides: Partial<WorkflowDefGen>) => {
  const maybeTasks: Partial<TaskDefTypesGen>[] = overrides.tasks || [];
  const generatedTasks: TaskDefTypes[] = taskGenMapper(maybeTasks);
  return workflowGenerator({ ...overrides, tasks: generatedTasks });
};
