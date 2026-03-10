import { ConductorLogger, noopLogger } from "../../helpers/logger";
import type { Client, Task, TaskResult } from "../../../open-api";
import { TaskResource } from "../../../open-api/generated";
import { Poller } from "./Poller";
import {
  DEFAULT_POLL_INTERVAL,
  DEFAULT_BATCH_POLLING_TIMEOUT,
  DEFAULT_CONCURRENCY,
  MAX_RETRIES,
  DEFAULT_ERROR_MESSAGE,
} from "./constants";
import {
  TaskErrorHandler,
  TaskRunnerOptions,
  RunnerArgs,
  ConductorWorker,
  isTaskInProgress,
} from "./types";
import { noopErrorHandler, optionEquals } from "./helpers";
import { EventDispatcher } from "./events/EventDispatcher";
import { NonRetryableException } from "./exceptions";
import { runWithTaskContext } from "../../worker/context";

const defaultRunnerOptions: Required<TaskRunnerOptions> = {
  workerID: "",
  pollInterval: DEFAULT_POLL_INTERVAL,
  domain: undefined,
  concurrency: DEFAULT_CONCURRENCY,
  batchPollingTimeout: DEFAULT_BATCH_POLLING_TIMEOUT,
};

/**
 * Responsible for polling and executing tasks from a queue.
 *
 * Because a `poll` in conductor "pops" a task off of a conductor queue,
 * each runner participates in the poll -> work -> update loop.
 * We could potentially split this work into a separate "poller" and "worker" pools
 * but that could lead to picking up more work than the pool of workers are actually able to handle.
 *
 */
export class TaskRunner {
  _client: Client;
  worker: ConductorWorker;
  private logger: ConductorLogger;
  private options: TaskRunnerOptions;
  errorHandler: TaskErrorHandler;
  private poller: Poller<Task>;
  private maxRetries: number;
  private eventDispatcher: EventDispatcher;

  constructor({
    worker,
    client,
    options,
    logger = noopLogger,
    onError: errorHandler = noopErrorHandler,
    maxRetries = MAX_RETRIES,
    eventListeners = [],
  }: RunnerArgs) {
    this._client = client;
    this.maxRetries = maxRetries;
    this.logger = logger;
    this.worker = worker;
    this.options = { ...defaultRunnerOptions, ...options };
    this.errorHandler = errorHandler;

    // Initialize event dispatcher and register listeners
    this.eventDispatcher = new EventDispatcher(this.logger);
    eventListeners.forEach((listener) => {
      this.eventDispatcher.register(listener);
    });

    this.poller = new Poller(
      worker.taskDefName,
      this.batchPoll,
      this.executeTask,
      {
        concurrency: worker.concurrency ?? this.options.concurrency,
        pollInterval: worker.pollInterval ?? this.options.pollInterval,
      },
      this.logger
    );
  }

  get isPolling() {
    return this.poller.isPolling;
  }

  /**
   * Starts polling for work
   */
  startPolling = () => {
    this.poller.startPolling();
    this.logger.info(
      `TaskWorker ${this.worker.taskDefName} initialized with concurrency of ${this.poller.options.concurrency} and poll interval of ${this.poller.options.pollInterval}`
    );
  };
  /**
   * Stops Polling for work
   */
  stopPolling = async () => {
    await this.poller.stopPolling();
  };

  updateOptions(options: Partial<TaskRunnerOptions>) {
    const newOptions = { ...this.options, ...options };
    const isOptionsUpdated = !optionEquals(this.options, newOptions);

    if (isOptionsUpdated) {
      this.poller.updateOptions({
        concurrency: newOptions.concurrency,
        pollInterval: newOptions.pollInterval,
      });
      this.logger.info(
        `TaskWorker ${this.worker.taskDefName} configuration updated with concurrency of ${this.poller.options.concurrency} and poll interval of ${this.poller.options.pollInterval}`
      );
    }

    this.options = newOptions;
  }

  /** Pause or unpause the worker's polling */
  setPaused(paused: boolean): void {
    this.poller.updateOptions({ paused });
    this.logger.info(
      `Worker ${this.worker.taskDefName} ${paused ? "paused" : "resumed"}`
    );
  }

  get isPaused(): boolean {
    return this.poller.options.paused ?? false;
  }

  get getOptions(): TaskRunnerOptions {
    return this.options;
  }

