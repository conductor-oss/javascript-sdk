import { TaskType, JsonJQTransformTaskDef } from "../../common/types";

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
