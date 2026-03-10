import { TaskResultStatus } from "../../types";
import { handleSdkError } from "../../helpers/errors";
import type {
  Client,
  PollData,
  SearchResultTaskSummary,
  Task,
  TaskExecLog,
  Workflow,
} from "../../../open-api";
import { TaskResource } from "../../../open-api/generated";

export class TaskClient {
  public readonly _client: Client;

  constructor(client: Client) {
    this._client = client;
  }

  /**
   * Searches for existing scheduler execution based on below parameters
   *
   * @param start
   * @param size
   * @param sort
   * @param freeText
   * @param query
   * @returns SearchResultWorkflowScheduleExecutionModel
   */
  public async search(
    start: number,
    size: number,
    sort = "",
    freeText: string,
    query: string
  ): Promise<SearchResultTaskSummary> {
    try {
      const { data } = await TaskResource.search2({
        query: { start, size, sort, freeText, query },
        client: this._client,
        throwOnError: true,
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(error, "Failed to search tasks");
    }
  }

  /**
   * Get an existing schedule by Id
   * @param taskId
   * @returns Task
   */
  public async getTask(taskId: string): Promise<Task> {
    try {
      const { data } = await TaskResource.getTask({
        path: { taskId },
        client: this._client,
        throwOnError: true,
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get task '${taskId}'`);
    }
  }

  /**
   * Update task result status
   *
   * @param workflowId
   * @param taskReferenceName
   * @param status
   * @param outputData
   * @param workerId
   * @returns
   */
  public async updateTaskResult(
    workflowId: string,
    taskRefName: string,
    status: TaskResultStatus,
    outputData: Record<string, unknown>
  ): Promise<string> {
    try {
      const { data } = await TaskResource.updateTask1({
        body: {
          outputData,
        },
        path: {
          workflowId,
          taskRefName,
          status,
        },
        client: this._client,
        throwOnError: true,
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to update task '${taskRefName}' result for workflow '${workflowId}'`
      );
    }
  }

  /**
   * Add a log entry to a task
   * @param taskId - The task ID
   * @param message - The log message
   */
  public async addTaskLog(taskId: string, message: string): Promise<void> {
    try {
      await TaskResource.log({
        path: { taskId },
        body: message,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to add log to task '${taskId}'`);
    }
  }

  /**
   * Get logs for a task
   * @param taskId - The task ID
   * @returns Array of task execution logs
   */
  public async getTaskLogs(taskId: string): Promise<TaskExecLog[]> {
    try {
      const { data } = await TaskResource.getTaskLogs({
        path: { taskId },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get logs for task '${taskId}'`);
    }
  }

  /**
   * Get queue sizes for task types
   * @param taskType - Optional array of task types to filter by
   * @returns Map of task type to queue size
   */
  public async getQueueSizeForTask(
    taskType?: string[]
  ): Promise<Record<string, number>> {
    try {
      const { data } = await TaskResource.size({
        query: { taskType },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, "Failed to get queue sizes");
    }
  }

  /**
   * Get poll data for a task type
   * @param taskType - The task type
   * @returns Array of poll data
   */
  public async getTaskPollData(taskType: string): Promise<PollData[]> {
    try {
      const { data } = await TaskResource.getPollData({
        query: { taskType },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to get poll data for task type '${taskType}'`
      );
    }
  }

  /**
   * Updates a task by reference name synchronously and returns the complete workflow
   * @param workflowId - The workflow instance ID
   * @param taskRefName - The task reference name
   * @param status - The task status
   * @param output - The task output data
   * @param workerId - Optional worker ID
   * @returns The updated workflow
   */
  public async updateTaskSync(
    workflowId: string,
    taskRefName: string,
    status: "IN_PROGRESS" | "FAILED" | "FAILED_WITH_TERMINAL_ERROR" | "COMPLETED",
    output: Record<string, unknown>,
    workerId?: string
  ): Promise<Workflow> {
    try {
      const { data } = await TaskResource.updateTaskSync({
        path: { workflowId, taskRefName, status },
        body: output,
        query: { workerid: workerId },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to update task '${taskRefName}' synchronously for workflow '${workflowId}'`
      );
    }
  }
}
