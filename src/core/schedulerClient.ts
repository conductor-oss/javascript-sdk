import {
  SaveScheduleRequest,
  SearchResultWorkflowScheduleExecutionModel,
  WorkflowSchedule,
  WorkflowScheduleModel,
} from "../common";
import { SchedulerResource } from "../common/open-api/sdk.gen";
import { Client } from "../common/open-api/client/types.gen";
import { errorMapper } from "./helpers";

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
  public async saveSchedule(param: SaveScheduleRequest): Promise<void> {
    try {
      await SchedulerResource.saveSchedule({
        body: param,
        client: this._client,
      });
    } catch (error: unknown) {
      throw errorMapper(error);
    }
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
    size = 100,
    sort = "",
    freeText = "*",
    query?: string
  ): Promise<SearchResultWorkflowScheduleExecutionModel | undefined> {
    try {
      const { data } = await SchedulerResource.searchV2({
        query: { start, size, sort, freeText, query },
        client: this._client,
      });

      return data;
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Get an existing schedule by name
   * @param name
   * @returns WorkflowSchedule
   */
  public async getSchedule(name: string): Promise<WorkflowSchedule | undefined> {
    try {
      const { data } = await SchedulerResource.getSchedule({
        path: { name },
        client: this._client,
      });

      return data;
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Pauses an existing schedule by name
   * @param name
   * @returns
   */
  public async pauseSchedule(name: string): Promise<void> {
    try {
      await SchedulerResource.pauseSchedule({
        path: { name },
        client: this._client,
      });
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Resume a paused schedule by name
   *
   * @param name
   * @returns
   */
  public async resumeSchedule(name: string): Promise<void> {
    try {
      await SchedulerResource.resumeSchedule({
        path: { name },
        client: this._client,
      });
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Deletes an existing scheduler execution by name
   *
   * @param name
   * @returns
   */
  public async deleteSchedule(name: string): Promise<void> {
    try {
      await SchedulerResource.deleteSchedule({
        path: { name },
        client: this._client,
      });
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Get all existing workflow schedules and optionally filter by workflow name
   * @param workflowName
   * @returns Array<WorkflowScheduleModel>
   */
  public async getAllSchedules(
    workflowName?: string
  ): Promise<WorkflowScheduleModel[] | undefined> {
    try {
      const { data } = await SchedulerResource.getAllSchedules({
        query: { workflowName },
        client: this._client,
      });

      return data;
    } catch (error: unknown) {
      throw errorMapper(error);
    }
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
  public async getNextFewSchedules(
    cronExpression: string,
    scheduleStartTime?: number,
    scheduleEndTime?: number,
    limit = 3
  ): Promise<number[] | undefined> {
    try {
      const { data } = await SchedulerResource.getNextFewSchedules({
        query: { cronExpression, scheduleStartTime, scheduleEndTime, limit },
        client: this._client,
      });

      return data;
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Pause all scheduling in a single conductor server instance (for debugging only)
   * @returns any OK
   * @throws ApiError
   */
  public async pauseAllSchedules(): Promise<void> {
    try {
      await SchedulerResource.pauseAllSchedules({
        client: this._client,
      });
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Requeue all execution records
   * @returns any OK
   * @throws ApiError
   */
  public async requeueAllExecutionRecords(): Promise<void> {
    try {
      await SchedulerResource.requeueAllExecutionRecords({
        client: this._client,
      });
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Resume all scheduling
   * @returns any OK
   * @throws ApiError
   */
  public async resumeAllSchedules(): Promise<void> {
    try {
      await SchedulerResource.resumeAllSchedules({
        client: this._client,
      });
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }
}
