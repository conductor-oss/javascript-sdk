import { jest, test, expect, describe, beforeEach } from "@jest/globals";
import { EventDispatcher, TaskRunnerEventsListener } from "../EventDispatcher";
import type {
  PollStarted,
  PollCompleted,
  PollFailure,
  TaskExecutionStarted,
  TaskExecutionCompleted,
  TaskExecutionFailure,
  TaskUpdateFailure,
} from "../EventTypes";

describe("EventDispatcher", () => {
  let dispatcher: EventDispatcher;

  beforeEach(() => {
    dispatcher = new EventDispatcher();
  });

  test("should register and call event listeners", async () => {
    const mockListener: TaskRunnerEventsListener = {
      onPollStarted: jest.fn<() => void>(),
      onPollCompleted: jest.fn<() => void>(),
    };

    dispatcher.register(mockListener);

    const pollStartedEvent: PollStarted = {
      taskType: "test-task",
      workerId: "worker-1",
      pollCount: 5,
      timestamp: new Date(),
    };

    await dispatcher.publishPollStarted(pollStartedEvent);

    expect(mockListener.onPollStarted).toHaveBeenCalledWith(pollStartedEvent);
    expect(mockListener.onPollCompleted).not.toHaveBeenCalled();
  });

  test("should call multiple listeners", async () => {
    const listener1: TaskRunnerEventsListener = {
      onPollStarted: jest.fn<() => void>(),
    };
    const listener2: TaskRunnerEventsListener = {
      onPollStarted: jest.fn<() => void>(),
    };

    dispatcher.register(listener1);
    dispatcher.register(listener2);

    const event: PollStarted = {
      taskType: "test-task",
      workerId: "worker-1",
      pollCount: 5,
      timestamp: new Date(),
    };

    await dispatcher.publishPollStarted(event);

    expect(listener1.onPollStarted).toHaveBeenCalledWith(event);
    expect(listener2.onPollStarted).toHaveBeenCalledWith(event);
  });

  test("should unregister listeners", async () => {
    const listener: TaskRunnerEventsListener = {
      onPollStarted: jest.fn<() => void>(),
    };

    dispatcher.register(listener);
    dispatcher.unregister(listener);

    const event: PollStarted = {
      taskType: "test-task",
      workerId: "worker-1",
      pollCount: 5,
      timestamp: new Date(),
    };

    await dispatcher.publishPollStarted(event);

    expect(listener.onPollStarted).not.toHaveBeenCalled();
  });

  test("should isolate listener failures", async () => {
    const failingListener: TaskRunnerEventsListener = {
      onPollStarted: jest.fn<() => Promise<void>>().mockRejectedValue(new Error("Listener error")),
    };
    const workingListener: TaskRunnerEventsListener = {
      onPollStarted: jest.fn<() => void>(),
    };

    dispatcher.register(failingListener);
    dispatcher.register(workingListener);

    const event: PollStarted = {
      taskType: "test-task",
      workerId: "worker-1",
      pollCount: 5,
      timestamp: new Date(),
    };

    // Should not throw despite listener failure
    await expect(
      dispatcher.publishPollStarted(event)
    ).resolves.toBeUndefined();

    // Working listener should still be called
    expect(workingListener.onPollStarted).toHaveBeenCalledWith(event);
  });

  test("should handle all event types", async () => {
    const listener: TaskRunnerEventsListener = {
      onPollStarted: jest.fn<() => void>(),
      onPollCompleted: jest.fn<() => void>(),
      onPollFailure: jest.fn<() => void>(),
      onTaskExecutionStarted: jest.fn<() => void>(),
      onTaskExecutionCompleted: jest.fn<() => void>(),
      onTaskExecutionFailure: jest.fn<() => void>(),
      onTaskUpdateFailure: jest.fn<() => void>(),
    };

    dispatcher.register(listener);

    // Test PollCompleted
    const pollCompleted: PollCompleted = {
      taskType: "test-task",
      durationMs: 100,
      tasksReceived: 3,
      timestamp: new Date(),
    };
    await dispatcher.publishPollCompleted(pollCompleted);
    expect(listener.onPollCompleted).toHaveBeenCalledWith(pollCompleted);

    // Test PollFailure
    const pollFailure: PollFailure = {
      taskType: "test-task",
      durationMs: 50,
      cause: new Error("Poll failed"),
      timestamp: new Date(),
    };
    await dispatcher.publishPollFailure(pollFailure);
    expect(listener.onPollFailure).toHaveBeenCalledWith(pollFailure);

    // Test TaskExecutionStarted
    const execStarted: TaskExecutionStarted = {
      taskType: "test-task",
      taskId: "task-1",
      workerId: "worker-1",
      workflowInstanceId: "workflow-1",
      timestamp: new Date(),
    };
    await dispatcher.publishTaskExecutionStarted(execStarted);
    expect(listener.onTaskExecutionStarted).toHaveBeenCalledWith(execStarted);

    // Test TaskExecutionCompleted
    const execCompleted: TaskExecutionCompleted = {
      taskType: "test-task",
      taskId: "task-1",
      workerId: "worker-1",
      workflowInstanceId: "workflow-1",
      durationMs: 200,
      outputSizeBytes: 1024,
      timestamp: new Date(),
    };
    await dispatcher.publishTaskExecutionCompleted(execCompleted);
    expect(listener.onTaskExecutionCompleted).toHaveBeenCalledWith(
      execCompleted
    );

    // Test TaskExecutionFailure
    const execFailure: TaskExecutionFailure = {
      taskType: "test-task",
      taskId: "task-1",
      workerId: "worker-1",
      workflowInstanceId: "workflow-1",
      cause: new Error("Execution failed"),
      durationMs: 150,
      timestamp: new Date(),
    };
    await dispatcher.publishTaskExecutionFailure(execFailure);
    expect(listener.onTaskExecutionFailure).toHaveBeenCalledWith(execFailure);

    // Test TaskUpdateFailure
    const updateFailure: TaskUpdateFailure = {
      taskType: "test-task",
      taskId: "task-1",
      workerId: "worker-1",
      workflowInstanceId: "workflow-1",
      cause: new Error("Update failed"),
      retryCount: 4,
      taskResult: { status: "COMPLETED" },
      timestamp: new Date(),
    };
    await dispatcher.publishTaskUpdateFailure(updateFailure);
    expect(listener.onTaskUpdateFailure).toHaveBeenCalledWith(updateFailure);
  });

  test("should have zero overhead when no listeners registered", async () => {
    // No listeners registered
    const event: PollStarted = {
      taskType: "test-task",
      workerId: "worker-1",
      pollCount: 5,
      timestamp: new Date(),
    };

    // Should complete quickly with no listeners
    const start = Date.now();
    await dispatcher.publishPollStarted(event);
    const duration = Date.now() - start;

    // Should be nearly instant (< 10ms)
    expect(duration).toBeLessThan(10);
  });

  test("should support async listeners", async () => {
    let callbackExecuted = false;

    const asyncListener: TaskRunnerEventsListener = {
      onPollStarted: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        callbackExecuted = true;
      },
    };

    dispatcher.register(asyncListener);

    const event: PollStarted = {
      taskType: "test-task",
      workerId: "worker-1",
      pollCount: 5,
      timestamp: new Date(),
    };

    await dispatcher.publishPollStarted(event);

    expect(callbackExecuted).toBe(true);
  });
});
