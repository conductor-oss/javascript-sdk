import { SubWorkflowTaskDef, TaskType } from "../../open-api";
import { nameTaskNameGenerator } from "./common";

/**
 * Takes an optional partial SubWorkflowTaskDef
 * generates a task replacing default/fake values with provided overrides
 *
 * @param overrides overrides for defaults
 * @returns a fully defined task
 */
export const generateSubWorkflowTask = (
  overrides: Partial<SubWorkflowTaskDef> = {}
): SubWorkflowTaskDef => ({
  ...nameTaskNameGenerator("subWorkflow", overrides),
  inputParameters: {},
  subWorkflowParam: {
    name: "name",
    version: 1,
    taskToDomain: {},
  },
  ...overrides,
  type: TaskType.SUB_WORKFLOW,
});
