import os from "os";
import { TaskRunner, noopErrorHandler, MAX_RETRIES } from "./TaskRunner";
import { ConductorLogger, DefaultLogger } from "../common";
import { ConductorWorker } from "./Worker";
import { ConductorClient } from "../common/open-api";
import {
  DEFAULT_POLL_INTERVAL,
  DEFAULT_BATCH_POLLING_TIMEOUT,
  DEFAULT_CONCURRENCY,
} from "./constants";
import { TaskErrorHandler, TaskRunnerOptions } from "./types";

export type TaskManagerOptions = TaskRunnerOptions;

export interface TaskManagerConfig {
  logger?: ConductorLogger;
  options?: Partial<TaskManagerOptions>;
  onError?: TaskErrorHandler;
  maxRetries?: number;
}

const defaultManagerOptions: Required<TaskManagerOptions> = {
  workerID: "",
  pollInterval: DEFAULT_POLL_INTERVAL,
  domain: undefined,
  concurrency: DEFAULT_CONCURRENCY,
  batchPollingTimeout: DEFAULT_BATCH_POLLING_TIMEOUT,
};

function workerId(options: Partial<TaskManagerOptions>) {
  return options.workerID ?? os.hostname();
}

/**
 * Responsible for initializing and managing the runners that poll and work different task queues.
 */
export class TaskManager {
  private workerRunners: Map<string, TaskRunner> = new Map();
  private readonly client: ConductorClient;
  private readonly logger: ConductorLogger;
  private readonly errorHandler: TaskErrorHandler;
  private workers: ConductorWorker[];
  readonly options: Required<TaskManagerOptions>;
  private polling = false;
  private maxRetries: number = MAX_RETRIES;

  constructor(
    client: ConductorClient,
    workers: ConductorWorker[],
    config: TaskManagerConfig = {}
  ) {
    if (!workers) {
      throw new Error(
        "No workers supplied to TaskManager. Please pass an array of workers."
      );
    }
    this.client = client;
    this.logger = config.logger ?? new DefaultLogger();
    this.maxRetries = config.maxRetries ?? MAX_RETRIES;
    this.errorHandler = config.onError ?? noopErrorHandler;
    this.workers = workers;
    const providedOptions = config.options ?? {};
    this.options = {
      ...defaultManagerOptions,
      ...providedOptions,
      workerID: workerId(providedOptions),
    };
  }

  private workerManagerWorkerOptions = (
    worker: ConductorWorker
  ): Required<TaskManagerOptions> => {
    return {
      ...this.options,
      concurrency: worker.concurrency ?? this.options.concurrency,
      pollInterval: worker.pollInterval ?? this.options.pollInterval,
      domain: worker.domain ?? this.options.domain,
    };
  };

  get isPolling() {
    return this.polling;
  }

  updatePollingOptionForWorker = (
    workerTaskDefName: string,
    options: Partial<TaskManagerOptions>
  ) => {
    const maybeRunner = this.workerRunners.get(workerTaskDefName);

    if (maybeRunner != null) {
      maybeRunner.updateOptions(options);
    } else {
      this.logger.info(
        `No runner found for worker with taskDefName: ${workerTaskDefName}`
      );
    }
  };

  /**
   * new options will get merged to existing options
   * @param options new options to update polling options
   */
  updatePollingOptions = (options: Partial<TaskManagerOptions>) => {
    this.workers.forEach((worker) => {
      const newOptions = {
        ...this.workerManagerWorkerOptions(worker),
        ...options,
      };
      this.updatePollingOptionForWorker(worker.taskDefName, newOptions);
    });
    this.options.concurrency = options.concurrency ?? this.options.concurrency;
    this.options.pollInterval =
      options.pollInterval ?? this.options.pollInterval;
  };

  sanityCheck = () => {
    if (this.workers.length === 0) {
      throw new Error("No workers supplied to TaskManager");
    }
    const workerIDs = new Set();
    for (const item of this.workers) {
      if (workerIDs.has(item.taskDefName)) {
        throw new Error(`Duplicate worker taskDefName: ${item.taskDefName}`);
      }
      workerIDs.add(item.taskDefName);
    }
  };

  /**
   * Start polling for tasks
   */
  startPolling = () => {
    this.sanityCheck();
    this.workers.forEach((worker) => {
      const options = this.workerManagerWorkerOptions(worker);
      const runner = new TaskRunner({
        worker,
        options,
        taskResource: this.client.taskResource,
        logger: this.logger,
        onError: this.errorHandler,
        maxRetries: this.maxRetries,
      });
      runner.startPolling();
      this.workerRunners.set(worker.taskDefName, runner);
    });
    this.polling = true;
  };
  /**
   * Stops polling for tasks
   */
  stopPolling = async () => {
    for (const [workerTaskDefName, runner] of this.workerRunners) {
      this.logger.debug(`Stopping taskDefName=${workerTaskDefName}`);
      await runner.stopPolling();
      this.workerRunners.delete(workerTaskDefName);
    }
    this.polling = false;
  };
}
