import { MetadataResource } from "../common/open-api/sdk.gen";
import { Client } from "../common/open-api/client";
import { errorMapper } from "./helpers";
import {
  ExtendedWorkflowDef,
  TaskDef,
  WorkflowDef,
} from "../common/open-api/types.gen";
import type { ExtendedTaskDef, OpenApiExtendedTaskDef } from "../common";

export class MetadataClient {
  public readonly _client: Client;

  constructor(client: Client) {
    this._client = client;
  }

  /**
   * Unregisters an existing task definition by name
   *
   * @param name
   * @returns
   */
  public async unregisterTask(name: string): Promise<void> {
    try {
      await MetadataResource.unregisterTaskDef({
        path: { tasktype: name },
        client: this._client,
      });
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Registers a new task definition
   *
   * @param taskDef
   * @returns
   */
  public async registerTask(taskDef: ExtendedTaskDef): Promise<void> {
    return this.registerTasks([taskDef]);
  }

  /**
   * Registers multiple task definitions (array)
   *
   * @param taskDefs
   * @returns
   */
  public async registerTasks(taskDefs: ExtendedTaskDef[]): Promise<void> {
    try {
      await MetadataResource.registerTaskDef({
        body: [...(taskDefs as OpenApiExtendedTaskDef[])],
        client: this._client,
      });
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Update an existing task definition
   *
   * @param taskDef
   * @returns
   */
  public async updateTask(taskDef: ExtendedTaskDef): Promise<void> {
    try {
      await MetadataResource.updateTaskDef({
        body: taskDef as OpenApiExtendedTaskDef,
        client: this._client,
      });
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Get an existing task definition
   *
   * @param taskName
   * @returns
   */
  public async getTask(taskName: string): Promise<TaskDef | undefined> {
    try {
      const { data } = await MetadataResource.getTaskDef({
        path: { tasktype: taskName },
        client: this._client,
      });

      return data as TaskDef; //todo: remove casting after OpenApi spec is fixed
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Creates or updates (overwrite: true) a workflow definition
   *
   * @param workflowDef
   * @param overwrite
   * @returns
   */
  public async registerWorkflowDef(
    workflowDef: ExtendedWorkflowDef,
    overwrite = false
  ): Promise<void> {
    try {
      await MetadataResource.create({
        body: workflowDef,
        query: {
          overwrite,
        },
        client: this._client,
      });
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Creates or updates (overwrite: true) a workflow definition
   *
   * @param workflowDef
   * @param overwrite
   * @returns
   */
  public async getWorkflowDef(
    name: string,
    version?: number,
    metadata = false
  ): Promise<WorkflowDef | undefined> {
    try {
      const { data } = await MetadataResource.get1({
        path: { name },
        query: { metadata, version },
        client: this._client,
      });

      return data;
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Unregister (overwrite: true) a workflow definition
   *
   * @param workflowDef
   * @param overwrite
   * @returns
   */
  public async unregisterWorkflow(workflowName: string, version = 1): Promise<void> {
    try {
      await MetadataResource.unregisterWorkflowDef({
        path: { name: workflowName, version },
        client: this._client,
      });
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }
}
