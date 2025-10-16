import { MetadataResource } from "../common/open-api/sdk.gen";
import { Client } from "../common/open-api/client";
import { tryCatchReThrow } from "./helpers";
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
  public unregisterTask(name: string): Promise<void> {
    return tryCatchReThrow(async () => {
      await MetadataResource.unregisterTaskDef({
        path: { tasktype: name },
        client: this._client,
      });
    });
  }

  /**
   * Registers a new task definition
   *
   * @param taskDef
   * @returns
   */
  public registerTask(taskDef: ExtendedTaskDef): Promise<void> {
    return this.registerTasks([taskDef]);
  }

  /**
   * Registers multiple task definitions (array)
   *
   * @param taskDefs
   * @returns
   */
  public registerTasks(taskDefs: ExtendedTaskDef[]): Promise<void> {
    return tryCatchReThrow(async () => {
      await MetadataResource.registerTaskDef({
        body: [...(taskDefs as OpenApiExtendedTaskDef[])],
        client: this._client,
      });
    });
  }

  /**
   * Update an existing task definition
   *
   * @param taskDef
   * @returns
   */
  public updateTask(taskDef: ExtendedTaskDef): Promise<void> {
    return tryCatchReThrow(async () => {
      await MetadataResource.updateTaskDef({
        body: taskDef as OpenApiExtendedTaskDef,
        client: this._client,
      });
    });
  }

  /**
   * Get an existing task definition
   *
   * @param taskName
   * @returns
   */
  public async getTask(taskName: string): Promise<TaskDef | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await MetadataResource.getTaskDef({
        path: { tasktype: taskName },
        client: this._client,
      });

      return data as TaskDef; //todo: remove casting after OpenApi spec is fixed
    });
  }

  /**
   * Creates or updates (overwrite: true) a workflow definition
   *
   * @param workflowDef
   * @param overwrite
   * @returns
   */
  public registerWorkflowDef(
    workflowDef: ExtendedWorkflowDef,
    overwrite = false
  ): Promise<void> {
    return tryCatchReThrow(async () => {
      await MetadataResource.create({
        body: workflowDef,
        query: {
          overwrite,
        },
        client: this._client,
      });
    });
  }

  /**
   * Creates or updates (overwrite: true) a workflow definition
   *
   * @param workflowDef
   * @param overwrite
   * @returns
   */
  public getWorkflowDef(
    name: string,
    version?: number,
    metadata = false
  ): Promise<WorkflowDef | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await MetadataResource.get1({
        path: { name },
        query: { metadata, version },
        client: this._client,
      });

      return data;
    });
  }

  /**
   * Unregister (overwrite: true) a workflow definition
   *
   * @param workflowDef
   * @param overwrite
   * @returns
   */
  public unregisterWorkflow(workflowName: string, version = 1): Promise<void> {
    return tryCatchReThrow(async () => {
      await MetadataResource.unregisterWorkflowDef({
        path: { name: workflowName, version },
        client: this._client,
      });
    });
  }
}
