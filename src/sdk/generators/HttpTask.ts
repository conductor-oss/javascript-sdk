import { HttpTaskDef, TaskType } from "../../../open-api/types";
import { nameTaskNameGenerator } from "./common";

/**
 * Takes an optional partial HttpTaskDef
 * generates a task replacing default/fake values with provided overrides
 *
 * @param overrides overrides for defaults
 * @returns a fully defined task
 */
export const generateHTTPTask = (
 overrides: Partial<HttpTaskDef> = {}
): HttpTaskDef => ({
  ...nameTaskNameGenerator("httpTask", overrides),
  inputParameters: {
    http_request: {
      uri: "https://jsonplaceholder.typicode.com/posts/${workflow.input.queryid}",
      method: "GET",
    },
  },
  asyncComplete: false,
  ...overrides,
  type: TaskType.HTTP,
});
