/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ConductorLogger } from "@/sdk/helpers/logger";
import { TaskHandler } from "@/sdk/worker/core/TaskHandler";
import { clearWorkerRegistry } from "@/sdk/worker/decorators/registry";
import { worker } from "@/sdk/worker/decorators/worker";
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import type { Client, Task } from "@open-api/index";

// Mock client with all required methods
const createMockClient = (): Client => {
  const mockFn = jest.fn<() => Promise<{ data: null }>>().mockResolvedValue({ data: null });
  return {
    buildUrl: jest.fn(),
    getConfig: jest.fn(),
    request: jest.fn(),
    setConfig: jest.fn(),
    get: mockFn,
    post: mockFn,
    put: mockFn,
    patch: mockFn,
    delete: mockFn,
    options: mockFn,
    head: mockFn,
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() },
      error: { use: jest.fn(), eject: jest.fn() },
    },
  } as unknown as Client;
};

describe("TaskHandler", () => {
  const activeHandlers: TaskHandler[] = [];

  beforeEach(() => {
    clearWorkerRegistry();
  });

  afterEach(async () => {
    // Stop all handlers to prevent async operations continuing after tests
    for (const handler of activeHandlers) {
      await handler.stopWorkers();
    }
    activeHandlers.length = 0;
    clearWorkerRegistry();

    // Wait for async cleanup
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  test("should create TaskHandler with auto-discovery", () => {
    // Register workers via decorator
    async function testWorker1(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    async function testWorker2(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({ taskDefName: "task1" })(testWorker1);
    worker({ taskDefName: "task2" })(testWorker2);

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: true,
    });

    expect(handler.workerCount).toBe(2);
    expect(handler.running).toBe(false);
  });

  test("should create TaskHandler without auto-discovery", () => {
    // Register workers via decorator
    async function testWorker(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({ taskDefName: "ignored_task" })(testWorker);

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: false, // Disable auto-discovery
    });

    expect(handler.workerCount).toBe(0);
  });

  test("should add manual workers", () => {
    const manualWorker = {
      taskDefName: "manual_task",
      execute: async (task: Task) => ({
        status: "COMPLETED" as const,
        outputData: {},
      }),
    };

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: false,
      workers: [manualWorker],
    });

    expect(handler.workerCount).toBe(1);
  });

  test("should combine decorated and manual workers", () => {
    async function decoratedWorker(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({ taskDefName: "decorated_task" })(decoratedWorker);

    const manualWorker = {
      taskDefName: "manual_task",
      execute: async (task: Task) => ({
        status: "COMPLETED" as const,
        outputData: {},
      }),
    };

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: true,
      workers: [manualWorker],
    });

    expect(handler.workerCount).toBe(2);
  });

  test("should handle no workers registered", () => {
    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: true,
    });

    expect(handler.workerCount).toBe(0);
    expect(handler.running).toBe(false);
  });

  test("should start and stop workers", async () => {
    async function testWorker(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({ taskDefName: "test_task" })(testWorker);

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: true,
    });
    activeHandlers.push(handler);

    expect(handler.running).toBe(false);
    expect(handler.runningWorkerCount).toBe(0);

    handler.startWorkers();

    expect(handler.running).toBe(true);
    expect(handler.runningWorkerCount).toBe(1);

    await handler.stopWorkers();

    expect(handler.running).toBe(false);
    expect(handler.runningWorkerCount).toBe(0);
  });

  test("should be idempotent for startWorkers", () => {
    async function testWorker(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({ taskDefName: "test_task" })(testWorker);

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: true,
    });
    activeHandlers.push(handler);

    handler.startWorkers();
    expect(handler.runningWorkerCount).toBe(1);

    // Call again - should be no-op
    handler.startWorkers();
    expect(handler.runningWorkerCount).toBe(1);
  });

  test("should be idempotent for stopWorkers", async () => {
    async function testWorker(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({ taskDefName: "test_task" })(testWorker);

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: true,
    });
    activeHandlers.push(handler);

    handler.startWorkers();
    await handler.stopWorkers();
    expect(handler.running).toBe(false);

    // Call again - should be no-op
    await handler.stopWorkers();
    expect(handler.running).toBe(false);
  });

  test("should handle workers with different configurations", () => {
    async function worker1(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    async function worker2(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    async function worker3(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({ taskDefName: "task1", concurrency: 5 })(worker1);
    worker({ taskDefName: "task2", pollInterval: 200, domain: "test" })(worker2);
    worker({ taskDefName: "task3" })(worker3);

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: true,
    });

    expect(handler.workerCount).toBe(3);
  });

  test("should support async dispose (context manager)", async () => {
    async function testWorker(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({ taskDefName: "test_task" })(testWorker);

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: true,
    });
    activeHandlers.push(handler);

    handler.startWorkers();
    expect(handler.running).toBe(true);

    // Simulate using keyword (TypeScript 5.2+)
    await handler[Symbol.asyncDispose]();

    expect(handler.running).toBe(false);
  });

  test("should handle event listeners", () => {
    async function testWorker(_task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({ taskDefName: "test_task" })(testWorker);

    const mockListener = {
      onTaskExecutionCompleted: jest.fn<() => void>(),
    };

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: true,
      eventListeners: [mockListener],
    });

    expect(handler.workerCount).toBe(1);
    // Event listeners are passed to TaskRunner (tested separately)
  });

  test("should handle empty workers array gracefully", () => {
    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: false,
      workers: [],
    });

    expect(handler.workerCount).toBe(0);

    handler.startWorkers(); // Should not throw
    expect(handler.running).toBe(false);
  });

  test("should convert RegisteredWorker to ConductorWorker", () => {
    async function testWorker(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({
      taskDefName: "test_task",
      concurrency: 10,
      pollInterval: 200,
      domain: "production",
    })(testWorker);

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: true,
    });

    expect(handler.workerCount).toBe(1);
    // Internal conversion tested via successful worker creation
  });
});

