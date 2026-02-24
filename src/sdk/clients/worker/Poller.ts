import { ConductorLogger, noopLogger } from "../../helpers/logger";
import {
  DEFAULT_POLL_INTERVAL,
  DEFAULT_WARN_AT_O,
  DEFAULT_CONCURRENCY,
  ADAPTIVE_BACKOFF_BASE_MS,
  ADAPTIVE_BACKOFF_MAX_EXPONENT,
  AUTH_BACKOFF_MAX_SECONDS,
} from "./constants";
import { PollerOptions } from "./types";

/** HTTP status codes treated as auth failures */
const AUTH_HTTP_STATUS_CODES = [401, 403];

export class Poller<T> {
  private timeoutHandler?: NodeJS.Timeout;
  private pollFunction: (count: number) => Promise<T[] | undefined>;
  private performWorkFunction: (work: T) => Promise<void>;
  private polling = false;
  private _tasksInProcess = 0;
  private _counterAtO = 0;
  private _pollerId = "";

  // Adaptive backoff state
  private _consecutiveEmptyPolls = 0;
  private _lastPollTime = 0;

  // Auth failure backoff state
  private _authFailures = 0;
  private _lastAuthFailureAt = 0;

  options: PollerOptions = {
    pollInterval: DEFAULT_POLL_INTERVAL,
    concurrency: DEFAULT_CONCURRENCY,
    warnAtO: DEFAULT_WARN_AT_O,
    adaptiveBackoff: true,
    paused: false,
  };
  logger: ConductorLogger = noopLogger;

  constructor(
    pollerId: string,
    pollFunction: (count: number) => Promise<T[] | undefined>,
    performWorkFunction: (work: T) => Promise<void>,
    pollerOptions?: Partial<PollerOptions>,
    logger?: ConductorLogger
  ) {
    this._pollerId = pollerId;
    this.pollFunction = pollFunction;
    this.performWorkFunction = performWorkFunction;
    this.options = { ...this.options, ...pollerOptions };
    this.logger = logger || noopLogger;

    // Ensure concurrency is a valid number
    if (
      typeof this.options.concurrency !== "number" ||
      isNaN(this.options.concurrency) ||
      this.options.concurrency < 1
    ) {
      this.logger.info(
        `Invalid concurrency value (${this.options.concurrency}) for poller ${pollerId}. Using default: ${DEFAULT_CONCURRENCY}`
      );
      this.options.concurrency = DEFAULT_CONCURRENCY;
    }
  }

  get isPolling() {
    return this.polling;
  }

  get tasksInProcess() {
    return this._tasksInProcess;
  }

  get consecutiveEmptyPolls() {
    return this._consecutiveEmptyPolls;
  }

  get authFailures() {
    return this._authFailures;
  }

