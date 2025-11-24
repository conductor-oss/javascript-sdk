import type { ConductorLogger } from "../../helpers/logger";
import type { Task, TaskResult } from "../../../open-api";
import type { Client } from "../../../open-api/generated/client/types.gen";

export type TaskErrorHandler = (error: Error, task?: Task) => void;

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

export interface TaskRunnerOptions {
  workerID: string;
  domain: string | undefined;
  pollInterval?: number;
  concurrency?: number;
  batchPollingTimeout?: number;
}

export interface RunnerArgs {
  worker: ConductorWorker;
  client: Client;
  options: TaskRunnerOptions;
  logger?: ConductorLogger;
  onError?: TaskErrorHandler;
  concurrency?: number;
  maxRetries?: number;
}

export interface PollerOptions {
  pollInterval?: number;
  concurrency: number;
  warnAtO?: number;
}

export type TaskManagerOptions = TaskRunnerOptions;

export interface TaskManagerConfig {
  logger?: ConductorLogger;
  options?: Partial<TaskManagerOptions>;
  onError?: TaskErrorHandler;
  maxRetries?: number;
}

export type OptionEntries = [
  keyof TaskRunnerOptions,
  string | number | undefined
][];