  private batchPoll = async (count: number): Promise<Task[] | undefined> => {
    const { workerID } = this.options;
    const startTime = Date.now();

    // Publish PollStarted event
    await this.eventDispatcher.publishPollStarted({
      taskType: this.worker.taskDefName,
      workerId: workerID,
      pollCount: count,
      timestamp: new Date(),
    });

    try {
      const { data: tasks } = await TaskResource.batchPoll({
        client: this._client,
        path: {
          tasktype: this.worker.taskDefName,
        },
        query: {
          workerid: workerID,
          domain: this.worker.domain ?? this.options.domain,
          count,
          timeout: this.options.batchPollingTimeout ?? 100,
        },
      });

      const durationMs = Date.now() - startTime;

      // Publish PollCompleted event
      await this.eventDispatcher.publishPollCompleted({
        taskType: this.worker.taskDefName,
        durationMs,
        tasksReceived: tasks?.length ?? 0,
        timestamp: new Date(),
      });

      return tasks;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      // Publish PollFailure event
      await this.eventDispatcher.publishPollFailure({
        taskType: this.worker.taskDefName,
        durationMs,
        cause: error as Error,
        timestamp: new Date(),
      });

      throw error;
    }
  };

  updateTaskWithRetry = async (
    task: Task,
    taskResult: TaskResult
  ): Promise<Task | undefined> => {
    const { workerID } = this.options;
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount < this.maxRetries) {
      try {
        const updateStart = Date.now();
        const { data: nextTask } = await TaskResource.updateTaskV2({
          client: this._client,
          body: {
            ...taskResult,
            workerId: workerID,
          },
        });
        const updateDurationMs = Date.now() - updateStart;

        await this.eventDispatcher.publishTaskUpdateCompleted({
          taskType: this.worker.taskDefName,
          taskId: taskResult.taskId ?? "",
          workerId: workerID,
          workflowInstanceId: taskResult.workflowInstanceId,
          durationMs: updateDurationMs,
          timestamp: new Date(),
        });

        return nextTask ?? undefined;
      } catch (error: unknown) {
        lastError = error as Error;
        this.errorHandler(lastError, task);
        this.logger.error(
          `Error updating task ${taskResult.taskId} on retry ${retryCount + 1}/${this.maxRetries}`,
          error
        );
        retryCount++;

        if (retryCount < this.maxRetries) {
          // Exponential backoff: 10s, 20s, 30s
          const delayMs = retryCount * 10 * 1000;
          await new Promise((r) => setTimeout(() => r(true), delayMs));
        }
      }
    }

    // All retries exhausted - publish critical TaskUpdateFailure event
    this.logger.error(
      `CRITICAL: Task update failed after ${retryCount} retries. Task result LOST for task_id=${taskResult.taskId}`
    );

    await this.eventDispatcher.publishTaskUpdateFailure({
      taskType: this.worker.taskDefName,
      taskId: taskResult.taskId ?? "",
      workerId: workerID,
      workflowInstanceId: taskResult.workflowInstanceId,
      cause: lastError ?? new Error("Task update failed after all retries"),
      retryCount,
      taskResult,
      timestamp: new Date(),
    });