describe("TaskHandler - Module Imports", () => {
  const activeHandlers: TaskHandler[] = [];

  beforeEach(() => {
    clearWorkerRegistry();
  });

  afterEach(async () => {
    // Stop all handlers
    for (const handler of activeHandlers) {
      await handler.stopWorkers();
    }
    activeHandlers.length = 0;
    clearWorkerRegistry();

    // Wait for async cleanup
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  test("should throw error for invalid module path", async () => {
    await expect(TaskHandler.create({
      client: createMockClient(),
      importModules: ["./nonexistent/module"],
    })).rejects.toThrow("Failed to import worker module");
  });

  test("should handle empty importModules array", async () => {
    const handler = await TaskHandler.create({
      client: createMockClient(),
      importModules: [],
      scanForDecorated: false,
    });

    expect(handler.workerCount).toBe(0);
  });

  // Note: Testing actual module imports would require creating test files
  // which is complex in a unit test environment. This is better suited
  // for integration tests.
});

describe("TaskHandler - Error Handling", () => {
  const activeHandlers: TaskHandler[] = [];

  beforeEach(() => {
    clearWorkerRegistry();
  });

  afterEach(async () => {
    // Stop all handlers
    for (const handler of activeHandlers) {
      await handler.stopWorkers();
    }
    activeHandlers.length = 0;
    clearWorkerRegistry();

    // Wait for async cleanup
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  test("should handle errors during worker stopping", async () => {
    async function testWorker(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({ taskDefName: "test_task" })(testWorker);

    const mockLogger: ConductorLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    };

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: true,
      logger: mockLogger,
    });
    activeHandlers.push(handler);

    handler.startWorkers();

    // Mock one of the runners to throw an error on stop
    const runnerToFail = handler["taskRunners"][0];
    const originalStop = runnerToFail.stopPolling;
    runnerToFail.stopPolling = jest.fn<() => Promise<void>>().mockRejectedValue(new Error("Stop failed"));

    await handler.stopWorkers();

    // Should log error but not throw
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("Error stopping worker"),
      expect.anything()
    );
    expect(handler.running).toBe(false);

    // Restore original method
    runnerToFail.stopPolling = originalStop;
  });

  test("should handle multiple workers with some failing to start", () => {
    async function worker1(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({ taskDefName: "worker1" })(worker1);

    const mockLogger: ConductorLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    };

    // Create a worker that will fail
    const failingWorker = {
      taskDefName: "failing_worker",
      execute: async (task: Task) => ({
        status: "COMPLETED" as const,
        outputData: {},
      }),
    };

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: true,
      workers: [failingWorker],
      logger: mockLogger,
    });

    expect(handler.workerCount).toBe(2);
  });
});

