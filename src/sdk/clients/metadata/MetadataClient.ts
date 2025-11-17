import { MetadataResource } from "../../../open-api/generated";
import type { Client } from "../../../open-api/generated/client/types.gen";
import { handleSdkError } from "../../helpers/errors";
import type {
  ExtendedTaskDef,
  ExtendedWorkflowDef,
  TaskDef,
  WorkflowDef,
} from "../../../open-api";
import type { ExtendedTaskDef as OpenApiExtendedTaskDef } from "../../../open-api/generated/types.gen";

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
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to unregister task '${name}'`);
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
        body: [...(taskDefs as OpenApiExtendedTaskDef[])], // todo: remove casting after OpenApi spec is fixed
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, "Failed to register task definitions");
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
        body: taskDef as OpenApiExtendedTaskDef, // todo: remove casting after OpenApi spec is fixed
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, "Failed to update task definition");
    }
  }

  /**
   * Get an existing task definition
   *
   * @param taskName
   * @returns
   */
  public async getTask(taskName: string): Promise<TaskDef> {
    try {
      const { data } = await MetadataResource.getTaskDef({
        path: { tasktype: taskName },
        client: this._client,
        throwOnError: true,
      });

      return data as TaskDef; // todo: remove casting after OpenApi spec is fixed
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get task '${taskName}'`);
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
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, "Failed to register workflow definition");
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
  ): Promise<WorkflowDef> {
    try {
      const { data } = await MetadataResource.get1({
        path: { name },
        query: { metadata, version },
        client: this._client,
        throwOnError: true,
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get workflow definition '${name}'`);
    }
  }

  /**
   * Unregister (overwrite: true) a workflow definition
   *
   * @param workflowDef
   * @param overwrite
   * @returns
   */
  public async unregisterWorkflow(
    workflowName: string,
    version = 1
  ): Promise<void> {
    try {
      await MetadataResource.unregisterWorkflowDef({
        path: { name: workflowName, version },
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to unregister workflow '${workflowName}'`);
    }
  }
}
