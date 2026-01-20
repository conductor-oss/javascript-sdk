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
} from "./types";
import { noopErrorHandler, optionEquals } from "./helpers";
import { EventDispatcher } from "./events/EventDispatcher";
import { NonRetryableException } from "./exceptions";

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
    this.eventDispatcher = new EventDispatcher();
    eventListeners.forEach((listener) => {
      this.eventDispatcher.register(listener);
    });
    
    this.poller = new Poller(
      worker.taskDefName,
      this.batchPoll,
      this.executeTask,
      {
        concurrency: worker.concurrency ?? options.concurrency,
        pollInterval: worker.pollInterval ?? options.pollInterval,
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

  updateTaskWithRetry = async (task: Task, taskResult: TaskResult) => {
    const { workerID } = this.options;
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount < this.maxRetries) {
      try {
        await TaskResource.updateTask({
          client: this._client,
          body: {
            ...taskResult,
            workerId: workerID,
          },
        });

        return; // Success
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
      cause: lastError!,
      retryCount,
      taskResult,
      timestamp: new Date(),
    });
  };

  private executeTask = async (task: Task) => {
    if (!task.workflowInstanceId || !task.taskId) {
      this.logger.error(
        `Task missing required fields: workflowInstanceId=${task.workflowInstanceId}, taskId=${task.taskId}`
      );
      return;
    }

    const { workerID } = this.options;
    const startTime = Date.now();

    // Publish TaskExecutionStarted event
    await this.eventDispatcher.publishTaskExecutionStarted({
      taskType: this.worker.taskDefName,
      taskId: task.taskId,
      workerId: workerID,
      workflowInstanceId: task.workflowInstanceId,
      timestamp: new Date(),
    });

    try {
      const result = await this.worker.execute(task);
      const durationMs = Date.now() - startTime;

      // Calculate output size if possible
      const outputSizeBytes = result.outputData
        ? JSON.stringify(result.outputData).length
        : undefined;

      // Publish TaskExecutionCompleted event
      await this.eventDispatcher.publishTaskExecutionCompleted({
        taskType: this.worker.taskDefName,
        taskId: task.taskId,
        workerId: workerID,
        workflowInstanceId: task.workflowInstanceId,
        durationMs,
        outputSizeBytes,
        timestamp: new Date(),
      });

      await this.updateTaskWithRetry(task, {
        ...result,
        workflowInstanceId: task.workflowInstanceId,
        taskId: task.taskId,
      });
      this.logger.debug(`Task has executed successfully ${task.taskId}`);
    } catch (error: unknown) {
      const durationMs = Date.now() - startTime;
      const err = error as Error;

      // Publish TaskExecutionFailure event
      await this.eventDispatcher.publishTaskExecutionFailure({
        taskType: this.worker.taskDefName,
        taskId: task.taskId,
        workerId: workerID,
        workflowInstanceId: task.workflowInstanceId,
        cause: err,
        durationMs,
        timestamp: new Date(),
      });

      // Determine task status based on exception type
      const isNonRetryable = err instanceof NonRetryableException;
      const status = isNonRetryable ? "FAILED_WITH_TERMINAL_ERROR" : "FAILED";

      if (isNonRetryable) {
        this.logger.error(
          `Task ${task.taskId} failed with terminal error (no retry): ${err.message}`
        );
      }

      await this.updateTaskWithRetry(task, {
        workflowInstanceId: task.workflowInstanceId,
        taskId: task.taskId,
        reasonForIncompletion:
          (error as Record<string, string>)?.message ?? DEFAULT_ERROR_MESSAGE,
        status,
        outputData: {},
      });
      this.errorHandler(err, task);
      this.logger.error(`Error executing ${task.taskId}`, error);
    }
  };

  handleUnknownError = (unknownError: unknown) => {
    let message = "";
    let stack: string | undefined = "";
    if ((unknownError as Error).stack) {
      stack = (unknownError as Error).stack;
    }
    if ((unknownError as Error).message) {
      message = (unknownError as Error).message;
    }
    this.logger.error(
      `Error for ${this.worker.taskDefName}: error: ${message}, stack: ${stack}`
    );
  };
}
