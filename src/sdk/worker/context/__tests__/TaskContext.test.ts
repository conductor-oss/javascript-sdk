import { describe, it, expect } from "@jest/globals";
import {
  TaskContext,
  getTaskContext,
  runWithTaskContext,
} from "../TaskContext";
import type { Task } from "../../../../open-api";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    taskId: "task-123",
    workflowInstanceId: "wf-456",
    taskDefName: "test_task",
    retryCount: 2,
    pollCount: 5,
    inputData: { key1: "value1", key2: 42 },
    ...overrides,
  };
}

describe("TaskContext", () => {
  describe("metadata getters", () => {
    it("should return task metadata", () => {
      const task = makeTask();
      const ctx = new TaskContext(task);

      expect(ctx.getTaskId()).toBe("task-123");
      expect(ctx.getWorkflowInstanceId()).toBe("wf-456");
      expect(ctx.getRetryCount()).toBe(2);
      expect(ctx.getPollCount()).toBe(5);
      expect(ctx.getTaskDefName()).toBe("test_task");
      expect(ctx.getInput()).toEqual({ key1: "value1", key2: 42 });
      expect(ctx.getTask()).toBe(task);
    });

    it("should return 0 for missing retryCount and pollCount", () => {
      const ctx = new TaskContext(makeTask({ retryCount: undefined, pollCount: undefined }));
      expect(ctx.getRetryCount()).toBe(0);
      expect(ctx.getPollCount()).toBe(0);
    });

    it("should return empty object for missing inputData", () => {
      const ctx = new TaskContext(makeTask({ inputData: undefined }));
      expect(ctx.getInput()).toEqual({});
    });
  });

  describe("addLog", () => {
    it("should accumulate log entries", () => {
      const ctx = new TaskContext(makeTask());
      ctx.addLog("Step 1 started");
      ctx.addLog("Step 2 started");

      const logs = ctx.getLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0]!.log).toBe("Step 1 started");
      expect(logs[0]!.taskId).toBe("task-123");
      expect(typeof logs[0]!.createdTime).toBe("number");
      expect(logs[1]!.log).toBe("Step 2 started");
    });

    it("should return a copy of logs", () => {
      const ctx = new TaskContext(makeTask());
      ctx.addLog("test");
      const logs1 = ctx.getLogs();
      const logs2 = ctx.getLogs();
      expect(logs1).not.toBe(logs2);
      expect(logs1).toEqual(logs2);
    });
  });

  describe("setCallbackAfter", () => {
    it("should store and retrieve callbackAfterSeconds", () => {
      const ctx = new TaskContext(makeTask());
      expect(ctx.getCallbackAfterSeconds()).toBeUndefined();

      ctx.setCallbackAfter(30);
      expect(ctx.getCallbackAfterSeconds()).toBe(30);
    });
  });

  describe("setOutput", () => {
    it("should store and retrieve output data", () => {
      const ctx = new TaskContext(makeTask());
      expect(ctx.getOutput()).toBeUndefined();

      ctx.setOutput({ progress: 50, status: "processing" });
      expect(ctx.getOutput()).toEqual({ progress: 50, status: "processing" });
    });
  });
});

describe("getTaskContext", () => {
  it("should return undefined outside of task execution", () => {
    expect(getTaskContext()).toBeUndefined();
  });

  it("should return context during task execution", async () => {
    const task = makeTask();
    let capturedCtx: TaskContext | undefined;

    await runWithTaskContext(task, async (ctx) => {
      capturedCtx = getTaskContext();
      expect(capturedCtx).toBe(ctx);
      expect(capturedCtx!.getTaskId()).toBe("task-123");
    });

    expect(capturedCtx).toBeDefined();
  });

  it("should return undefined after task execution completes", async () => {
    await runWithTaskContext(makeTask(), async () => {
      // Inside — context exists
      expect(getTaskContext()).toBeDefined();
    });
    // Outside — context gone
    expect(getTaskContext()).toBeUndefined();
  });
});

describe("runWithTaskContext", () => {
  it("should provide context to the callback", async () => {
    const task = makeTask({ taskId: "t1", inputData: { x: 1 } });

    const result = await runWithTaskContext(task, async (ctx) => {
      ctx.addLog("hello");
      ctx.setCallbackAfter(60);
      ctx.setOutput({ partial: true });
      return "done";
    });

    expect(result).toBe("done");
  });

  it("should isolate concurrent task contexts", async () => {
    const task1 = makeTask({ taskId: "t1" });
    const task2 = makeTask({ taskId: "t2" });

    const results = await Promise.all([
      runWithTaskContext(task1, async () => {
        // Small delay to allow interleaving
        await new Promise((r) => setTimeout(r, 10));
        const ctx = getTaskContext();
        ctx!.addLog("from t1");
        return { id: ctx!.getTaskId(), logs: ctx!.getLogs() };
      }),
      runWithTaskContext(task2, async () => {
        await new Promise((r) => setTimeout(r, 5));
        const ctx = getTaskContext();
        ctx!.addLog("from t2");
        return { id: ctx!.getTaskId(), logs: ctx!.getLogs() };
      }),
    ]);

    expect(results[0]!.id).toBe("t1");
    expect(results[0]!.logs).toHaveLength(1);
    expect(results[0]!.logs[0]!.log).toBe("from t1");

    expect(results[1]!.id).toBe("t2");
    expect(results[1]!.logs).toHaveLength(1);
    expect(results[1]!.logs[0]!.log).toBe("from t2");
  });

  it("should propagate errors from the callback", async () => {
    await expect(
      runWithTaskContext(makeTask(), async () => {
        throw new Error("task failed");
      })
    ).rejects.toThrow("task failed");
  });
});
