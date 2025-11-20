import { generateSimpleTask } from "./SimpleTask";
import { generateDoWhileTask as doWhileGenerateInner } from "./DoWhileTask";
import { generateEventTask } from "./EventTask";
import {
  generateForkJoinTask as generateForkJoinTaskInner,
  generateJoinTask,
} from "./ForkJoin";
import { generateHTTPTask } from "./HttpTask";
import { generateInlineTask } from "./InlineTask";
import { generateJQTransformTask } from "./JsonJQTransform";
import { generateKafkaPublishTask } from "./KafkaTask";
import { generateSubWorkflowTask } from "./SubWorkflowTask";
import { generateSetVariableTask } from "./SetVariableTask";
import { generateTerminateTask } from "./TerminateTask";
import { generateWaitTask } from "./WaitTask";
import { generateSwitchTask as innerGenerateSwitchTask } from "./SwitchTask";

import { taskGenMapper, generate } from "./generator";
import {
  SwitchTaskDefGen,
  NestedTaskMapper,
  DoWhileTaskDefGen,
  ForkJoinTaskDefGen,
} from "./types";
/**
 * Takes an optional partial SwitchTaskDefGen and an optional nestedMapper
 * generates a task replacing default/fake values with provided overrides
 *
 * @param overrides overrides for defaults
 * @param nestedTasksMapper function to run on array of nested tasks
 * @returns a fully defined task
 */
const generateSwitchTask = (
  overrides: Partial<SwitchTaskDefGen> = {},
  nestedTasksMapper: NestedTaskMapper = taskGenMapper
) => innerGenerateSwitchTask(overrides, nestedTasksMapper);

/**
 * Takes an optional partial DoWhileTaskDefGen and an optional nestedMapper
 * generates a task replacing default/fake values with provided overrides
 *
 * @param overrides overrides for defaults
 * @param nestedTasksMapper function to run on array of nested tasks
 * @returns a fully defined task
 */
const generateDoWhileTask = (
  overrides: Partial<DoWhileTaskDefGen> = {},
  nestedTasksMapper: NestedTaskMapper = taskGenMapper
) => doWhileGenerateInner(overrides, nestedTasksMapper);

/**
 * Takes an optional partial DoWhileTaskDefGen and an optional nestedMapper
 * generates a task replacing default/fake values with provided overrides
 *
 * @param overrides overrides for defaults
 * @param nestedTasksMapper function to run on array of nested tasks
 * @returns a fully defined task
 */
const generateForkJoinTask = (
  overrides: Partial<ForkJoinTaskDefGen> = {},
  nestedMapper: NestedTaskMapper = taskGenMapper
) => generateForkJoinTaskInner(overrides, nestedMapper);

export {
  generateSimpleTask,
  generateDoWhileTask,
  generateEventTask,
  generateForkJoinTask,
  generateJoinTask,
  generateHTTPTask,
  generateInlineTask,
  generateJQTransformTask,
  generateKafkaPublishTask,
  generateSubWorkflowTask,
  generateSetVariableTask,
  generateTerminateTask,
  generateWaitTask,
  generateSwitchTask,
  generate,
  taskGenMapper,
};
