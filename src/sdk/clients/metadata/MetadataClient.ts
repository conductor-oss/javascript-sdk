import { MetadataResource, Tags } from "../../../open-api/generated";
import { handleSdkError } from "../../helpers/errors";
import type {
  Client,
  ExtendedTaskDef,
  ExtendedWorkflowDef,
  RateLimitConfig,
  Tag,
  TaskDef,
  WorkflowDef,
} from "../../../open-api";
import type { ExtendedRateLimitConfig } from "../../../open-api/types";
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

  /**
   * Get all task definitions
   * @returns Array of all task definitions
   */
  public async getAllTaskDefs(): Promise<TaskDef[]> {
    try {
      const { data } = await MetadataResource.getTaskDefs({
        client: this._client,
        throwOnError: true,
      });
      return data as TaskDef[];
    } catch (error: unknown) {
      handleSdkError(error, "Failed to get all task definitions");
    }
  }

  /**
   * Get all workflow definitions
   * @returns Array of all workflow definitions
   */
  public async getAllWorkflowDefs(): Promise<WorkflowDef[]> {
    try {
      const { data } = await MetadataResource.getWorkflowDefs({
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, "Failed to get all workflow definitions");
    }
  }

  /**
   * Add a tag to a workflow definition
   * @param tag - The tag to add
   * @param name - The workflow definition name
   */
  public async addWorkflowTag(tag: Tag, name: string): Promise<void> {
    try {
      await Tags.addWorkflowTag({
        path: { name },
        body: tag,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to add tag to workflow '${name}'`
      );
    }
  }

  /**
   * Delete a tag from a workflow definition
   * @param tag - The tag to delete
   * @param name - The workflow definition name
   */
  public async deleteWorkflowTag(tag: Tag, name: string): Promise<void> {
    try {
      await Tags.deleteWorkflowTag({
        path: { name },
        body: tag,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to delete tag from workflow '${name}'`
      );
    }
  }

  /**
   * Get all tags for a workflow definition
   * @param name - The workflow definition name
   * @returns Array of tags
   */
  public async getWorkflowTags(name: string): Promise<Tag[]> {
    try {
      const { data } = await Tags.getWorkflowTags({
        path: { name },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to get tags for workflow '${name}'`
      );
    }
  }

  /**
   * Set (replace all existing) tags for a workflow definition
   * @param tags - The tags to set
   * @param name - The workflow definition name
   */
  public async setWorkflowTags(tags: Tag[], name: string): Promise<void> {
    try {
      await Tags.setWorkflowTags({
        path: { name },
        body: tags,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to set tags for workflow '${name}'`
      );
    }
  }

  /**
   * Add a tag to a task definition
   * @param tag - The tag to add
   * @param taskName - The task definition name
   */
  public async addTaskTag(tag: Tag, taskName: string): Promise<void> {
    try {
      await Tags.addTaskTag({
        path: { taskName },
        body: tag,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to add tag to task '${taskName}'`
      );
    }
  }

  /**
   * Delete a tag from a task definition
   * @param tag - The tag to delete
   * @param taskName - The task definition name
   */
  public async deleteTaskTag(tag: Tag, taskName: string): Promise<void> {
    try {
      await Tags.deleteTaskTag({
        path: { taskName },
        body: tag,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to delete tag from task '${taskName}'`
      );
    }
  }

  /**
   * Get all tags for a task definition
   * @param taskName - The task definition name
   * @returns Array of tags
   */
  public async getTaskTags(taskName: string): Promise<Tag[]> {
    try {
      const { data } = await Tags.getTaskTags({
        path: { taskName },
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to get tags for task '${taskName}'`
      );
    }
  }

  /**
   * Set (replace all existing) tags for a task definition
   * @param tags - The tags to set
   * @param taskName - The task definition name
   */
  public async setTaskTags(tags: Tag[], taskName: string): Promise<void> {
    try {
      await Tags.setTaskTags({
        path: { taskName },
        body: tags,
        client: this._client,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to set tags for task '${taskName}'`
      );
    }
  }

  // ── Rate Limit APIs ────────────────────────────────────────────
  // These endpoints are not in the OpenAPI spec yet, so we use raw
  // HTTP calls matching the Python SDK's MetadataClient.

  /**
   * Set the rate limit configuration for a workflow
   * @param rateLimitConfig - Rate limit configuration
   * @param name - Workflow definition name
   */
  public async setWorkflowRateLimit(
    rateLimitConfig: RateLimitConfig | ExtendedRateLimitConfig,
    name: string
  ): Promise<void> {
    try {
      await this._client.put({
        url: `/api/metadata/workflow/${encodeURIComponent(name)}/rate-limit`,
        body: rateLimitConfig,
        headers: { "Content-Type": "application/json" },
        security: [{ name: "X-Authorization", type: "apiKey" }],
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to set rate limit for workflow '${name}'`
      );
    }
  }

  /**
   * Get the rate limit configuration for a workflow
   * @param name - Workflow definition name
   * @returns Rate limit configuration or undefined if not set
   */
  public async getWorkflowRateLimit(
    name: string
  ): Promise<RateLimitConfig | ExtendedRateLimitConfig | undefined> {
    try {
      const { data } = await this._client.get({
        url: `/api/metadata/workflow/${encodeURIComponent(name)}/rate-limit`,
        security: [{ name: "X-Authorization", type: "apiKey" }],
        throwOnError: true,
      });
      return data as RateLimitConfig;
    } catch (error: unknown) {
      // 404 means no rate limit set — return undefined
      const status =
        error && typeof error === "object" && "status" in error
          ? (error as { status: number }).status
          : undefined;
      if (status === 404) {
        return undefined;
      }
      handleSdkError(
        error,
        `Failed to get rate limit for workflow '${name}'`
      );
    }
  }

  /**
   * Remove the rate limit configuration for a workflow
   * @param name - Workflow definition name
   */
  public async removeWorkflowRateLimit(name: string): Promise<void> {
    try {
      await this._client.delete({
        url: `/api/metadata/workflow/${encodeURIComponent(name)}/rate-limit`,
        security: [{ name: "X-Authorization", type: "apiKey" }],
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to remove rate limit for workflow '${name}'`
      );
    }
  }
}
