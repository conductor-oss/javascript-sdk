import {
  TaskType,
  HttpTaskDef,
  HttpInputParameters,
} from "../../common/types";

export const httpTask = (
  taskReferenceName: string,
  inputParameters: HttpInputParameters,
  asyncComplete: boolean = false
): HttpTaskDef => ({
  name: taskReferenceName,
  taskReferenceName,
  inputParameters: {
    http_request: inputParameters,
  },
  asyncComplete,
  type: TaskType.HTTP,
});
