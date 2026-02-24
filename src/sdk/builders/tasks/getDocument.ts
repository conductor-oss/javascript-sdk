import type { WorkflowTask } from "../../../open-api";
import { TaskType } from "../../../open-api";

export interface GetDocumentOptions {
  /** Media type of the document (e.g. "application/pdf") */
  mediaType?: string;
  optional?: boolean;
}

export const getDocumentTask = (
  taskReferenceName: string,
  url: string,
  options?: GetDocumentOptions
): WorkflowTask => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.GET_DOCUMENT,
  inputParameters: {
    url,
    ...(options?.mediaType !== undefined && { mediaType: options.mediaType }),
  },
  optional: options?.optional,
});