  /**
   * Starts polling for work
   */
  startPolling = () => {
    if (this.polling) {
      throw new Error("Runner is already started");
    }
    this._tasksInProcess = 0;
    this._consecutiveEmptyPolls = 0;
    this._authFailures = 0;
    this._lastPollTime = 0;
    this._lastAuthFailureAt = 0;
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

  /**
   * Detect if an error is an authentication/authorization failure.
   */
  private isAuthError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;

    // Check for status property
    const errObj = error as Record<string, unknown>;
    const status = errObj.status ?? errObj.statusCode;
    if (typeof status === "number" && AUTH_HTTP_STATUS_CODES.includes(status)) {
      return true;
    }

    // Check for response.status (fetch-style errors)
    const response = errObj.response;
    if (response && typeof response === "object") {
      const respStatus = (response as Record<string, unknown>).status;
      if (
        typeof respStatus === "number" &&
        AUTH_HTTP_STATUS_CODES.includes(respStatus)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate adaptive backoff delay for empty polls.
   *
   * Matches Python SDK: min(BASE_MS * 2^min(count, MAX_EXPONENT), pollInterval)
   * Sequence: 1ms, 2ms, 4ms, 8ms, 16ms, ... 1024ms, then capped at pollInterval
   */
  private calculateAdaptiveDelay(): number {
    if (this._consecutiveEmptyPolls <= 0) return 0;
    const capped = Math.min(
      this._consecutiveEmptyPolls,
      ADAPTIVE_BACKOFF_MAX_EXPONENT
    );
    const delay = ADAPTIVE_BACKOFF_BASE_MS * Math.pow(2, capped);
    return Math.min(delay, this.options.pollInterval ?? DEFAULT_POLL_INTERVAL);
  }

  /**
   * Calculate auth failure backoff delay in milliseconds.
   *
   * Matches Python SDK: min(2^failures, 60) seconds
   */
  private calculateAuthBackoffMs(): number {
    if (this._authFailures <= 0) return 0;
    const backoffSeconds = Math.min(
      Math.pow(2, this._authFailures),
      AUTH_BACKOFF_MAX_SECONDS
    );
    return backoffSeconds * 1000;
  }

  /** Promise-based sleep that resolves immediately if polling has stopped */
  private sleep(ms: number): Promise<void> {
    return new Promise((r) =>
      this.isPolling
        ? (this.timeoutHandler = setTimeout(() => r(), ms))
        : r()
    );
  }

  private poll = async () => {
    while (this.isPolling) {
      try {
        // 1. PAUSED CHECK
        if (this.options.paused) {
          this.logger.debug(
            `Worker ${this._pollerId} is paused, skipping poll`
          );
          await this.sleep(
            this.options.pollInterval ?? DEFAULT_POLL_INTERVAL
          );
          continue;
        }

        // 2. AUTH FAILURE BACKOFF
        if (this._authFailures > 0) {
          const authBackoffMs = this.calculateAuthBackoffMs();
          const timeSinceFailure = Date.now() - this._lastAuthFailureAt;
          if (timeSinceFailure < authBackoffMs) {
            this.logger.debug(
              `Auth backoff active for ${this._pollerId}: ${Math.round(authBackoffMs - timeSinceFailure)}ms remaining (failures: ${this._authFailures})`
            );
            await this.sleep(
              Math.min(100, authBackoffMs - timeSinceFailure)
            );
            continue;
          }
        }

        // 3. CAPACITY CHECK
        const rawCount =
          (this.options.concurrency ?? DEFAULT_CONCURRENCY) -
          this._tasksInProcess;
        const count = Math.max(
          0,
          Number.isFinite(rawCount) ? rawCount : DEFAULT_CONCURRENCY
        );

        if (count === 0 || !Number.isFinite(count)) {
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
          // 4. ADAPTIVE BACKOFF for empty polls
          if (
            this.options.adaptiveBackoff !== false &&
            this._consecutiveEmptyPolls > 0
          ) {
            const adaptiveDelay = this.calculateAdaptiveDelay();
            const timeSinceLastPoll = Date.now() - this._lastPollTime;
            if (timeSinceLastPoll < adaptiveDelay) {
              await this.sleep(adaptiveDelay - timeSinceLastPoll);
              continue;
            }
          }

          // 5. POLL
          this._counterAtO = 0;
          this._lastPollTime = Date.now();
          const tasksResult: T[] | undefined =
            await this.pollFunction(count);
          this._tasksInProcess =
            this._tasksInProcess + (tasksResult ?? []).length;

          if (tasksResult && tasksResult.length > 0) {
            // Tasks received — reset counters
            this._consecutiveEmptyPolls = 0;
          } else {
            // No tasks — increment empty poll counter
            this._consecutiveEmptyPolls++;
          }

          // Successful poll (even if empty) — reset auth failures
          this._authFailures = 0;

          // 6. DISPATCH (fire-and-forget)
          tasksResult?.forEach(this.performWork);
        }
      } catch (error: unknown) {
        if (this.isAuthError(error)) {
          this._authFailures++;
          this._lastAuthFailureAt = Date.now();
          this.logger.error(
            `Auth failure (${this._authFailures}) polling for ${this._pollerId}: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        } else {
          this.logger.error(
            `Error polling for tasks: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
            error
          );
        }
      }

      // 7. SLEEP between poll cycles
      await this.sleep(
        this.options.pollInterval ?? DEFAULT_POLL_INTERVAL
      );
    }
  };
}
