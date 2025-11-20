import { JsonJQTransformTaskDef, TaskType } from "../../open-api";
import { nameTaskNameGenerator } from "./common";

/**
 * Takes an optional partial JsonJQTransformTaskDef
 * generates a task replacing default/fake values with provided overrides
 *
 * @param overrides overrides for defaults
 * @returns a fully defined task
 */
export const generateJQTransformTask = (
  overrides: Partial<JsonJQTransformTaskDef> = {}
): JsonJQTransformTaskDef => ({
  ...nameTaskNameGenerator("jqTransform", overrides),
  inputParameters: {
    key1: {
      value1: ["a", "b"],
    },
    key2: {
      value2: ["c", "d"],
    },
    queryExpression: "{ key3: (.key1.value1 + .key2.value2) }",
  },
  ...overrides,
  type: TaskType.JSON_JQ_TRANSFORM,
});
