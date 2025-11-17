import { TaskType, HttpTaskDef, HttpInputParameters } from "../../../open-api/types";

export const httpTask = (
  taskReferenceName: string,
  inputParameters: HttpInputParameters,
  asyncComplete?: boolean,
  optional?: boolean
): HttpTaskDef => ({
  name: taskReferenceName,
  taskReferenceName,
  inputParameters: {
    http_request: inputParameters,
  },
  asyncComplete,
  optional,
  type: TaskType.HTTP,
});
