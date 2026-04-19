import { TaskType, PullWorkflowMessagesTaskDef } from "../../../open-api";

/**
 * Consume messages from the workflow's message queue (WMQ).
 *
 * When messages are available, the task completes with:
 *   output.messages — list of WorkflowMessage objects
 *   output.count    — number of messages returned
 *
 * When the queue is empty, the task stays IN_PROGRESS and is re-evaluated
 * after ~1 second (non-blocking polling behavior).
 *
 * @param taskReferenceName - Unique task reference name within the workflow
 * @param batchSize - Max messages to dequeue per execution (default 1, server cap ~100)
 * @param optional - Whether the task is optional (default undefined)
 */
export const pullWorkflowMessages = (
  taskReferenceName: string,
  batchSize: number = 1,
  optional?: boolean
): PullWorkflowMessagesTaskDef => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.PULL_WORKFLOW_MESSAGES,
  inputParameters: { batchSize },
  optional,
});