    return undefined;
  };

  private isValidTask(task: Task): boolean {
    return !!(task.workflowInstanceId && task.taskId);
  }

  /**
   * Entry point for task execution with V2 chaining.
   *
   * When updateTaskV2 returns a next task in its response, we immediately
   * execute it without going back through the poll cycle. This eliminates
   * one HTTP round-trip + sleep per task when there is a backlog.
   */
  private executeTask = async (task: Task) => {
    let currentTask: Task | undefined = task;

    while (currentTask) {
      if (!this.isValidTask(currentTask)) {
        this.logger.error(
          `Task missing required fields: workflowInstanceId=${currentTask.workflowInstanceId}, taskId=${currentTask.taskId}`
        );
        return;
      }

      const nextTask = await this.executeOneTask(currentTask);

      // Stop chaining if polling stopped or paused
      if (!this.isPolling || this.isPaused) {
        return;
      }

      // Yield to the event loop between chained tasks to prevent starvation
      if (nextTask) {
        this.logger.debug(
          `Chaining to next task ${nextTask.taskId} from V2 response (skipping poll cycle)`
        );
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }

      currentTask = nextTask;
    }
  };

  /**
   * Execute a single task and return the next task from V2 response (if any).
   */
  private executeOneTask = async (task: Task): Promise<Task | undefined> => {
    const { workerID } = this.options;
    // Safe: caller (executeTask) already validated these via isValidTask()
    const taskId = task.taskId as string;
    const workflowInstanceId = task.workflowInstanceId as string;
    const startTime = Date.now();

    // Publish TaskExecutionStarted event
    await this.eventDispatcher.publishTaskExecutionStarted({
      taskType: this.worker.taskDefName,
      taskId,
      workerId: workerID,
      workflowInstanceId,
      timestamp: new Date(),
    });

    try {
      // Wrap execution in TaskContext (AsyncLocalStorage)
      const { result, context } = await runWithTaskContext(
        task,
        async (ctx) => {
          const r = await this.worker.execute(task);
          return { result: r, context: ctx };
        }
      );

      const durationMs = Date.now() - startTime;

      // Handle TaskInProgress return
      if (isTaskInProgress(result)) {
        const contextLogs = context.getLogs();
        const nextTask = await this.updateTaskWithRetry(task, {
          workflowInstanceId,
          taskId,
          status: "IN_PROGRESS",
          callbackAfterSeconds: result.callbackAfterSeconds,
          outputData:
            result.outputData ?? context.getOutput() ?? {},
          logs: contextLogs.length > 0 ? contextLogs : undefined,
        });

        // Publish completion event for IN_PROGRESS
        await this.eventDispatcher.publishTaskExecutionCompleted({
          taskType: this.worker.taskDefName,
          taskId,
          workerId: workerID,
          workflowInstanceId,
          durationMs,
          timestamp: new Date(),
        });

        this.logger.debug(
          `Task ${taskId} returned IN_PROGRESS, callback after ${result.callbackAfterSeconds}s`
        );
        return nextTask;
      }

      // Regular completion path — merge context data
      const merged = { ...result };

      // Merge context logs
      const contextLogs = context.getLogs();
      if (contextLogs.length > 0) {
        merged.logs = [...(merged.logs ?? []), ...contextLogs];
      }

      // Merge context callbackAfterSeconds
      const ctxCallback = context.getCallbackAfterSeconds();
      if (
        ctxCallback !== undefined &&
        merged.callbackAfterSeconds === undefined
      ) {
        merged.callbackAfterSeconds = ctxCallback;
      }

      // Merge context output (context output is base, result output overrides)
      const ctxOutput = context.getOutput();
      if (ctxOutput !== undefined) {
        merged.outputData = { ...ctxOutput, ...merged.outputData };
      }

      // Calculate output size if possible
      const outputSizeBytes = merged.outputData
        ? JSON.stringify(merged.outputData).length
        : undefined;

      // Publish TaskExecutionCompleted event
      await this.eventDispatcher.publishTaskExecutionCompleted({
        taskType: this.worker.taskDefName,
        taskId,
        workerId: workerID,
        workflowInstanceId,
        durationMs,
        outputSizeBytes,
        timestamp: new Date(),
      });

      const nextTask = await this.updateTaskWithRetry(task, {
        ...merged,
        workflowInstanceId,
        taskId,
      });
      this.logger.debug(`Task has executed successfully ${taskId}`);
      return nextTask;
    } catch (error: unknown) {
      const durationMs = Date.now() - startTime;
      const err = error as Error;

      // Publish TaskExecutionFailure event
      await this.eventDispatcher.publishTaskExecutionFailure({
        taskType: this.worker.taskDefName,
        taskId,
        workerId: workerID,
        workflowInstanceId,
        cause: err,
        durationMs,
        timestamp: new Date(),
      });

      // Determine task status based on exception type
      const isNonRetryable = err instanceof NonRetryableException;
      const status = isNonRetryable ? "FAILED_WITH_TERMINAL_ERROR" : "FAILED";

      if (isNonRetryable) {
        this.logger.error(
          `Task ${taskId} failed with terminal error (no retry): ${err.message}`
        );
      }

      // Include error stack trace in task logs for debugging in Conductor UI
      const errorLogs = [
        {
          log: `${err.name}: ${err.message}${err.stack ? "\n" + err.stack : ""}`,
          createdTime: Date.now(),
          taskId,
        },
      ];

      const nextTask = await this.updateTaskWithRetry(task, {
        workflowInstanceId,
        taskId,
        reasonForIncompletion:
          (error as Record<string, string>)?.message ?? DEFAULT_ERROR_MESSAGE,
        status,
        outputData: {},
        logs: errorLogs,
      });
      this.errorHandler(err, task);
      this.logger.error(`Error executing ${taskId}`, error);

      // Even on failure, chain to next task — the failure was for THIS task
      return nextTask;
    }
  };

  handleUnknownError = (unknownError: unknown) => {
    let message = "";
    let stack: string | undefined = "";
    if (unknownError && typeof unknownError === "object") {
      if ("stack" in unknownError) {
        stack = (unknownError as Error).stack;
      }
      if ("message" in unknownError) {
        message = (unknownError as Error).message;
      }
    } else if (typeof unknownError === "string") {
      message = unknownError;
    }
    this.logger.error(
      `Error for ${this.worker.taskDefName}: error: ${message}, stack: ${stack}`
    );
  };
}
