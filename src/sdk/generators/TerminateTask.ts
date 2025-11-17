import { TerminateTaskDef, TaskType } from "../../../open-api/types";
import { nameTaskNameGenerator } from "./common";

/**
 * Takes an optional partial TerminateTaskDef
 * generates a task replacing default/fake values with provided overrides
 *
 * @param overrides overrides for defaults
 * @returns a fully defined task
 */
export const generateTerminateTask = (
  overrides: Partial<TerminateTaskDef> = {}
): TerminateTaskDef => ({
  ...nameTaskNameGenerator("terminate", overrides),
  inputParameters: {
    terminationStatus: "COMPLETED",
    workflowOutput: {},
  },
  startDelay: 0,
  ...overrides,
  type: TaskType.TERMINATE,
});
