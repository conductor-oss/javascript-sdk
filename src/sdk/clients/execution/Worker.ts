import type { Task, TaskResult } from "../../../open-api";

/**
 * Functional interface for defining a worker implementation that processes tasks from a conductor queue.
 *
 * @remarks
 * Optional items allow overriding properties on a per-worker basis. Items not overridden
 * here will be inherited from the `TaskManager` options.
 */
export interface ConductorWorker {
  taskDefName: string;
  execute: (
    task: Task
  ) => Promise<Omit<TaskResult, "workflowInstanceId" | "taskId">>;
  domain?: string;
  /*
  Number of polling instances to run concurrently
   */
  concurrency?: number;
  pollInterval?: number;
}
