import type { ConductorLogger } from "../../helpers/logger";
import type { Task, TaskResult } from "../../../open-api";
import type { Client } from "../../../open-api/generated/client/types.gen";
import type { TaskRunnerEventsListener } from "./events";

export type TaskErrorHandler = (error: Error, task?: Task) => void;

/**
 * Return type for long-running tasks.
 *
 * When a worker returns this, the task is sent to Conductor with IN_PROGRESS status
 * and Conductor will re-queue the task after `callbackAfterSeconds`.
 *
 * @example
 * ```typescript
 * @worker({ taskDefName: "long_running_task" })
 * async function longTask(task: Task): Promise<TaskInProgressResult | TaskResult> {
 *   if (!isReady()) {
 *     return { status: "IN_PROGRESS", callbackAfterSeconds: 30, outputData: { progress: 50 } };
 *   }
 *   return { status: "COMPLETED", outputData: { result: "done" } };
 * }
 * ```
 */
export interface TaskInProgressResult {
  status: "IN_PROGRESS";
  callbackAfterSeconds: number;
  outputData?: Record<string, unknown>;
}

/**
 * Type guard for TaskInProgressResult.
 */
export function isTaskInProgress(
  result: unknown
): result is TaskInProgressResult {
  return (
    typeof result === "object" &&
    result !== null &&
    "status" in result &&
    (result as Record<string, unknown>).status === "IN_PROGRESS" &&
    "callbackAfterSeconds" in result &&
    typeof (result as Record<string, unknown>).callbackAfterSeconds === "number"
  );
}

export interface ConductorWorker {
  taskDefName: string;
  execute: (
    task: Task
  ) => Promise<
    Omit<TaskResult, "workflowInstanceId" | "taskId"> | TaskInProgressResult
  >;
  domain?: string;
  /** Number of polling instances to run concurrently */
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
  eventListeners?: TaskRunnerEventsListener[];
}

export interface PollerOptions {
  pollInterval?: number;
  concurrency: number;
  warnAtO?: number;
  /** Enable adaptive backoff for empty polls (default: true) */
  adaptiveBackoff?: boolean;
  /** Whether this poller is paused (default: false) */
  paused?: boolean;
}

/**
 * Configuration for health monitoring of worker processes.
 */
export interface HealthMonitorConfig {
  /** Interval between health checks in ms (default: 5000) */
  healthCheckIntervalMs?: number;
  /** Maximum restart attempts, 0 = unlimited (default: 0) */
  maxRestartAttempts?: number;
  /** Whether health monitoring is enabled (default: true) */
  enabled?: boolean;
}

export type TaskManagerOptions = TaskRunnerOptions;

export interface TaskManagerConfig {
  logger?: ConductorLogger;
  options?: Partial<TaskManagerOptions>;
  onError?: TaskErrorHandler;
  maxRetries?: number;
  eventListeners?: TaskRunnerEventsListener[];
}

export type OptionEntries = [
  keyof TaskRunnerOptions,
  string | number | undefined
][];
