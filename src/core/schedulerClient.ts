import {
  SaveScheduleRequest,
  SearchResultWorkflowScheduleExecutionModel,
  WorkflowSchedule,
  WorkflowScheduleModel,
} from "../common";
import { SchedulerResource } from "../common/open-api/sdk.gen";
import { Client } from "../common/open-api/client/types.gen";
import { tryCatchReThrow } from "./helpers";

export class SchedulerClient {
  public readonly _client: Client;

  constructor(client: Client) {
    this._client = client;
  }

  /**
   * Create or update a schedule for a specified workflow with a corresponding start workflow request
   * @param requestBody
   * @returns
   */
  public saveSchedule(param: SaveScheduleRequest): Promise<void> {
    return tryCatchReThrow(async () => {
      await SchedulerResource.saveSchedule({
        body: param,
        client: this._client,
      });
    });
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
    size = 100,
    sort = "",
    freeText = "*",
    query?: string
  ): Promise<SearchResultWorkflowScheduleExecutionModel | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await SchedulerResource.searchV2({
        query: { start, size, sort, freeText, query },
        client: this._client,
      });

      return data;
    });
  }

  /**
   * Get an existing schedule by name
   * @param name
   * @returns WorkflowSchedule
   */
  public getSchedule(name: string): Promise<WorkflowSchedule | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await SchedulerResource.getSchedule({
        path: { name },
        client: this._client,
      });

      return data;
    });
  }

  /**
   * Pauses an existing schedule by name
   * @param name
   * @returns
   */
  public pauseSchedule(name: string): Promise<void> {
    return tryCatchReThrow(async () => {
      await SchedulerResource.pauseSchedule({
        path: { name },
        client: this._client,
      });
    });
  }

  /**
   * Resume a paused schedule by name
   *
   * @param name
   * @returns
   */
  public resumeSchedule(name: string): Promise<void> {
    return tryCatchReThrow(async () => {
      await SchedulerResource.resumeSchedule({
        path: { name },
        client: this._client,
      });
    });
  }

  /**
   * Deletes an existing scheduler execution by name
   *
   * @param name
   * @returns
   */
  public deleteSchedule(name: string): Promise<void> {
    return tryCatchReThrow(async () => {
      await SchedulerResource.deleteSchedule({
        path: { name },
        client: this._client,
      });
    });
  }

  /**
   * Get all existing workflow schedules and optionally filter by workflow name
   * @param workflowName
   * @returns Array<WorkflowScheduleModel>
   */
  public getAllSchedules(
    workflowName?: string
  ): Promise<WorkflowScheduleModel[] | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await SchedulerResource.getAllSchedules({
        query: { workflowName },
        client: this._client,
      });

      return data;
    });
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
  ): Promise<number[] | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await SchedulerResource.getNextFewSchedules({
        query: { cronExpression, scheduleStartTime, scheduleEndTime, limit },
        client: this._client,
      });

      return data;
    });
  }

  /**
   * Pause all scheduling in a single conductor server instance (for debugging only)
   * @returns any OK
   * @throws ApiError
   */
  public pauseAllSchedules(): Promise<void> {
    return tryCatchReThrow(async () => {
      await SchedulerResource.pauseAllSchedules({
        client: this._client,
      });
    });
  }

  /**
   * Requeue all execution records
   * @returns any OK
   * @throws ApiError
   */
  public requeueAllExecutionRecords(): Promise<void> {
    return tryCatchReThrow(async () => {
      await SchedulerResource.requeueAllExecutionRecords({
        client: this._client,
      });
    });
  }

  /**
   * Resume all scheduling
   * @returns any OK
   * @throws ApiError
   */
  public resumeAllSchedules(): Promise<void> {
    return tryCatchReThrow(async () => {
      await SchedulerResource.resumeAllSchedules({
        client: this._client,
      });
    });
  }
}
