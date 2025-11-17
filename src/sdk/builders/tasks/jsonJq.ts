import { TaskType, JsonJQTransformTaskDef } from "../../../open-api/types";

export const jsonJqTask = (
  taskReferenceName: string,
  script: string,
  optional?: boolean
): JsonJQTransformTaskDef => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.JSON_JQ_TRANSFORM,
  inputParameters: {
    queryExpression: script,
  },
  optional,
});
