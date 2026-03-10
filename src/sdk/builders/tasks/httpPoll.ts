import type { WorkflowTask, HttpInputParameters } from "../../../open-api";
import { TaskType } from "../../../open-api";

export interface HttpPollInputParameters {
  http_request: HttpInputParameters;
  /** Polling interval in seconds */
  pollingInterval?: number;
  /** Polling strategy: FIXED or LINEAR_BACKOFF */
  pollingStrategy?: "FIXED" | "LINEAR_BACKOFF";
  /** Condition expression to terminate polling (e.g. "$.status === 'COMPLETED'") */
  terminationCondition?: string;
}

export const httpPollTask = (
  taskReferenceName: string,
  inputParameters: HttpPollInputParameters,
  optional?: boolean
): WorkflowTask => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.HTTP_POLL,
  inputParameters: inputParameters as unknown as Record<string, unknown>,
  optional,
});
