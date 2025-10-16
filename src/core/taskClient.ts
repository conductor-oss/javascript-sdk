import { TaskResultStatus } from "../core/types";

import { tryCatchReThrow } from "./helpers";
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
  public search(
    start: number,
    size: number,
    sort = "",
    freeText: string,
    query: string
  ): Promise<SearchResultTaskSummary | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await TaskResource.search2({
        query: { start, size, sort, freeText, query },
        client: this._client,
      });

      return data;
    });
  }

  /**
   * Get an existing schedule by Id
   * @param taskId
   * @returns Task
   */
  public getTask(taskId: string): Promise<Task | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await TaskResource.getTask({
        path: { taskId },
        client: this._client,
      });

      return data;
    });
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
  public updateTaskResult(
    workflowId: string,
    taskRefName: string,
    status: TaskResultStatus,
    outputData: Record<string, unknown>
  ): Promise<string | undefined> {
    return tryCatchReThrow(async () => {
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
      });

      return data;
    });
  }
}
