import os from "os";
import type { Client } from "../../../open-api";
import { MetadataResource } from "../../../open-api/generated";
import {
  HEALTH_CHECK_INTERVAL_MS,
  RESTART_BACKOFF_BASE_MS,
  RESTART_BACKOFF_MAX_MS,
} from "../../clients/worker/constants";
import type { TaskRunnerEventsListener } from "../../clients/worker/events";
import { TaskRunner } from "../../clients/worker/TaskRunner";
import type { ConductorWorker, HealthMonitorConfig } from "../../clients/worker/types";
import type { ConductorLogger } from "../../helpers/logger";
import { DefaultLogger } from "../../helpers/logger";
import {
  getWorkerConfigOneline,
  resolveWorkerConfig,
} from "../config/WorkerConfig";
import { getRegisteredWorkers, type RegisteredWorker } from "../decorators/registry";

/**
 * Configuration for TaskHandler.
 */
export interface TaskHandlerConfig {
  /**
   * Conductor client instance.
   * Required for communicating with Conductor server.
   */
  client: Client;

  /**
   * Additional workers to register manually.
   * These will be added alongside auto-discovered decorated workers.
   * Default: []
   */
  workers?: ConductorWorker[];

  /**
   * Whether to scan for @worker decorated functions.
   * When true, automatically discovers all workers registered via @worker decorator.
   * Default: true
   */
  scanForDecorated?: boolean;

  /**
   * Modules to import for side-effect registration.
   * Importing these modules will trigger @worker decorator execution.
   * Useful when workers are defined in separate files.
   *
   * Example: ['./workers/orderWorkers', './workers/paymentWorkers']
   * Default: []
   */
  importModules?: string[];

  /**
   * Event listeners for worker lifecycle events.
   * Default: []
   */
  eventListeners?: TaskRunnerEventsListener[];

  /**
   * Logger instance for TaskHandler.
   * Default: DefaultLogger
   */
  logger?: ConductorLogger;

  /**
   * Health monitoring configuration.
   * Monitors worker polling loops and auto-restarts on failure.
   * Default: { enabled: true }
   */
  healthMonitor?: HealthMonitorConfig;
}

/**
 * Internal representation of a worker with resolved configuration.
 */
interface ResolvedWorker {
  worker: ConductorWorker;
  registered?: RegisteredWorker;
  resolvedWorkerId: string;
}

/**
 * TaskHandler orchestrates worker lifecycle and auto-discovery.
 *
 * This is the main entry point for the SDK-style worker framework,
 * matching the Python SDK's TaskHandler architecture.
 *
 * Features:
 * - Auto-discovers workers decorated with @worker
 * - Manages worker lifecycle (start/stop)
 * - Supports both decorated and manual worker registration
 * - Module import for side-effect registration
 * - Event listener support
 * - Health monitoring with auto-restart
 * - Automatic task definition registration
 * - Environment variable configuration override
 *
 * @example
 * Basic usage with auto-discovery:
 * ```typescript
 * const handler = new TaskHandler({
 *   client: conductorClient,
 *   scanForDecorated: true,
 * });
 *
 * await handler.startWorkers();
 *
 * // Later...
 * await handler.stopWorkers();
 * ```
 *
 * @example
 * With event listeners and health monitoring:
 * ```typescript
 * const handler = new TaskHandler({
 *   client: conductorClient,
 *   eventListeners: [metricsCollector],
 *   healthMonitor: {
 *     enabled: true,
 *     healthCheckIntervalMs: 5000,
 *     maxRestartAttempts: 10,
 *   },
 * });
 *
 * await handler.startWorkers();
 * handler.printSummary();
 * ```
 */
export class TaskHandler {
  private client: Client;
  private resolvedWorkers: ResolvedWorker[] = [];
  private taskRunners: TaskRunner[] = [];
  private config: TaskHandlerConfig;
  private logger: ConductorLogger;
  private isRunning = false;

  // Health monitoring
  private healthCheckTimer?: ReturnType<typeof setInterval>;
  private restartAttempts = new Map<number, number>(); // runner index → attempt count
  private healthMonitorConfig: HealthMonitorConfig;

