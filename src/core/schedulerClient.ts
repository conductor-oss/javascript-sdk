import {
  ConductorClient,
  SaveScheduleRequest,
  SearchResultWorkflowScheduleExecutionModel,
  WorkflowSchedule,
} from "../common";
import { tryCatchReThrow } from "./helpers";

export class SchedulerClient {
  public readonly _client: ConductorClient;

  constructor(client: ConductorClient) {
    this._client = client;
  }

  /**
   * Create or update a schedule for a specified workflow with a corresponding start workflow request
   * @param requestBody
   * @returns
   */
  public saveSchedule(param: SaveScheduleRequest): Promise<void> {
    return tryCatchReThrow(() =>
      this._client.schedulerResource.saveSchedule(param)
    );
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
  ): Promise<SearchResultWorkflowScheduleExecutionModel> {
    return tryCatchReThrow(() =>
      this._client.schedulerResource.searchV21(
        start,
        size,
        sort,
        freeText,
        query
      )
    );
  }

  /**
   * Get an existing schedule by name
   * @param name
   * @returns SaveScheduleRequest
   */
  public getSchedule(name: string): Promise<SaveScheduleRequest> {
    return tryCatchReThrow(() =>
      this._client.schedulerResource.getSchedule(name)
    );
  }

  /**
   * Pauses an existing schedule by name
   * @param name
   * @returns
   */
  public pauseSchedule(name: string): Promise<void> {
    return tryCatchReThrow(() =>
      this._client.schedulerResource.pauseSchedule(name)
    );
  }

  /**
   * Resume a paused schedule by name
   *
   * @param name
   * @returns
   */
  public resumeSchedule(name: string): Promise<void> {
    return tryCatchReThrow(() =>
      this._client.schedulerResource.resumeSchedule(name)
    );
  }

  /**
   * Deletes an existing scheduler execution by name
   *
   * @param name
   * @returns
   */
  public deleteSchedule(name: string): Promise<void> {
    return tryCatchReThrow(() =>
      this._client.schedulerResource.deleteSchedule(name)
    );
  }

  /**
   * Get all existing workflow schedules and optionally filter by workflow name
   * @param workflowName
   * @returns Array<WorkflowSchedule>
   */
  public getAllSchedules(
    workflowName?: string
  ): Promise<WorkflowSchedule[]> {
    return tryCatchReThrow(() =>
      this._client.schedulerResource.getAllSchedules(workflowName)
    );
  }

  /**
   * Get list of the next x (default 3, max 5) execution times for a scheduler
   * @param cronExpression
   * @param scheduleStartTime
   * @param scheduleEndTime
   * @param limit
   * @returns number OK
   * @throws ApiError
   */
  public getNextFewSchedules(
    cronExpression: string,
    scheduleStartTime?: number,
    scheduleEndTime?: number,
    limit = 3
  ): Promise<number[][]> {
    return tryCatchReThrow(() =>
      this._client.schedulerResource.getNextFewSchedules(
        cronExpression,
        scheduleStartTime,
        scheduleEndTime,
        limit
      )
    );
  }

  /**
   * Pause all scheduling in a single conductor server instance (for debugging only)
   * @returns any OK
   * @throws ApiError
   */
  public pauseAllSchedules(): Promise<void> {
    return tryCatchReThrow(() =>
      this._client.schedulerResource.pauseAllSchedules()
    );
  }

  /**
   * Requeue all execution records
   * @returns any OK
   * @throws ApiError
   */
  public requeueAllExecutionRecords(): Promise<void> {
    return tryCatchReThrow(() =>
      this._client.schedulerResource.requeueAllExecutionRecords()
    );
  }

  /**
   * Resume all scheduling
   * @returns any OK
   * @throws ApiError
   */
  public resumeAllSchedules(): Promise<void> {
    return tryCatchReThrow(() =>
      this._client.schedulerResource.resumeAllSchedules()
    );
  }
}