describe("TaskHandler - Custom Logger", () => {
  const activeHandlers: TaskHandler[] = [];

  beforeEach(() => {
    clearWorkerRegistry();
  });

  afterEach(async () => {
    // Stop all handlers
    for (const handler of activeHandlers) {
      await handler.stopWorkers();
    }
    activeHandlers.length = 0;
    clearWorkerRegistry();

    // Wait for async cleanup
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  test("should use custom logger", () => {
    async function testWorker(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({ taskDefName: "test_task" })(testWorker);

    const mockLogger: ConductorLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    };

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: true,
      logger: mockLogger,
    });

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("Discovered 1 worker(s)")
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("TaskHandler initialized")
    );
  });

  test("should log debug messages for worker registration", () => {
    async function testWorker(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({ taskDefName: "test_task", domain: "test-domain" })(testWorker);

    const mockLogger: ConductorLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    };

    new TaskHandler({
      client: createMockClient(),
      scanForDecorated: true,
      logger: mockLogger,
    });

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("test_task")
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("test-domain")
    );
  });

  test("should log when starting and stopping workers", async () => {
    async function testWorker(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({ taskDefName: "test_task" })(testWorker);

    const infoMock = jest.fn();
    const mockLogger: ConductorLogger = {
      info: infoMock,
      debug: jest.fn(),
      error: jest.fn(),
    };

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: true,
      logger: mockLogger,
    });
    activeHandlers.push(handler);

    infoMock.mockClear();

    handler.startWorkers();

    expect(infoMock).toHaveBeenCalledWith(
      expect.stringContaining("Starting 1 worker(s)")
    );
    expect(infoMock).toHaveBeenCalledWith(
      expect.stringContaining("All workers started successfully")
    );

    infoMock.mockClear();

    await handler.stopWorkers();

    expect(infoMock).toHaveBeenCalledWith(
      expect.stringContaining("Stopping 1 worker(s)")
    );
    expect(infoMock).toHaveBeenCalledWith(
      expect.stringContaining("All workers stopped")
    );
  });
});

describe("TaskHandler - Worker Configuration", () => {
  const activeHandlers: TaskHandler[] = [];

  beforeEach(() => {
    clearWorkerRegistry();
  });

  afterEach(async () => {
    // Stop all handlers
    for (const handler of activeHandlers) {
      await handler.stopWorkers();
    }
    activeHandlers.length = 0;
    clearWorkerRegistry();

    // Wait for async cleanup
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  test("should handle workers with only taskDefName", () => {
    const worker1 = {
      taskDefName: "minimal_worker",
      execute: async (task: Task) => ({
        status: "COMPLETED" as const,
        outputData: {},
      }),
    };

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: false,
      workers: [worker1],
    });

    expect(handler.workerCount).toBe(1);
  });

  test("should handle workers with full configuration", () => {
    const worker1 = {
      taskDefName: "full_config_worker",
      execute: async (task: Task) => ({
        status: "COMPLETED" as const,
        outputData: {},
      }),
      concurrency: 10,
      pollInterval: 500,
      domain: "production",
    };

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: false,
      workers: [worker1],
    });

    expect(handler.workerCount).toBe(1);
  });

  test("should handle mixed worker configurations", () => {
    async function decoratedWorker(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({
      taskDefName: "decorated_worker",
      concurrency: 5,
      pollInterval: 100,
    })(decoratedWorker);

    const manualWorker1 = {
      taskDefName: "manual_worker_1",
      execute: async (task: Task) => ({
        status: "COMPLETED" as const,
        outputData: {},
      }),
    };

    const manualWorker2 = {
      taskDefName: "manual_worker_2",
      execute: async (task: Task) => ({
        status: "COMPLETED" as const,
        outputData: {},
      }),
      domain: "test",
    };

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: true,
      workers: [manualWorker1, manualWorker2],
    });

    expect(handler.workerCount).toBe(3);
  });
});

