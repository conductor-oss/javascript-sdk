import { ConductorLogger, noopLogger } from "../common";
import {
  DEFAULT_POLL_INTERVAL,
  DEFAULT_WARN_AT_O,
  DEFAULT_CONCURRENCY,
} from "./constants";

interface PollerOptions {
  pollInterval?: number;
  concurrency: number;
  warnAtO?: number;
}

export class Poller<T> {
  private timeoutHandler?: NodeJS.Timeout;
  private pollFunction: (count: number) => Promise<T[]>;
  private performWorkFunction: (work: T) => Promise<void>;
  private polling = false;
  private _tasksInProcess = 0;
  private _counterAtO = 0;
  private _pollerId = "";
  options: PollerOptions = {
    pollInterval: DEFAULT_POLL_INTERVAL,
    concurrency: DEFAULT_CONCURRENCY,
    warnAtO: DEFAULT_WARN_AT_O,
  };
  logger: ConductorLogger = noopLogger;

  constructor(
    pollerId: string,
    pollFunction: (count: number) => Promise<T[]>,
    performWorkFunction: (work: T) => Promise<void>,
    pollerOptions?: Partial<PollerOptions>,
    logger?: ConductorLogger
  ) {
    this._pollerId = pollerId;
    this.pollFunction = pollFunction;
    this.performWorkFunction = performWorkFunction;
    this.options = { ...this.options, ...pollerOptions };
    this.logger = logger || noopLogger;
  }

  get isPolling() {
    return this.polling;
  }

  get tasksInProcess() {
    return this._tasksInProcess;
  }

  /**
   * Starts polling for work
   */
  startPolling = () => {
    if (this.polling) {
      throw new Error("Runner is already started");
    }
    this._tasksInProcess = 0;
    this.polling = true;
    this.poll();
  };

  /**
   * Stops Polling for work
   */
  stopPolling = async () => {
    this.polling = false;
    clearTimeout(this.timeoutHandler);
  };

  private performWork = async (work: T) => {
    await this.performWorkFunction(work);
    this._tasksInProcess--;
  };

  updateOptions(options: Partial<PollerOptions>) {
    const newOptions = { ...this.options, ...options };
    this.options = newOptions;
  }

  private poll = async () => {
    while (this.isPolling) {
      try {
        // Concurrency could have been updated. Accounting for that
        const count = Math.max(
          0,
          this.options.concurrency - this._tasksInProcess
        );

        if (count === 0) {
          this.logger.debug(
            "Max in process reached, Will skip polling for " + this._pollerId
          );
          this._counterAtO++;
          if (this._counterAtO > (this.options.warnAtO ?? 100)) {
            this.logger.info(
              `Not polling anything because in process tasks is maxed as concurrency level. ${this._pollerId}`
            );
          }
        } else {
          this._counterAtO = 0;
          const tasksResult: T[] = await this.pollFunction(count);
          this._tasksInProcess =
            this._tasksInProcess + (tasksResult ?? []).length;

          // Don't wait for the tasks to finish only 'listen' to the number of tasks being processes
          tasksResult.forEach(this.performWork);
        }
      } catch (error: unknown) {
        this.logger.error(
          `Error polling for tasks: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          error
        );
      }

      await new Promise((r) =>
        this.isPolling
          ? (this.timeoutHandler = setTimeout(
              () => r(true),
              this.options.pollInterval
            ))
          : r(true)
      );
    }
  };
}
