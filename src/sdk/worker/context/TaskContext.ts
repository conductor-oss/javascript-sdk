import { AsyncLocalStorage } from "node:async_hooks";
import type { Task, TaskExecLog } from "../../../open-api";

/**
 * TaskContext provides async-local context during task execution.
 *
 * This is the JavaScript equivalent of Python's contextvars-based
 * `get_task_context()`. Each task execution runs in its own async context,
 * so `getTaskContext()` returns the context for the currently executing task.
 *
 * @example
 * ```typescript
 * @worker({ taskDefName: "my_task" })
 * async function myTask(task: Task) {
 *   const ctx = getTaskContext();
 *   ctx?.addLog("Starting processing");
 *
 *   if (needsMoreTime) {
 *     ctx?.setCallbackAfter(30);
 *     return { status: "IN_PROGRESS", callbackAfterSeconds: 30 };
 *   }
 *
 *   return { status: "COMPLETED", outputData: { result: "done" } };
 * }
 * ```
 */
export class TaskContext {
  private _task: Task;
  private _logs: TaskExecLog[] = [];
  private _callbackAfterSeconds?: number;
  private _output?: Record<string, unknown>;

  constructor(task: Task) {
    this._task = task;
  }

  /** Get the task ID */
  getTaskId(): string | undefined {
    return this._task.taskId;
  }

  /** Get the workflow instance ID */
  getWorkflowInstanceId(): string | undefined {
    return this._task.workflowInstanceId;
  }

  /** Get the retry count for this task (0 for first attempt) */
  getRetryCount(): number {
    return this._task.retryCount ?? 0;
  }

  /** Get the poll count for this task */
  getPollCount(): number {
    return this._task.pollCount ?? 0;
  }

  /** Get the full task input data */
  getInput(): Record<string, unknown> {
    return this._task.inputData ?? {};
  }

  /** Get the task definition name */
  getTaskDefName(): string | undefined {
    return this._task.taskDefName;
  }

  /** Get the workflow task type (e.g., SIMPLE, HTTP, SUB_WORKFLOW) */
  getWorkflowTaskType(): string | undefined {
    return this._task.taskType;
  }

  /** Get the full task object */
  getTask(): Task {
    return this._task;
  }

  /**
   * Add an execution log entry.
   * Logs are merged into the task result when execution completes.
   */
  addLog(message: string): void {
    this._logs.push({
      log: message,
      createdTime: Date.now(),
      taskId: this._task.taskId,
    });
  }

  /** Get all accumulated logs */
  getLogs(): TaskExecLog[] {
    return [...this._logs];
  }

  /**
   * Set callback-after seconds.
   * Tells Conductor to re-queue the task after the specified number of seconds.
   */
  setCallbackAfter(seconds: number): void {
    this._callbackAfterSeconds = seconds;
  }

  /** Get the callback-after value (if set) */
  getCallbackAfterSeconds(): number | undefined {
    return this._callbackAfterSeconds;
  }

  /**
   * Set intermediate output data.
   * Merged into the final task result.
   */
  setOutput(data: Record<string, unknown>): void {
    this._output = data;
  }

  /** Get intermediate output data (if set) */
  getOutput(): Record<string, unknown> | undefined {
    return this._output;
  }
}

// AsyncLocalStorage instance — one per process
const taskContextStorage = new AsyncLocalStorage<TaskContext>();

/**
 * Get the current task context.
 *
 * Must be called from within a task execution callback.
 * Returns `undefined` if called outside of a task execution.
 */
export function getTaskContext(): TaskContext | undefined {
  return taskContextStorage.getStore();
}

/**
 * Run a function within a task context.
 * Used internally by TaskRunner to wrap task execution.
 *
 * @internal
 */
export function runWithTaskContext<T>(
  task: Task,
  fn: (ctx: TaskContext) => Promise<T>
): Promise<T> {
  const context = new TaskContext(task);
  return taskContextStorage.run(context, () => fn(context));
}