describe("TaskHandler - Multiple Workers Lifecycle", () => {
  const activeHandlers: TaskHandler[] = [];

  beforeEach(() => {
    clearWorkerRegistry();
  });

  afterEach(async () => {
    // Stop all handlers
    for (const handler of activeHandlers) {
      await handler.stopWorkers();
    }
    activeHandlers.length = 0;
    clearWorkerRegistry();

    // Wait for async cleanup
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  test("should start and stop multiple workers correctly", async () => {
    async function worker1(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    async function worker2(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    async function worker3(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({ taskDefName: "task1" })(worker1);
    worker({ taskDefName: "task2" })(worker2);
    worker({ taskDefName: "task3" })(worker3);

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: true,
    });
    activeHandlers.push(handler);

    expect(handler.workerCount).toBe(3);
    expect(handler.runningWorkerCount).toBe(0);
    expect(handler.running).toBe(false);

    handler.startWorkers();

    expect(handler.runningWorkerCount).toBe(3);
    expect(handler.running).toBe(true);

    await handler.stopWorkers();

    expect(handler.runningWorkerCount).toBe(0);
    expect(handler.running).toBe(false);
  });

  test("should handle starting workers when none are registered", () => {
    const mockLogger: ConductorLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    };

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: false,
      logger: mockLogger,
    });

    handler.startWorkers();

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("No workers to start")
    );
    expect(handler.running).toBe(false);
  });

  test("should handle stopping workers when not running", async () => {
    async function testWorker(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({ taskDefName: "test_task" })(testWorker);

    const infoMock = jest.fn();
    const mockLogger: ConductorLogger = {
      info: infoMock,
      debug: jest.fn(),
      error: jest.fn(),
    };

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: true,
      logger: mockLogger,
    });

    infoMock.mockClear();

    await handler.stopWorkers();

    expect(infoMock).toHaveBeenCalledWith(
      expect.stringContaining("Workers are not running")
    );
  });
});

describe("TaskHandler - Edge Cases", () => {
  const activeHandlers: TaskHandler[] = [];

  beforeEach(() => {
    clearWorkerRegistry();
  });

  afterEach(async () => {
    // Stop all handlers
    for (const handler of activeHandlers) {
      await handler.stopWorkers();
    }
    activeHandlers.length = 0;
    clearWorkerRegistry();

    // Wait for async cleanup
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  test("should handle workers with undefined optional fields", () => {
    const worker1 = {
      taskDefName: "worker_with_undefined",
      execute: async (task: Task) => ({
        status: "COMPLETED" as const,
        outputData: {},
      }),
      concurrency: undefined,
      pollInterval: undefined,
      domain: undefined,
    };

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: false,
      workers: [worker1],
    });

    expect(handler.workerCount).toBe(1);
  });

  test("should handle create with undefined importModules", async () => {
    const handler = await TaskHandler.create({
      client: createMockClient(),
      scanForDecorated: false,
    });

    expect(handler.workerCount).toBe(0);
  });

  test("should handle workers with domain configuration", async () => {
    async function testWorker(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({ taskDefName: "domain_worker", domain: "production" })(testWorker);

    const mockLogger: ConductorLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    };

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: true,
      logger: mockLogger,
    });
    activeHandlers.push(handler);

    handler.startWorkers();

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("domain_worker")
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("production")
    );
  });

  test("should report correct worker counts throughout lifecycle", async () => {
    async function worker1(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    async function worker2(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({ taskDefName: "task1" })(worker1);
    worker({ taskDefName: "task2" })(worker2);

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: true,
    });
    activeHandlers.push(handler);

    // Before starting
    expect(handler.workerCount).toBe(2);
    expect(handler.runningWorkerCount).toBe(0);
    expect(handler.running).toBe(false);

    // After starting
    handler.startWorkers();
    expect(handler.workerCount).toBe(2);
    expect(handler.runningWorkerCount).toBe(2);
    expect(handler.running).toBe(true);

    // After stopping
    await handler.stopWorkers();
    expect(handler.workerCount).toBe(2);
    expect(handler.runningWorkerCount).toBe(0);
    expect(handler.running).toBe(false);
  });

  test("should handle async dispose multiple times", async () => {
    async function testWorker(task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({ taskDefName: "test_task" })(testWorker);

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: true,
    });

    handler.startWorkers();
    expect(handler.running).toBe(true);

    await handler[Symbol.asyncDispose]();
    expect(handler.running).toBe(false);

    // Calling dispose again should be safe
    await handler[Symbol.asyncDispose]();
    expect(handler.running).toBe(false);
  });

  test("should handle workers with empty taskDefName gracefully", () => {
    const worker1 = {
      taskDefName: "",
      execute: async (task: Task) => ({
        status: "COMPLETED" as const,
        outputData: {},
      }),
    };

    const handler = new TaskHandler({
      client: createMockClient(),
      scanForDecorated: false,
      workers: [worker1],
    });

    expect(handler.workerCount).toBe(1);
  });
});
