import { EventTaskDef, TaskType } from "../../open-api";
import { nameTaskNameGenerator } from "./common";

/**
 * Takes an optional partial EventTaskDef
 * generates a task replacing default/fake values with provided overrides
 *
 * @param overrides overrides for defaults
 * @returns a fully defined task
 */
export const generateEventTask = (
  overrides: Partial<EventTaskDef> = {}
): EventTaskDef => ({
  ...nameTaskNameGenerator("event", overrides),
  sink: "sqs:sqs_queue_name",
  asyncComplete: false,
  ...overrides,
  type: TaskType.EVENT,
});
