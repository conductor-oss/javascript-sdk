/* eslint-disable @typescript-eslint/no-unused-vars */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import type { Task } from "../../../../open-api";
import {
  clearWorkerRegistry,
  getRegisteredWorker,
  getRegisteredWorkers,
  getWorkerCount,
  registerWorker,
} from "../registry";
import { worker } from "../worker";

describe("@worker decorator", () => {
  beforeEach(() => {
    clearWorkerRegistry();
  });

  afterEach(() => {
    clearWorkerRegistry();
  });

  test("should register a decorated function", () => {
    // Define function first, then apply decorator
    async function testWorker(_task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    // Apply decorator manually (equivalent to @worker)
    worker({ taskDefName: "test_task" })(testWorker);

    const workers = getRegisteredWorkers();
    expect(workers).toHaveLength(1);
    expect(workers[0].taskDefName).toBe("test_task");
    expect(workers[0].executeFunction).toBe(testWorker);
  });

  test("should register with all options", () => {
    const taskDef = {
      name: "complex_task",
      retryCount: 3,
      timeoutSeconds: 300,
      totalTimeoutSeconds: 3600,
    };

    async function complexWorker(_task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({
      taskDefName: "complex_task",
      concurrency: 10,
      pollInterval: 200,
      domain: "production",
      workerId: "worker-123",
      registerTaskDef: true,
      pollTimeout: 500,
      taskDef,
      overwriteTaskDef: false,
      strictSchema: true,
    })(complexWorker);

    const registered = getRegisteredWorker("complex_task", "production");
    expect(registered).toBeDefined();
    expect(registered?.concurrency).toBe(10);
    expect(registered?.pollInterval).toBe(200);
    expect(registered?.domain).toBe("production");
    expect(registered?.workerId).toBe("worker-123");
    expect(registered?.registerTaskDef).toBe(true);
    expect(registered?.pollTimeout).toBe(500);
    expect(registered?.taskDef).toBe(taskDef);
    expect(registered?.overwriteTaskDef).toBe(false);
    expect(registered?.strictSchema).toBe(true);
  });

  test("should register multiple workers", () => {
    async function worker1(_task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    async function worker2(_task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    async function worker3(_task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({ taskDefName: "task1" })(worker1);
    worker({ taskDefName: "task2" })(worker2);
    worker({ taskDefName: "task3", domain: "test" })(worker3);

    expect(getWorkerCount()).toBe(3);
    expect(getRegisteredWorker("task1")).toBeDefined();
    expect(getRegisteredWorker("task2")).toBeDefined();
    expect(getRegisteredWorker("task3", "test")).toBeDefined();
  });

  test("should handle workers with same name but different domains", () => {
    async function worker1(_task: Task) {
      return { status: "COMPLETED" as const, outputData: { domain: 1 } };
    }

    async function worker2(_task: Task) {
      return { status: "COMPLETED" as const, outputData: { domain: 2 } };
    }

    async function worker3(_task: Task) {
      return { status: "COMPLETED" as const, outputData: { domain: 3 } };
    }

    worker({ taskDefName: "shared_task", domain: "domain1" })(worker1);
    worker({ taskDefName: "shared_task", domain: "domain2" })(worker2);
    worker({ taskDefName: "shared_task" })(worker3); // No domain

    expect(getWorkerCount()).toBe(3);

    const w1 = getRegisteredWorker("shared_task", "domain1");
    const w2 = getRegisteredWorker("shared_task", "domain2");
    const w3 = getRegisteredWorker("shared_task");

    expect(w1?.executeFunction).toBe(worker1);
    expect(w2?.executeFunction).toBe(worker2);
    expect(w3?.executeFunction).toBe(worker3);
  });

  test("should throw error if taskDefName is missing", () => {
    async function invalidWorker(_task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    expect(() => {
      // @ts-expect-error - Testing missing required field
      worker({})(invalidWorker);
    }).toThrow("requires 'taskDefName'");
  });

  test("should throw error if applied to non-function", () => {
    expect(() => {
      const notAFunction = "invalid";
      worker({ taskDefName: "test" })(notAFunction as never);
    }).toThrow("can only be applied to functions");
  });

  test("should allow decorated function to be called normally", async () => {
    async function callableWorker(task: Task) {
      return {
        status: "COMPLETED" as const,
        outputData: { result: (task.inputData as Record<string, number>).value * 2 },
      };
    }

    worker({ taskDefName: "callable_task" })(callableWorker);

    // Function should still be callable
    const result = await callableWorker({
      inputData: { value: 5 },
    } as Task);

    expect(result.status).toBe("COMPLETED");
    expect(result.outputData.result).toBe(10);
  });

  test("should warn when registering duplicate worker", () => {
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    async function worker1(_task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    async function worker2(_task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({ taskDefName: "duplicate_task" })(worker1);
    worker({ taskDefName: "duplicate_task" })(worker2);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("already registered")
    );
    expect(getWorkerCount()).toBe(1); // Second overwrites first

    const registered = getRegisteredWorker("duplicate_task");
    expect(registered?.executeFunction).toBe(worker2); // Latest wins

    consoleSpy.mockRestore();
  });

  test("should support class method decoration", () => {
    class WorkerClass {
      async processTask(_task: Task) {
        return { status: "COMPLETED" as const, outputData: {} };
      }
    }

    const instance = new WorkerClass();
    worker({ taskDefName: "class_method_task" })(instance.processTask.bind(instance));

    const workers = getRegisteredWorkers();
    expect(workers).toHaveLength(1);
    expect(workers[0].taskDefName).toBe("class_method_task");
  });

  test("should clear registry", () => {
    async function worker1(_task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    async function worker2(_task: Task) {
      return { status: "COMPLETED" as const, outputData: {} };
    }

    worker({ taskDefName: "task1" })(worker1);
    worker({ taskDefName: "task2" })(worker2);

    expect(getWorkerCount()).toBe(2);

    clearWorkerRegistry();

    expect(getWorkerCount()).toBe(0);
    expect(getRegisteredWorkers()).toHaveLength(0);
  });
});

describe("Worker Registry", () => {
  beforeEach(() => {
    clearWorkerRegistry();
  });

  afterEach(() => {
    clearWorkerRegistry();
  });

  test("should register worker manually", () => {
    const executeFunction = async (_task: Task) => ({
      status: "COMPLETED" as const,
      outputData: {},
    });

    registerWorker({
      taskDefName: "manual_task",
      executeFunction,
      concurrency: 5,
    });

    const registered = getRegisteredWorker("manual_task");
    expect(registered).toBeDefined();
    expect(registered?.taskDefName).toBe("manual_task");
    expect(registered?.concurrency).toBe(5);
  });

  test("should get all registered workers", () => {
    const worker1 = async (_task: Task) => ({
      status: "COMPLETED" as const,
      outputData: {},
    });
    const worker2 = async (_task: Task) => ({
      status: "COMPLETED" as const,
      outputData: {},
    });

    registerWorker({ taskDefName: "task1", executeFunction: worker1 });
    registerWorker({ taskDefName: "task2", executeFunction: worker2 });

    const all = getRegisteredWorkers();
    expect(all).toHaveLength(2);
    expect(all.map((w) => w.taskDefName).sort()).toEqual(["task1", "task2"]);
  });

  test("should get worker by name and domain", () => {
    const executeFunction = async (_task: Task) => ({
      status: "COMPLETED" as const,
      outputData: {},
    });

    registerWorker({
      taskDefName: "domain_task",
      domain: "production",
      executeFunction,
    });

    expect(getRegisteredWorker("domain_task", "production")).toBeDefined();
    expect(getRegisteredWorker("domain_task")).toBeUndefined();
    expect(getRegisteredWorker("domain_task", "staging")).toBeUndefined();
  });
});
