/**
 * Event types for task runner lifecycle events.
 * 
 * These events provide observability into the worker polling and execution lifecycle,
 * matching the Python SDK's event system architecture.
 */

/**
 * Base interface for all task runner events.
 */
export interface TaskRunnerEvent {
  /** The task definition name */
  taskType: string;
  /** UTC timestamp when the event was created */
  timestamp: Date;
}

/**
 * Event published when task polling begins.
 */
export interface PollStarted extends TaskRunnerEvent {
  /** Identifier of the worker polling for tasks */
  workerId: string;
  /** Number of tasks requested in this poll */
  pollCount: number;
}

/**
 * Event published when task polling completes successfully.
 */
export interface PollCompleted extends TaskRunnerEvent {
  /** Time taken for the poll operation in milliseconds */
  durationMs: number;
  /** Number of tasks received from the poll */
  tasksReceived: number;
}

/**
 * Event published when task polling fails.
 */
export interface PollFailure extends TaskRunnerEvent {
  /** Time taken before the poll failed in milliseconds */
  durationMs: number;
  /** The error that caused the failure */
  cause: Error;
}

/**
 * Event published when task execution begins.
 */
export interface TaskExecutionStarted extends TaskRunnerEvent {
  /** Unique identifier of the task instance */
  taskId: string;
  /** Identifier of the worker executing the task */
  workerId: string;
  /** ID of the workflow instance this task belongs to */
  workflowInstanceId?: string;
}

/**
 * Event published when task execution completes successfully.
 */
export interface TaskExecutionCompleted extends TaskRunnerEvent {
  /** Unique identifier of the task instance */
  taskId: string;
  /** Identifier of the worker that executed the task */
  workerId: string;
  /** ID of the workflow instance this task belongs to */
  workflowInstanceId?: string;
  /** Time taken for task execution in milliseconds */
  durationMs: number;
  /** Size of the task output in bytes (if available) */
  outputSizeBytes?: number;
}

/**
 * Event published when task execution fails.
 */
export interface TaskExecutionFailure extends TaskRunnerEvent {
  /** Unique identifier of the task instance */
  taskId: string;
  /** Identifier of the worker that attempted execution */
  workerId: string;
  /** ID of the workflow instance this task belongs to */
  workflowInstanceId?: string;
  /** The error that caused the failure */
  cause: Error;
  /** Time taken before failure in milliseconds */
  durationMs: number;
}

/**
 * Event published when task update fails after all retry attempts.
 * 
 * This is a CRITICAL event indicating that the worker successfully executed a task
 * but failed to communicate the result back to Conductor after multiple retries.
 * 
 * The task result is lost from Conductor's perspective, and external intervention
 * may be required to reconcile the state.
 * 
 * Use Cases:
 * - Alert operations team of critical update failures
 * - Log failed task results to external storage for recovery
 * - Implement custom retry logic with different backoff strategies
 * - Track update reliability metrics
 * - Trigger incident response workflows
 */
export interface TaskUpdateFailure extends TaskRunnerEvent {
  /** Unique identifier of the task instance */
  taskId: string;
  /** Identifier of the worker that executed the task */
  workerId: string;
  /** ID of the workflow instance this task belongs to */
  workflowInstanceId?: string;
  /** The error that caused the final update failure */
  cause: Error;
  /** Number of retry attempts made */
  retryCount: number;
  /** The TaskResult object that failed to update (for recovery/logging) */
  taskResult: unknown; // Using unknown to avoid circular dependency with TaskResult type
}

/**
 * Union type of all task runner events.
 */
export type TaskRunnerEventType =
  | PollStarted
  | PollCompleted
  | PollFailure
  | TaskExecutionStarted
  | TaskExecutionCompleted
  | TaskExecutionFailure
  | TaskUpdateFailure;
