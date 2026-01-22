import type {
  TaskRunnerEvent,
  PollStarted,
  PollCompleted,
  PollFailure,
  TaskExecutionStarted,
  TaskExecutionCompleted,
  TaskExecutionFailure,
  TaskUpdateFailure,
} from "./types";

/**
 * Interface for task runner event listeners.
 * 
 * All methods are optional - implement only the events you need to handle.
 * Listener failures are isolated and will not affect task execution.
 */
export interface TaskRunnerEventsListener {
  /**
   * Called when task polling begins.
   */
  onPollStarted?(event: PollStarted): void | Promise<void>;

  /**
   * Called when task polling completes successfully.
   */
  onPollCompleted?(event: PollCompleted): void | Promise<void>;

  /**
   * Called when task polling fails.
   */
  onPollFailure?(event: PollFailure): void | Promise<void>;

  /**
   * Called when task execution begins.
   */
  onTaskExecutionStarted?(event: TaskExecutionStarted): void | Promise<void>;

  /**
   * Called when task execution completes successfully.
   */
  onTaskExecutionCompleted?(
    event: TaskExecutionCompleted
  ): void | Promise<void>;

  /**
   * Called when task execution fails.
   */
  onTaskExecutionFailure?(event: TaskExecutionFailure): void | Promise<void>;

  /**
   * Called when task update fails after all retry attempts.
   * This is a CRITICAL event that may require operational intervention.
   */
  onTaskUpdateFailure?(event: TaskUpdateFailure): void | Promise<void>;
}

/**
 * Event dispatcher for task runner events.
 * 
 * Provides a decoupled event system for observability and metrics collection.
 * Events are published asynchronously and listener failures are isolated.
 */
export class EventDispatcher {
  private listeners: TaskRunnerEventsListener[] = [];

  /**
   * Register an event listener.
   * 
   * @param listener - The listener to register
   */
  register(listener: TaskRunnerEventsListener): void {
    this.listeners.push(listener);
  }

  /**
   * Unregister an event listener.
   * 
   * @param listener - The listener to unregister
   */
  unregister(listener: TaskRunnerEventsListener): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Publish a PollStarted event.
   */
  async publishPollStarted(event: PollStarted): Promise<void> {
    await this.publishEvent("onPollStarted", event);
  }

  /**
   * Publish a PollCompleted event.
   */
  async publishPollCompleted(event: PollCompleted): Promise<void> {
    await this.publishEvent("onPollCompleted", event);
  }

  /**
   * Publish a PollFailure event.
   */
  async publishPollFailure(event: PollFailure): Promise<void> {
    await this.publishEvent("onPollFailure", event);
  }

  /**
   * Publish a TaskExecutionStarted event.
   */
  async publishTaskExecutionStarted(
    event: TaskExecutionStarted
  ): Promise<void> {
    await this.publishEvent("onTaskExecutionStarted", event);
  }

  /**
   * Publish a TaskExecutionCompleted event.
   */
  async publishTaskExecutionCompleted(
    event: TaskExecutionCompleted
  ): Promise<void> {
    await this.publishEvent("onTaskExecutionCompleted", event);
  }

  /**
   * Publish a TaskExecutionFailure event.
   */
  async publishTaskExecutionFailure(
    event: TaskExecutionFailure
  ): Promise<void> {
    await this.publishEvent("onTaskExecutionFailure", event);
  }

  /**
   * Publish a TaskUpdateFailure event.
   */
  async publishTaskUpdateFailure(event: TaskUpdateFailure): Promise<void> {
    await this.publishEvent("onTaskUpdateFailure", event);
  }

  /**
   * Internal method to publish events to all registered listeners.
   * Listener failures are caught and logged to prevent affecting task execution.
   */
  private async publishEvent<K extends keyof TaskRunnerEventsListener>(
    method: K,
    event: TaskRunnerEvent
  ): Promise<void> {
    // Early return if no listeners registered (zero overhead)
    if (this.listeners.length === 0) {
      return;
    }

    // Publish to all listeners asynchronously
    const promises = this.listeners
      .filter((listener) => listener[method])
      .map(async (listener) => {
        try {
          const handler = listener[method];
          if (handler) {
            await handler.call(listener, event as never);
          }
        } catch (error) {
          // Isolate listener failures - don't affect task execution
          console.error(
            `Event listener failed for ${method}:`,
            error instanceof Error ? error.message : error
          );
        }
      });

    // Wait for all listeners to complete (or fail)
    await Promise.allSettled(promises);
  }
}
