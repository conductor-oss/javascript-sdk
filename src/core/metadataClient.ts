import { ConductorClient, TaskDef } from "../common";
import { WorkflowDef } from "../common/open-api";
import { tryCatchReThrow } from "./helpers";

export class MetadataClient {
  public readonly _client: ConductorClient;

  constructor(client: ConductorClient) {
    this._client = client;
  }

  /**
   * Unregisters an existing task definition by name
   *
   * @param name
   * @returns
   */
  public unregisterTask(name: string): Promise<void> {
    return tryCatchReThrow(() =>
      this._client.metadataResource.unregisterTaskDef(name)
    );
  }

  /**
   * Registers a new task definition
   *
   * @param taskDef
   * @returns
   */
  public registerTask(taskDef: TaskDef): Promise<void> {
    return tryCatchReThrow(() =>
      this._client.metadataResource.registerTaskDef([taskDef])
    );
  }

  /**
   * Update an existing task definition
   *
   * @param taskDef
   * @returns
   */
  public updateTask(taskDef: TaskDef): Promise<void> {
    return tryCatchReThrow(() =>
      this._client.metadataResource.updateTaskDef(taskDef)
    );
  }

  /**
   * Creates or updates (overwrite: true) a workflow definition
   *
   * @param workflowDef
   * @param overwrite
   * @returns
   */
  public registerWorkflowDef(
    workflowDef: WorkflowDef,
    overwrite = false
  ) {
    return tryCatchReThrow(() =>
      this._client.metadataResource.create(workflowDef, overwrite)
    );
  }

  /**
   * Unregister (overwrite: true) a workflow definition
   *
   * @param workflowDef
   * @param overwrite
   * @returns
   */
  public unregisterWorkflow(
      workflowName: string,
      version = 1,
  ) {
    return tryCatchReThrow(() =>
        this._client.metadataResource.unregisterWorkflowDef(workflowName, version)
    );
  }
}
