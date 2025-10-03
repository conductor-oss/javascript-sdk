import { TaskResultStatus } from "../core/types";
import {
  ConductorClient,
  SearchResultTask,
  Task,
  TaskResult,
} from "../common";
import { tryCatchReThrow } from "./helpers";

export class TaskClient {
  public readonly _client: ConductorClient;

  constructor(client: ConductorClient) {
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
  ): Promise<SearchResultTask> {
    return tryCatchReThrow(() =>
      this._client.taskResource.search(
        start,
        size,
        sort,
        freeText,
        query
      )
    );
  }

  /**
   * Get an existing schedule by Id
   * @param taskId
   * @returns Task
   */
  public getTask(taskId: string): Promise<Task> {
    return tryCatchReThrow(() =>
      this._client.taskResource.getTask(taskId)
    );
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
    taskReferenceName: string,
    status: TaskResultStatus,
    outputData: Record<string, unknown>,
  ): Promise<TaskResult> {
    return tryCatchReThrow(() =>
      this._client.taskResource.updateTask(
        workflowId,
        taskReferenceName,
        status,
        outputData
      )
    );
  }
}
