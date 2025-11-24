import { SimpleTaskDef, TaskType } from "../../open-api";
import { nameTaskNameGenerator } from "./common";

/**
 * Takes an optional partial SimpleTaskDef
 * generates a task replacing default values with provided overrides
 *
 * @param overrides overrides for defaults
 * @returns a fully defined task
 */
export const generateSimpleTask = (
  overrides: Partial<SimpleTaskDef> = {}
): SimpleTaskDef => ({
  ...nameTaskNameGenerator("simple", overrides),
  inputParameters: {},
  ...overrides,
  type: TaskType.SIMPLE,
});
