import { SetVariableTaskDef, TaskType } from "../../../open-api/types";
import { nameTaskNameGenerator } from "./common";

/**
 * Takes an optional partial SetVariableTaskDef
 * generates a task replacing default/fake values with provided overrides
 *
 * @param overrides overrides for defaults
 * @returns a fully defined task
 */
export const generateSetVariableTask = (
  overrides: Partial<SetVariableTaskDef> = {}
): SetVariableTaskDef => ({
  ...nameTaskNameGenerator("setVariable", overrides),
  inputParameters: {},
  ...overrides,
  type: TaskType.SET_VARIABLE,
});
