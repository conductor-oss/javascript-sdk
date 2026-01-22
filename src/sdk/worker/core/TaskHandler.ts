import type { Client } from "../../../open-api";
import type { ConductorLogger } from "../../helpers/logger";
import { DefaultLogger } from "../../helpers/logger";
import type { TaskRunnerEventsListener } from "../../clients/worker/events";
import type { ConductorWorker } from "../../clients/worker/types";
import { TaskRunner } from "../../clients/worker/TaskRunner";
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
 * 
 * @example
 * Basic usage with auto-discovery:
 * ```typescript
 * import { TaskHandler } from "@io-orkes/conductor-javascript/worker";
 * 
 * // Workers defined elsewhere with @worker decorator
 * const handler = new TaskHandler({
 *   client: conductorClient,
 *   scanForDecorated: true,
 * });
 * 
 * handler.startWorkers();
 * 
 * // Later...
 * await handler.stopWorkers();
 * ```
 * 
 * @example
 * With module imports:
 * ```typescript
 * const handler = new TaskHandler({
 *   client: conductorClient,
 *   importModules: [
 *     './workers/orderWorkers',
 *     './workers/paymentWorkers',
 *   ],
 * });
 * 
 * handler.startWorkers();
 * ```
 * 
 * @example
 * Mixed approach (decorated + manual):
 * ```typescript
 * const handler = new TaskHandler({
 *   client: conductorClient,
 *   scanForDecorated: true,
 *   workers: [
 *     {
 *       taskDefName: 'dynamic_task',
 *       execute: async (task) => ({ status: 'COMPLETED', outputData: {} }),
 *     },
 *   ],
 * });
 * 
 * handler.startWorkers();
 * ```
 * 
 * @example
 * With event listeners:
 * ```typescript
 * const metricsListener = {
 *   onTaskExecutionCompleted(event) {
 *     console.log(`Task ${event.taskId} completed in ${event.durationMs}ms`);
 *   },
 * };
 * 
 * const handler = new TaskHandler({
 *   client: conductorClient,
 *   eventListeners: [metricsListener],
 * });
 * 
 * handler.startWorkers();
 * ```
 */
export class TaskHandler {
  private client: Client;
  private workers: ConductorWorker[] = [];
  private taskRunners: TaskRunner[] = [];
  private config: TaskHandlerConfig;
  private logger: ConductorLogger;
  private isRunning = false;

  /**
   * Create a TaskHandler instance with async module imports.
   * Use this instead of `new TaskHandler()` when using `importModules`.
   * 
   * @example
   * ```typescript
   * const handler = await TaskHandler.create({
   *   client,
   *   importModules: ["./workers/orderWorkers", "./workers/paymentWorkers"],
   * });
   * ```
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
            `Failed to import worker module "${modulePath}": ${
              error instanceof Error ? error.message : String(error)
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

    // Auto-discover decorated workers
    if (config.scanForDecorated !== false) {
      const decoratedWorkers = getRegisteredWorkers();
      this.logger.info(
        `Discovered ${decoratedWorkers.length} worker(s) via @worker decorator`
      );

      // Convert RegisteredWorker to ConductorWorker
      for (const registered of decoratedWorkers) {
        this.workers.push(this.convertToConductorWorker(registered));
        this.logger.debug(
          `Registered worker: ${registered.taskDefName}${
            registered.domain ? ` (domain: ${registered.domain})` : ""
          }`
        );
      }
    }

    // Add manually provided workers
    if (config.workers && config.workers.length > 0) {
      this.logger.info(
        `Adding ${config.workers.length} manually registered worker(s)`
      );
      this.workers.push(...config.workers);
    }

    if (this.workers.length === 0) {
      this.logger.info(
        "No workers registered. Did you forget to use @worker decorator or provide workers manually?"
      );
    } else {
      this.logger.info(`TaskHandler initialized with ${this.workers.length} worker(s)`);
    }
  }

  /**
   * Convert RegisteredWorker to ConductorWorker format.
   */
  private convertToConductorWorker(registered: RegisteredWorker): ConductorWorker {
    return {
      taskDefName: registered.taskDefName,
      execute: registered.executeFunction,
      concurrency: registered.concurrency,
      pollInterval: registered.pollInterval,
      domain: registered.domain,
      // Note: registerTaskDef, taskDef, etc. are not part of ConductorWorker interface
      // These will be handled by configuration system in Phase 4
    };
  }

  /**
   * Start all registered workers.
   * 
   * Creates a TaskRunner for each worker and begins polling for tasks.
   * This method is idempotent - calling it multiple times has no effect.
   */
  startWorkers(): void {
    if (this.isRunning) {
      this.logger.info("Workers are already running. Ignoring startWorkers() call.");
      return;
    }

    if (this.workers.length === 0) {
      this.logger.info("No workers to start.");
      return;
    }

    this.logger.info(`Starting ${this.workers.length} worker(s)...`);

    for (const worker of this.workers) {
      try {
        const runner = new TaskRunner({
          worker,
          client: this.client,
          options: {
            workerID: "", // Will be auto-generated
            domain: worker.domain,
            pollInterval: worker.pollInterval,
            concurrency: worker.concurrency,
          },
          logger: this.logger,
          eventListeners: this.config.eventListeners,
        });

        runner.startPolling();
        this.taskRunners.push(runner);

        this.logger.info(
          `Started worker: ${worker.taskDefName}${
            worker.domain ? ` (domain: ${worker.domain})` : ""
          }`
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
      this.logger.info("Workers are not running. Ignoring stopWorkers() call.");
      return;
    }

    this.logger.info(`Stopping ${this.taskRunners.length} worker(s)...`);

    const stopPromises = this.taskRunners.map(async (runner, index) => {
      try {
        await runner.stopPolling();
        this.logger.debug(`Stopped worker ${index + 1}/${this.taskRunners.length}`);
      } catch (error) {
        this.logger.error(
          `Error stopping worker ${index + 1}:`,
          error instanceof Error ? error.message : error
        );
      }
    });

    await Promise.all(stopPromises);

    this.taskRunners = [];
    this.isRunning = false;
    this.logger.info("All workers stopped");
  }

  /**
   * Get the number of registered workers.
   */
  get workerCount(): number {
    return this.workers.length;
  }

  /**
   * Get the number of running workers.
   */
  get runningWorkerCount(): number {
    return this.taskRunners.length;
  }

  /**
   * Check if workers are currently running.
   */
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