  /**
   * Create a TaskHandler instance with async module imports.
   * Use this instead of `new TaskHandler()` when using `importModules`.
   */
  static async create(config: TaskHandlerConfig): Promise<TaskHandler> {
    const logger = config.logger ?? new DefaultLogger();

    // Import modules for side-effect registration
    if (config.importModules && config.importModules.length > 0) {
      logger.info(
        `Importing ${config.importModules.length} module(s) for worker discovery...`
      );

      for (const modulePath of config.importModules) {
        try {
          logger.debug(`Importing module: ${modulePath}`);
          await import(modulePath); // Async ES module import
          logger.debug(`Successfully imported: ${modulePath}`);
        } catch (error) {
          logger.error(
            `Failed to import module ${modulePath}:`,
            error instanceof Error ? error.message : error
          );
          throw new Error(
            `Failed to import worker module "${modulePath}": ${error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    }

    // Now create the handler - workers are already registered via decorators
    return new TaskHandler(config);
  }

  constructor(config: TaskHandlerConfig) {
    this.config = config;
    this.client = config.client;
    this.logger = config.logger ?? new DefaultLogger();
    this.healthMonitorConfig = config.healthMonitor ?? { enabled: true };

    // Auto-discover decorated workers
    if (config.scanForDecorated !== false) {
      const decoratedWorkers = getRegisteredWorkers();
      this.logger.info(
        `Discovered ${decoratedWorkers.length} worker(s) via @worker decorator`
      );

      for (const registered of decoratedWorkers) {
        // Resolve configuration: env vars > decorator params > defaults
        const resolved = resolveWorkerConfig(
          registered.taskDefName,
          {
            pollInterval: registered.pollInterval,
            domain: registered.domain,
            workerId: registered.workerId,
            concurrency: registered.concurrency,
            registerTaskDef: registered.registerTaskDef,
            pollTimeout: registered.pollTimeout,
            paused: undefined,
            overwriteTaskDef: registered.overwriteTaskDef,
            strictSchema: registered.strictSchema,
          },
          this.logger
        );

        const conductorWorker: ConductorWorker = {
          taskDefName: registered.taskDefName,
          execute: registered.executeFunction,
          concurrency: resolved.concurrency,
          pollInterval: resolved.pollInterval,
          domain: resolved.domain,
        };

        const resolvedWorkerId =
          resolved.workerId ?? os.hostname();

        this.resolvedWorkers.push({
          worker: conductorWorker,
          registered: { ...registered, ...resolved },
          resolvedWorkerId,
        });

        // Log resolved config one-liner
        this.logger.info(
          getWorkerConfigOneline(registered.taskDefName, resolved)
        );
      }
    }

    // Add manually provided workers (no config resolution — already configured)
    if (config.workers && config.workers.length > 0) {
      this.logger.info(
        `Adding ${config.workers.length} manually registered worker(s)`
      );
      for (const w of config.workers) {
        this.resolvedWorkers.push({
          worker: w,
          resolvedWorkerId: os.hostname(),
        });
      }
    }

    if (this.resolvedWorkers.length === 0) {
      this.logger.info(
        "No workers registered. Did you forget to use @worker decorator or provide workers manually?"
      );
    } else {
      this.logger.info(
        `TaskHandler initialized with ${this.resolvedWorkers.length} worker(s)`
      );
    }
  }

  /**
   * Start all registered workers.
   *
   * Registers task definitions (if configured), creates a TaskRunner for each
   * worker, and begins polling for tasks.
   * This method is idempotent - calling it multiple times has no effect.
   */
  async startWorkers(): Promise<void> {
    if (this.isRunning) {
      this.logger.info(
        "Workers are already running. Ignoring startWorkers() call."
      );
      return;
    }

    if (this.resolvedWorkers.length === 0) {
      this.logger.info("No workers to start.");
      return;
    }

    // Register task definitions before starting polling
    await this.registerTaskDefinitions();

    this.logger.info(`Starting ${this.resolvedWorkers.length} worker(s)...`);

    for (const { worker, resolvedWorkerId, registered } of
      this.resolvedWorkers) {
      try {
        // Skip paused workers
        const isPaused = registered?.paused ?? false;

        const runner = new TaskRunner({
          worker,
          client: this.client,
          options: {
            workerID: resolvedWorkerId,
            domain: worker.domain,
            pollInterval: worker.pollInterval,
            concurrency: worker.concurrency,
            batchPollingTimeout: registered?.pollTimeout,
          },
          logger: this.logger,
          eventListeners: this.config.eventListeners,
        });

        if (isPaused) {
          runner.setPaused(true);
        }

        runner.startPolling();
        this.taskRunners.push(runner);

        this.logger.info(
          `Started worker: ${worker.taskDefName}${worker.domain ? ` (domain: ${worker.domain})` : ""
          }${isPaused ? " [PAUSED]" : ""}`
        );
      } catch (error) {
        this.logger.error(
          `Failed to start worker ${worker.taskDefName}:`,
          error instanceof Error ? error.message : error
        );
        throw error;
      }
    }

    this.isRunning = true;
    this.startHealthMonitor();
    this.logger.info("All workers started successfully");
  }

  /**
   * Stop all running workers gracefully.
   *
   * Stops polling and waits for in-flight tasks to complete.
   * This method is idempotent - calling it multiple times has no effect.
   */
  async stopWorkers(): Promise<void> {
    if (!this.isRunning) {
      this.logger.info(
        "Workers are not running. Ignoring stopWorkers() call."
      );
      return;
    }

    this.stopHealthMonitor();
    this.logger.info(`Stopping ${this.taskRunners.length} worker(s)...`);

    const stopPromises = this.taskRunners.map(async (runner, index) => {
      try {
        await runner.stopPolling();
        this.logger.debug(
          `Stopped worker ${index + 1}/${this.taskRunners.length}`
        );
      } catch (error) {
        this.logger.error(
          `Error stopping worker ${index + 1}:`,
          error instanceof Error ? error.message : error
        );
      }
    });

    await Promise.all(stopPromises);

    this.taskRunners = [];
    this.restartAttempts.clear();
    this.isRunning = false;
    this.logger.info("All workers stopped");
  }

  // ── Task Definition Registration ────────────────────────────────

  /**
   * Register task definitions for workers that have registerTaskDef=true.
   * Called automatically by startWorkers() before polling begins.
   *
   * Matches Python SDK behavior:
   * - If overwriteTaskDef=true: PUT /api/metadata/taskdefs (create or update)
   * - If overwriteTaskDef=false: GET first, then POST only if not found
   * - Uses taskDef template if provided, otherwise creates minimal definition
   */
  private async registerTaskDefinitions(): Promise<void> {
    for (const { worker, registered } of this.resolvedWorkers) {
      if (!registered?.registerTaskDef) continue;

      try {
        // Build task definition from template or create minimal one
        const baseTaskDef = registered.taskDef
          ? {
            ...registered.taskDef,
            name: worker.taskDefName
          }
          : {
            name: worker.taskDefName,
            timeoutSeconds: 3600,
            totalTimeoutSeconds: 0,
          };

        // Ensure required fields are present for API call
        const taskDef = {
          ...baseTaskDef,
          timeoutSeconds: baseTaskDef.timeoutSeconds ?? 3600,
          totalTimeoutSeconds: baseTaskDef.totalTimeoutSeconds ?? 0,
        };

        const overwrite = registered.overwriteTaskDef !== false; // default true

        if (overwrite) {
          // PUT — creates or updates
          await MetadataResource.updateTaskDef({
            client: this.client,
            body: taskDef,
          });
          this.logger.info(
            `Registered task definition: ${worker.taskDefName} (overwrite=true)`
          );
        } else {
          // Check if exists first, create only if missing
          try {
            await MetadataResource.getTaskDef({
              client: this.client,
              path: { tasktype: worker.taskDefName },
            });
            this.logger.debug(
              `Task definition already exists: ${worker.taskDefName} (overwrite=false, skipping)`
            );
          } catch {
            // Not found — create it
            await MetadataResource.registerTaskDef({
              client: this.client,
              body: [taskDef],
            });
            this.logger.info(
              `Registered task definition: ${worker.taskDefName} (created new)`
            );
          }
        }
      } catch (error) {
        // Non-fatal: log warning but continue — worker can still poll
        this.logger.error(
          `Failed to register task definition for ${worker.taskDefName}: ${error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  }

  // ── Health Monitoring ───────────────────────────────────────────

  private startHealthMonitor(): void {
    if (this.healthMonitorConfig.enabled === false) return;

    const interval =
      this.healthMonitorConfig.healthCheckIntervalMs ??
      HEALTH_CHECK_INTERVAL_MS;

    this.healthCheckTimer = setInterval(() => {
      this.checkWorkerHealth();
    }, interval);

    // Don't prevent process exit
    if (
      this.healthCheckTimer &&
      typeof this.healthCheckTimer === "object" &&
      "unref" in this.healthCheckTimer
    ) {
      this.healthCheckTimer.unref();
    }

    this.logger.debug(`Health monitor started (interval: ${interval}ms)`);
  }

  private stopHealthMonitor(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
      this.logger.debug("Health monitor stopped");
    }
  }

  private checkWorkerHealth(): void {
    for (let i = 0; i < this.taskRunners.length; i++) {
      const runner = this.taskRunners[i];
      const resolved = this.resolvedWorkers[i];
      if (!runner || !resolved) continue;
      const { worker } = resolved;

      if (!runner.isPolling && this.isRunning) {
        const attempts = this.restartAttempts.get(i) ?? 0;
        const maxAttempts =
          this.healthMonitorConfig.maxRestartAttempts ?? 0;

        // 0 = unlimited
        if (maxAttempts > 0 && attempts >= maxAttempts) {
          this.logger.error(
            `Worker ${worker.taskDefName} has stopped and exceeded max restart attempts (${maxAttempts}). Not restarting.`
          );
          continue;
        }

        // Exponential backoff for restarts
        const backoffMs = Math.min(
          RESTART_BACKOFF_BASE_MS * Math.pow(2, attempts),
          RESTART_BACKOFF_MAX_MS
        );

        this.logger.info(
          `Worker ${worker.taskDefName} has stopped unexpectedly. Restarting in ${backoffMs}ms (attempt ${attempts + 1})`
        );

        this.restartAttempts.set(i, attempts + 1);

        setTimeout(() => {
          try {
            if (this.isRunning && !runner.isPolling) {
              runner.startPolling();
              this.logger.info(
                `Worker ${worker.taskDefName} restarted successfully`
              );
              // Reset counter on success
              this.restartAttempts.set(i, 0);
            }
          } catch (error) {
            this.logger.error(
              `Failed to restart worker ${worker.taskDefName}:`,
              error instanceof Error ? error.message : error
            );
          }
        }, backoffMs);
      }
    }
  }

  // ── Discovery Summary ───────────────────────────────────────────

  /**
   * Print a summary of all registered workers and their configurations.
   * Matches Python SDK's print_summary() function.
   */
  printSummary(): void {
    if (this.resolvedWorkers.length === 0) {
      this.logger.info("No workers registered.");
      return;
    }

    const lines: string[] = [
      "",
      "=== Worker Discovery Summary ===",
      `Total workers: ${this.resolvedWorkers.length}`,
      `Running: ${this.isRunning}`,
      "",
    ];

    for (let i = 0; i < this.resolvedWorkers.length; i++) {
      const entry = this.resolvedWorkers[i];
      if (!entry) continue;
      const { worker, registered, resolvedWorkerId } = entry;
      const runner = this.taskRunners[i];
      const status = runner?.isPolling
        ? "POLLING"
        : this.isRunning
          ? "STOPPED"
          : "NOT_STARTED";

      lines.push(`  Worker: ${worker.taskDefName}`);
      lines.push(`    Status:       ${status}`);
      lines.push(`    WorkerId:     ${resolvedWorkerId}`);
      if (worker.domain) {
        lines.push(`    Domain:       ${worker.domain}`);
      }
      lines.push(
        `    Concurrency:  ${worker.concurrency ?? "default (1)"}`
      );
      lines.push(
        `    PollInterval: ${worker.pollInterval ?? "default (100ms)"}${worker.pollInterval ? "ms" : ""}`
      );
      if (registered?.registerTaskDef) {
        lines.push(`    RegisterDef:  true`);
      }
      if (registered?.paused) {
        lines.push(`    Paused:       true`);
      }
      lines.push("");
    }

    lines.push("================================");
    this.logger.info(lines.join("\n"));
  }

  // ── Health Inspection ─────────────────────────────────────────

  /**
   * Check if all workers are healthy (all polling).
   * Returns false if any worker has stopped unexpectedly.
   */
  isHealthy(): boolean {
    if (!this.isRunning) return false;
    return this.taskRunners.every((runner) => runner.isPolling);
  }

  /**
   * Get detailed status of each worker.
   * Matches Python SDK's get_worker_process_status().
   */
  getWorkerStatus(): {
    taskDefName: string;
    domain?: string;
    polling: boolean;
    paused: boolean;
    workerId: string;
    restartCount: number;
  }[] {
    return this.resolvedWorkers.map(
      ({ worker, resolvedWorkerId }, i) => {
        const runner = this.taskRunners[i];
        return {
          taskDefName: worker.taskDefName,
          domain: worker.domain,
          polling: runner?.isPolling ?? false,
          paused: runner?.isPaused ?? false,
          workerId: resolvedWorkerId,
          restartCount: this.restartAttempts.get(i) ?? 0,
        };
      }
    );
  }

  // ── Properties ──────────────────────────────────────────────────

  /** Get the number of registered workers. */
  get workerCount(): number {
    return this.resolvedWorkers.length;
  }

  /** Get the number of running workers. */
  get runningWorkerCount(): number {
    return this.taskRunners.length;
  }

  /** Check if workers are currently running. */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Context manager support (for TypeScript 5.2+ using keyword).
   * Automatically stops workers when disposed.
   */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.stopWorkers();
  }
}
