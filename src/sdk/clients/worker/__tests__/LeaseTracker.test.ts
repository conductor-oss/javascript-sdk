import { LeaseTracker, LeaseInfo } from "@/sdk/clients/worker/LeaseTracker";
import { LEASE_EXTEND_DURATION_FACTOR, LEASE_EXTEND_RETRY_COUNT, HEARTBEAT_RETRY_DELAY_MS } from "@/sdk/clients/worker/constants";
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import type { Task } from "@open-api/index";
import { mockLogger } from "@test-utils/mockLogger";

describe("LeaseTracker", () => {
  let sendHeartbeatFn: jest.Mock<(taskId: string, workflowInstanceId: string) => Promise<void>>;
  let tracker: LeaseTracker;

  beforeEach(() => {
    jest.useFakeTimers();
    sendHeartbeatFn = jest.fn<(taskId: string, workflowInstanceId: string) => Promise<void>>().mockResolvedValue(undefined);
    tracker = new LeaseTracker(sendHeartbeatFn, mockLogger);
  });

  afterEach(() => {
    tracker.stop();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const makeTask = (overrides: Partial<Task> = {}): Task =>
    ({
      taskId: "task-1",
      workflowInstanceId: "wf-1",
      responseTimeoutSeconds: 10,
      ...overrides,
    } as Task);

  describe("track()", () => {
    test("does not track when responseTimeoutSeconds is 0", async () => {
      tracker.track(makeTask({ responseTimeoutSeconds: 0 }));
      tracker.start();
      await jest.advanceTimersByTimeAsync(20000);
      expect(sendHeartbeatFn).not.toHaveBeenCalled();
    });

    test("does not track when responseTimeoutSeconds is undefined", async () => {
      tracker.track(makeTask({ responseTimeoutSeconds: undefined }));
      tracker.start();
      await jest.advanceTimersByTimeAsync(20000);
      expect(sendHeartbeatFn).not.toHaveBeenCalled();
    });

    test("does not track when computed interval < 1000ms (responseTimeoutSeconds = 1 → 800ms)", async () => {
      tracker.track(makeTask({ responseTimeoutSeconds: 1 }));
      tracker.start();
      await jest.advanceTimersByTimeAsync(5000);
      expect(sendHeartbeatFn).not.toHaveBeenCalled();
    });

    test("tracks task with interval = responseTimeoutSeconds * 0.8 * 1000", async () => {
      // responseTimeoutSeconds=10 → intervalMs=8000ms
      tracker.track(makeTask({ responseTimeoutSeconds: 10 }));
      tracker.start();

      // Just before due — no heartbeat
      await jest.advanceTimersByTimeAsync(7900);
      expect(sendHeartbeatFn).not.toHaveBeenCalled();

      // Past the interval — heartbeat fires
      await jest.advanceTimersByTimeAsync(200);
      expect(sendHeartbeatFn).toHaveBeenCalledTimes(1);
      // Verify correct arguments passed to heartbeat function
      expect(sendHeartbeatFn).toHaveBeenCalledWith("task-1", "wf-1");
    });

    test("sends repeated heartbeats", async () => {
      // responseTimeoutSeconds=5 → intervalMs=4000ms
      tracker.track(makeTask({ responseTimeoutSeconds: 5 }));
      tracker.start();

      await jest.advanceTimersByTimeAsync(4100);
      expect(sendHeartbeatFn).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(4000);
      expect(sendHeartbeatFn).toHaveBeenCalledTimes(2);
    });
  });

  describe("untrack()", () => {
    test("stops heartbeats after untrack", async () => {
      tracker.track(makeTask({ responseTimeoutSeconds: 10 }));
      tracker.start();
      tracker.untrack("task-1");

      await jest.advanceTimersByTimeAsync(20000);
      expect(sendHeartbeatFn).not.toHaveBeenCalled();
    });

    test("untrack is a no-op for unknown taskId", () => {
      // Should not throw
      expect(() => tracker.untrack("does-not-exist")).not.toThrow();
    });
  });

  describe("heartbeat retries", () => {
    test(`retries up to LEASE_EXTEND_RETRY_COUNT (${LEASE_EXTEND_RETRY_COUNT}) times on failure`, async () => {
      sendHeartbeatFn.mockRejectedValue(new Error("connection failed"));
      tracker.track(makeTask({ responseTimeoutSeconds: 10 }));
      tracker.start();

      // Trigger the first heartbeat chain
      await jest.advanceTimersByTimeAsync(8100);
      // Stop the interval HERE — chain 1 is now in-flight but no second chain can start
      // (must be before draining retries: if stopped after, the interval fires again at ~9200ms)
      tracker.stop();
      // Drain chain 1's retries: each waits HEARTBEAT_RETRY_DELAY_MS (500ms)
      await jest.advanceTimersByTimeAsync(LEASE_EXTEND_RETRY_COUNT * HEARTBEAT_RETRY_DELAY_MS + 100);

      expect(sendHeartbeatFn).toHaveBeenCalledTimes(LEASE_EXTEND_RETRY_COUNT);
    });

    test("does not remove task from tracking after heartbeat failure", async () => {
      let callCount = 0;
      sendHeartbeatFn.mockImplementation(async () => {
        callCount++;
        if (callCount <= LEASE_EXTEND_RETRY_COUNT) throw new Error("fail");
      });

      tracker.track(makeTask({ responseTimeoutSeconds: 10 }));
      tracker.start();

      // First heartbeat attempt (all retries fail)
      await jest.advanceTimersByTimeAsync(8100);
      await jest.advanceTimersByTimeAsync(LEASE_EXTEND_RETRY_COUNT * HEARTBEAT_RETRY_DELAY_MS + 100);

      // Task is still tracked — next interval fires a second heartbeat sequence
      await jest.advanceTimersByTimeAsync(8000 + LEASE_EXTEND_RETRY_COUNT * 500 + 100);
      // >= LEASE_EXTEND_RETRY_COUNT + 1 proves: first chain ran all retries AND
      // a second chain was launched (task was not removed from tracking)
      expect(sendHeartbeatFn.mock.calls.length).toBeGreaterThanOrEqual(LEASE_EXTEND_RETRY_COUNT + 1);
    });
  });

  describe("start() / stop()", () => {
    test("start() is idempotent — calling twice does not double-fire", async () => {
      tracker.track(makeTask({ responseTimeoutSeconds: 10 }));
      tracker.start();
      tracker.start(); // second call should be a no-op

      await jest.advanceTimersByTimeAsync(8100);
      expect(sendHeartbeatFn).toHaveBeenCalledTimes(1);
    });

    test("stop() prevents further heartbeats", async () => {
      tracker.track(makeTask({ responseTimeoutSeconds: 10 }));
      tracker.start();
      tracker.stop();

      await jest.advanceTimersByTimeAsync(20000);
      expect(sendHeartbeatFn).not.toHaveBeenCalled();
    });
  });
});
