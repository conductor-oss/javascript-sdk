import { WaitTaskDef, TaskType } from "../../../open-api/types";
import { nameTaskNameGenerator } from "./common";

/**
 * Takes an optional partial WaitTaskDef
 * generates a task replacing default/fake values with provided overrides
 *
 * @param overrides overrides for defaults
 * @returns a fully defined task
 */
export const generateWaitTask = (
  overrides: Partial<WaitTaskDef> = {}
): WaitTaskDef => ({
  ...nameTaskNameGenerator("wait", overrides),
  ...overrides,
  inputParameters:{},
  type: TaskType.WAIT,
});
