import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { LivenessMonitor } from "../liveness.js";
import { WorkerStallError } from "../errors.js";
import type { WorkflowClient, WorkflowExecution } from "../../sdk/clients/agent/WorkflowClient.js";

type GetWorkflow = (executionId: string, includeTasks?: boolean) => Promise<WorkflowExecution>;

function fakeGetWorkflow(): jest.Mock<GetWorkflow> {
  return jest.fn<GetWorkflow>();
}

function makeMonitor(
  getWorkflow: jest.Mock<GetWorkflow>,
  overrides: Partial<{
    executionId: string;
    domain: string;
    stallSeconds: number;
    checkIntervalSeconds: number;
    onStall: (error: WorkerStallError) => void;
  }> = {},
): LivenessMonitor {
  return new LivenessMonitor({
    workflows: { getWorkflow } as unknown as WorkflowClient,
    executionId: overrides.executionId ?? "exec-1",
    domain: overrides.domain ?? "run-1",
    stallSeconds: overrides.stallSeconds ?? 30,
    checkIntervalSeconds: overrides.checkIntervalSeconds ?? 10,
    onStall: overrides.onStall ?? jest.fn(),
  });
}

describe("LivenessMonitor (spec R11)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("flags a SCHEDULED task with pollCount=0 queued past the stall window", async () => {
    const now = Date.now();
    const getWorkflow = fakeGetWorkflow();
    getWorkflow.mockResolvedValue({
      status: "RUNNING",
      tasks: [
        {
          status: "SCHEDULED",
          domain: "run-1",
          pollCount: 0,
          taskId: "task-1",
          taskDefName: "my_tool",
          scheduledTime: now - 60_000,
        },
      ],
    });
    const onStall = jest.fn<(error: WorkerStallError) => void>();
    const monitor = makeMonitor(getWorkflow, { onStall, stallSeconds: 30, checkIntervalSeconds: 10 });

    monitor.start();
    await jest.advanceTimersByTimeAsync(10_000);
    monitor.stop();

    expect(onStall).toHaveBeenCalledTimes(1);
    const err = onStall.mock.calls[0][0];
    expect(err).toBeInstanceOf(WorkerStallError);
    expect(err.executionId).toBe("exec-1");
    expect(err.taskDefName).toBe("my_tool");
    expect(err.taskId).toBe("task-1");
  });

  it("flags an IN_PROGRESS task with pollCount=0 the same as SCHEDULED", async () => {
    const now = Date.now();
    const getWorkflow = fakeGetWorkflow();
    getWorkflow.mockResolvedValue({
      status: "RUNNING",
      tasks: [
        {
          status: "IN_PROGRESS",
          domain: "run-1",
          pollCount: 0,
          taskId: "task-1",
          taskDefName: "my_tool",
          scheduledTime: now - 60_000,
        },
      ],
    });
    const onStall = jest.fn<(error: WorkerStallError) => void>();
    const monitor = makeMonitor(getWorkflow, { onStall, stallSeconds: 30, checkIntervalSeconds: 10 });

    monitor.start();
    await jest.advanceTimersByTimeAsync(10_000);
    monitor.stop();

    expect(onStall).toHaveBeenCalledTimes(1);
  });

  it("does not flag a task outside this run's domain", async () => {
    const now = Date.now();
    const getWorkflow = fakeGetWorkflow();
    getWorkflow.mockResolvedValue({
      status: "RUNNING",
      tasks: [
        {
          status: "SCHEDULED",
          domain: "some-other-domain",
          pollCount: 0,
          taskId: "task-1",
          taskDefName: "my_tool",
          scheduledTime: now - 60_000,
        },
      ],
    });
    const onStall = jest.fn<(error: WorkerStallError) => void>();
    const monitor = makeMonitor(getWorkflow, { onStall, stallSeconds: 30, checkIntervalSeconds: 10 });

    monitor.start();
    await jest.advanceTimersByTimeAsync(10_000);
    monitor.stop();

    expect(onStall).not.toHaveBeenCalled();
  });

  it("does not flag a task that has been polled at least once", async () => {
    const now = Date.now();
    const getWorkflow = fakeGetWorkflow();
    getWorkflow.mockResolvedValue({
      status: "RUNNING",
      tasks: [
        {
          status: "SCHEDULED",
          domain: "run-1",
          pollCount: 1,
          taskId: "task-1",
          taskDefName: "my_tool",
          scheduledTime: now - 60_000,
        },
      ],
    });
    const onStall = jest.fn<(error: WorkerStallError) => void>();
    const monitor = makeMonitor(getWorkflow, { onStall, stallSeconds: 30, checkIntervalSeconds: 10 });

    monitor.start();
    await jest.advanceTimersByTimeAsync(10_000);
    monitor.stop();

    expect(onStall).not.toHaveBeenCalled();
  });

  it("does not flag a task still within the stall window", async () => {
    const now = Date.now();
    const getWorkflow = fakeGetWorkflow();
    getWorkflow.mockResolvedValue({
      status: "RUNNING",
      tasks: [
        {
          status: "SCHEDULED",
          domain: "run-1",
          pollCount: 0,
          taskId: "task-1",
          taskDefName: "my_tool",
          scheduledTime: now - 1_000, // 1s queued, 30s window
        },
      ],
    });
    const onStall = jest.fn<(error: WorkerStallError) => void>();
    const monitor = makeMonitor(getWorkflow, { onStall, stallSeconds: 30, checkIntervalSeconds: 10 });

    monitor.start();
    await jest.advanceTimersByTimeAsync(10_000);
    monitor.stop();

    expect(onStall).not.toHaveBeenCalled();
  });

  it("does not re-report the same stalled task across multiple ticks", async () => {
    const now = Date.now();
    const getWorkflow = fakeGetWorkflow();
    getWorkflow.mockResolvedValue({
      status: "RUNNING",
      tasks: [
        {
          status: "SCHEDULED",
          domain: "run-1",
          pollCount: 0,
          taskId: "task-1",
          taskDefName: "my_tool",
          scheduledTime: now - 60_000,
        },
      ],
    });
    const onStall = jest.fn<(error: WorkerStallError) => void>();
    const monitor = makeMonitor(getWorkflow, { onStall, stallSeconds: 30, checkIntervalSeconds: 10 });

    monitor.start();
    await jest.advanceTimersByTimeAsync(30_000); // 3 ticks
    monitor.stop();

    expect(onStall).toHaveBeenCalledTimes(1);
    expect(getWorkflow).toHaveBeenCalledTimes(3);
  });

  it("stops polling once the workflow reaches a terminal status", async () => {
    const getWorkflow = fakeGetWorkflow();
    getWorkflow.mockResolvedValue({ status: "COMPLETED", tasks: [] });
    const monitor = makeMonitor(getWorkflow, { checkIntervalSeconds: 10 });

    monitor.start();
    await jest.advanceTimersByTimeAsync(10_000);
    expect(getWorkflow).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(30_000);
    expect(getWorkflow).toHaveBeenCalledTimes(1); // no further polls after terminal
  });

  it("stop() halts further polling immediately", async () => {
    const getWorkflow = fakeGetWorkflow();
    getWorkflow.mockResolvedValue({ status: "RUNNING", tasks: [] });
    const monitor = makeMonitor(getWorkflow, { checkIntervalSeconds: 10 });

    monitor.start();
    monitor.stop();
    await jest.advanceTimersByTimeAsync(30_000);

    expect(getWorkflow).not.toHaveBeenCalled();
  });

  it("swallows getWorkflow errors and retries on the next interval", async () => {
    const getWorkflow = fakeGetWorkflow();
    getWorkflow.mockRejectedValueOnce(new Error("network blip")).mockResolvedValue({
      status: "RUNNING",
      tasks: [],
    });
    const monitor = makeMonitor(getWorkflow, { checkIntervalSeconds: 10 });

    monitor.start();
    await jest.advanceTimersByTimeAsync(20_000);
    monitor.stop();

    expect(getWorkflow).toHaveBeenCalledTimes(2);
  });
});
