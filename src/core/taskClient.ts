import { TaskResultStatus } from "../core/types";

import { handleSdkError } from "./helpers";
import { Client } from "../common/open-api/client/types.gen";
import { SearchResultTaskSummary, Task } from "../common/open-api/types.gen";
import { TaskResource } from "../common/open-api/sdk.gen";

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
          status
        },
        client: this._client,
        throwOnError: true,
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to update task '${taskRefName}' result for workflow '${workflowId}'`);
    }
  }
}
