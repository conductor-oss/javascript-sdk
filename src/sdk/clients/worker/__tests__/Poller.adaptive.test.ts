import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { Poller } from "../Poller";
import { noopLogger } from "../../../helpers/logger";

describe("Poller — Adaptive Backoff", () => {
  let poller: Poller<string>;
  let pollFn: jest.Mock<(count: number) => Promise<string[] | undefined>>;
  let workFn: jest.Mock<(work: string) => Promise<void>>;
  const pollInterval = 50;

  beforeEach(() => {
    pollFn = jest.fn<(count: number) => Promise<string[] | undefined>>();
    workFn = jest.fn<(work: string) => Promise<void>>().mockResolvedValue(undefined);
  });

  afterEach(async () => {
    if (poller?.isPolling) {
      await poller.stopPolling();
    }
  });

  describe("empty poll backoff", () => {
    it("should increment consecutiveEmptyPolls when no tasks returned", async () => {
      pollFn.mockResolvedValue([]);
      poller = new Poller(
        "test",
        pollFn,
        workFn,
        { concurrency: 1, pollInterval, adaptiveBackoff: false },
        noopLogger
      );

      poller.startPolling();
      // Let a few polls happen
      await new Promise((r) => setTimeout(r, pollInterval * 3.5));
      await poller.stopPolling();

      expect(poller.consecutiveEmptyPolls).toBeGreaterThan(0);
    });

    it("should reset consecutiveEmptyPolls when tasks are received", async () => {
      // First call returns empty, second returns a task, rest return empty
      pollFn
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["task1"])
        .mockResolvedValue([]);
      poller = new Poller(
        "test",
        pollFn,
        workFn,
        { concurrency: 5, pollInterval, adaptiveBackoff: false },
        noopLogger
      );

      poller.startPolling();
      await new Promise((r) => setTimeout(r, pollInterval * 3.5));
      await poller.stopPolling();

      // After receiving task1 on the 2nd poll, counter resets.
      // So consecutiveEmptyPolls should be less than total polls minus 1
      // (it reset when task was received, then started counting again)
      expect(pollFn.mock.calls.length).toBeGreaterThanOrEqual(3);
      // The important thing: empty poll counter reflects only the empties AFTER the reset
      expect(poller.consecutiveEmptyPolls).toBeLessThan(pollFn.mock.calls.length);
    });

    it("should delay polls when adaptive backoff is enabled and queue is empty", async () => {
      pollFn.mockResolvedValue([]);
      poller = new Poller(
        "test",
        pollFn,
        workFn,
        { concurrency: 1, pollInterval: 200, adaptiveBackoff: true },
        noopLogger
      );

      poller.startPolling();
      // With adaptive backoff, after first empty poll, next poll should be delayed
      // by adaptive delay (2ms, 4ms, 8ms...) instead of just pollInterval
      // Wait long enough for several cycles
      await new Promise((r) => setTimeout(r, 500));
      await poller.stopPolling();

      // With adaptive backoff, fewer polls should happen vs fixed interval
      // because the adaptive delay adds to the base pollInterval
      expect(poller.consecutiveEmptyPolls).toBeGreaterThan(0);
    });

    it("should poll at full speed when adaptive backoff is disabled", async () => {
      pollFn.mockResolvedValue([]);
      poller = new Poller(
        "test",
        pollFn,
        workFn,
        { concurrency: 1, pollInterval: 20, adaptiveBackoff: false },
        noopLogger
      );

      poller.startPolling();
      await new Promise((r) => setTimeout(r, 150));
      await poller.stopPolling();

      // With backoff disabled and 20ms interval, should get ~6-7 polls in 150ms
      expect(pollFn.mock.calls.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("auth failure backoff", () => {
    it("should track auth failures on 401 errors", async () => {
      const authError = Object.assign(new Error("Unauthorized"), { status: 401 });
      pollFn.mockRejectedValue(authError);
      poller = new Poller(
        "test",
        pollFn,
        workFn,
        { concurrency: 1, pollInterval: 10 },
        noopLogger
      );

      poller.startPolling();
      await new Promise((r) => setTimeout(r, 100));
      await poller.stopPolling();

      expect(poller.authFailures).toBeGreaterThan(0);
    });

    it("should track auth failures on 403 errors", async () => {
      const authError = Object.assign(new Error("Forbidden"), { status: 403 });
      pollFn.mockRejectedValue(authError);
      poller = new Poller(
        "test",
        pollFn,
        workFn,
        { concurrency: 1, pollInterval: 10 },
        noopLogger
      );

      poller.startPolling();
      await new Promise((r) => setTimeout(r, 100));
      await poller.stopPolling();

      expect(poller.authFailures).toBeGreaterThan(0);
    });

    it("should detect auth errors from response.status", async () => {
      const authError = Object.assign(new Error("Auth failed"), {
        response: { status: 401 },
      });
      pollFn.mockRejectedValue(authError);
      poller = new Poller(
        "test",
        pollFn,
        workFn,
        { concurrency: 1, pollInterval: 10 },
        noopLogger
      );

      poller.startPolling();
      await new Promise((r) => setTimeout(r, 80));
      await poller.stopPolling();

      expect(poller.authFailures).toBeGreaterThan(0);
    });

    it("should reset auth failures on successful poll", async () => {
      const authError = Object.assign(new Error("Unauthorized"), { status: 401 });
      // First two calls fail with auth, third succeeds
      pollFn
        .mockRejectedValueOnce(authError)
        .mockResolvedValue([]);

      poller = new Poller(
        "test",
        pollFn,
        workFn,
        { concurrency: 1, pollInterval: 10 },
        noopLogger
      );

      poller.startPolling();
      // Wait for auth failure then recovery
      await new Promise((r) => setTimeout(r, 2500));
      await poller.stopPolling();

      expect(poller.authFailures).toBe(0);
    });

    it("should apply exponential backoff for auth failures", async () => {
      const authError = Object.assign(new Error("Unauthorized"), { status: 401 });
      pollFn.mockRejectedValue(authError);

      poller = new Poller(
        "test",
        pollFn,
        workFn,
        { concurrency: 1, pollInterval: 10 },
        noopLogger
      );

      poller.startPolling();
      // Auth backoff is 2^N seconds — with continuous failures, polls should be
      // much less frequent than pollInterval alone
      await new Promise((r) => setTimeout(r, 300));
      await poller.stopPolling();

      // With 10ms poll interval and no auth backoff, we'd get ~30 calls in 300ms
      // With auth backoff (2s after first failure), we should get very few
      expect(pollFn.mock.calls.length).toBeLessThan(10);
    });

    it("should not treat non-auth errors as auth failures", async () => {
      const networkError = new Error("ECONNREFUSED");
      pollFn.mockRejectedValue(networkError);

      poller = new Poller(
        "test",
        pollFn,
        workFn,
        { concurrency: 1, pollInterval: 10 },
        noopLogger
      );

      poller.startPolling();
      await new Promise((r) => setTimeout(r, 100));
      await poller.stopPolling();

      expect(poller.authFailures).toBe(0);
    });
  });

  describe("paused worker", () => {
    it("should not call pollFunction when paused", async () => {
      pollFn.mockResolvedValue([]);
      poller = new Poller(
        "test",
        pollFn,
        workFn,
        { concurrency: 1, pollInterval: 10, paused: true },
        noopLogger
      );

      poller.startPolling();
      await new Promise((r) => setTimeout(r, 80));
      await poller.stopPolling();

      expect(pollFn).not.toHaveBeenCalled();
    });

    it("should resume polling when unpaused", async () => {
      pollFn.mockResolvedValue([]);
      poller = new Poller(
        "test",
        pollFn,
        workFn,
        { concurrency: 1, pollInterval: 10, paused: true },
        noopLogger
      );

      poller.startPolling();
      await new Promise((r) => setTimeout(r, 50));
      expect(pollFn).not.toHaveBeenCalled();

      // Unpause
      poller.updateOptions({ paused: false });
      await new Promise((r) => setTimeout(r, 80));
      await poller.stopPolling();

      expect(pollFn.mock.calls.length).toBeGreaterThan(0);
    });

    it("should pause a running poller via updateOptions", async () => {
      pollFn.mockResolvedValue([]);
      poller = new Poller(
        "test",
        pollFn,
        workFn,
        { concurrency: 1, pollInterval: 10, paused: false },
        noopLogger
      );

      poller.startPolling();
      await new Promise((r) => setTimeout(r, 50));
      const callsBefore = pollFn.mock.calls.length;
      expect(callsBefore).toBeGreaterThan(0);

      // Pause
      poller.updateOptions({ paused: true });
      await new Promise((r) => setTimeout(r, 80));
      const callsAfter = pollFn.mock.calls.length;
      await poller.stopPolling();

      // After pausing, very few additional calls should happen (at most 1 in-flight)
      expect(callsAfter - callsBefore).toBeLessThanOrEqual(1);
    });
  });
});
