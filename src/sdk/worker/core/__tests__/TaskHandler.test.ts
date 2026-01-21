/* eslint-disable @typescript-eslint/no-unused-vars */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import type { Client, Task } from "../../../../open-api";
import { clearWorkerRegistry } from "../../decorators/registry";
import { worker } from "../../decorators/worker";
import { TaskHandler } from "../TaskHandler";

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

  // Note: Testing actual module imports would require creating test files
  // which is complex in a unit test environment. This is better suited
  // for integration tests.
});
