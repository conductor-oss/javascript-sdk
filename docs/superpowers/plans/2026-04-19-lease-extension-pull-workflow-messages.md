# Lease Extension & PullWorkflowMessages Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic lease heartbeating for long-running workers and a `pullWorkflowMessages` task builder, achieving Python SDK parity.

**Architecture:** A standalone `LeaseTracker` class owns a `setInterval` (100ms) independent of the polling loop — it fires even when all concurrency slots are occupied. `TaskRunner` creates a `LeaseTracker`, tracks leases on task start, untracks immediately after `worker.execute()` resolves, and wires `start()`/`stop()` to `startPolling()`/`stopPolling()`. The `pullWorkflowMessages` builder is a 3-file addition following the established task builder pattern.

**Tech Stack:** TypeScript 5, Jest 30 (fake timers for heartbeat tests), existing `TaskResource.updateTask` (v1) for heartbeat sends.

**Spec:** `docs/superpowers/specs/2026-04-19-worker-lease-extension-pull-workflow-messages-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/sdk/clients/worker/constants.ts` | Modify | Add 4 lease extension constants |
| `src/sdk/clients/worker/LeaseTracker.ts` | **Create** | All heartbeat logic: map, interval, send, retry |
| `src/sdk/clients/worker/__tests__/LeaseTracker.test.ts` | **Create** | Unit tests for LeaseTracker |
| `src/sdk/clients/worker/types.ts` | Modify | Add `leaseExtendEnabled` to `ConductorWorker` |
| `src/sdk/worker/config/WorkerConfig.ts` | Modify | Add `leaseExtendEnabled` config property |
| `src/sdk/worker/decorators/registry.ts` | Modify | Add `leaseExtendEnabled` to `RegisteredWorker` |
| `src/sdk/worker/decorators/worker.ts` | Modify | Add `leaseExtendEnabled` to `WorkerOptions` |
| `src/sdk/worker/core/TaskHandler.ts` | Modify | Thread `leaseExtendEnabled` through config resolution and `conductorWorker` construction |
| `src/sdk/clients/worker/TaskRunner.ts` | Modify | Create `LeaseTracker`, wire lifecycle, track/untrack in `executeOneTask` |
| `src/sdk/clients/worker/__tests__/TaskRunner.test.ts` | Modify | Add lease integration tests |
| `src/open-api/types.ts` | Modify | Add `PULL_WORKFLOW_MESSAGES` to `TaskType`, new interface, extend union |
| `src/sdk/builders/tasks/pullWorkflowMessages.ts` | **Create** | `pullWorkflowMessages()` builder function |
| `src/sdk/builders/tasks/__tests__/pullWorkflowMessages.test.ts` | **Create** | Unit tests for builder |
| `src/sdk/builders/tasks/index.ts` | Modify | Export new builder |

---

## Chunk 1: LeaseTracker Class

### Task 1: Add lease extension constants

**Files:**
- Modify: `src/sdk/clients/worker/constants.ts`

- [ ] **Step 1: Add constants**

Open `src/sdk/clients/worker/constants.ts` and append:

```typescript
// Lease extension (heartbeat) — matches Python SDK / Java SDK source
export const LEASE_EXTEND_RETRY_COUNT = 3;
export const LEASE_EXTEND_DURATION_FACTOR = 0.8;
export const HEARTBEAT_CHECK_INTERVAL_MS = 100;
export const HEARTBEAT_RETRY_DELAY_MS = 500;
```

- [ ] **Step 2: Verify file compiles**

```bash
cd /Users/viren/workspace/github/orkes/sdk/conductor-javascript
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/sdk/clients/worker/constants.ts
git commit -m "feat: add lease extension constants"
```

---

### Task 2: Create LeaseTracker with tests (TDD)

**Files:**
- Create: `src/sdk/clients/worker/__tests__/LeaseTracker.test.ts`
- Create: `src/sdk/clients/worker/LeaseTracker.ts`

- [ ] **Step 1: Write failing tests**

Create `src/sdk/clients/worker/__tests__/LeaseTracker.test.ts`:

```typescript
import { LeaseTracker, LeaseInfo } from "@/sdk/clients/worker/LeaseTracker";
import { LEASE_EXTEND_DURATION_FACTOR, LEASE_EXTEND_RETRY_COUNT } from "@/sdk/clients/worker/constants";
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
      await jest.advanceTimersByTimeAsync(LEASE_EXTEND_RETRY_COUNT * 500 + 100);

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
      await jest.advanceTimersByTimeAsync(LEASE_EXTEND_RETRY_COUNT * 500 + 100);

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
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
cd /Users/viren/workspace/github/orkes/sdk/conductor-javascript
npx jest LeaseTracker.test --no-coverage 2>&1 | tail -20
```
Expected: `Cannot find module '@/sdk/clients/worker/LeaseTracker'`

- [ ] **Step 3: Create `LeaseTracker.ts`**

Create `src/sdk/clients/worker/LeaseTracker.ts`:

```typescript
import type { Task } from "../../open-api";
import type { ConductorLogger } from "../helpers/logger";
import {
  HEARTBEAT_CHECK_INTERVAL_MS,
  HEARTBEAT_RETRY_DELAY_MS,
  LEASE_EXTEND_DURATION_FACTOR,
  LEASE_EXTEND_RETRY_COUNT,
} from "./constants";

export interface LeaseInfo {
  taskId: string;
  workflowInstanceId: string;
  responseTimeoutSeconds: number;
  lastHeartbeatTime: number; // Date.now() at task start or last successful heartbeat
  intervalMs: number;        // responseTimeoutSeconds * LEASE_EXTEND_DURATION_FACTOR * 1000
  isHeartbeating: boolean;   // guard: prevents concurrent heartbeat chains for same task
}

/**
 * Tracks active task leases and sends periodic heartbeats to keep them alive.
 *
 * The check interval (100ms) runs independently of the polling loop — heartbeats
 * fire even when all concurrency slots are occupied.
 *
 * Python SDK parity:
 *   - LEASE_EXTEND_DURATION_FACTOR = 0.8  (80% of responseTimeoutSeconds)
 *   - LEASE_EXTEND_RETRY_COUNT = 3
 *   - interval < 1000ms → skip tracking  (matches Python `if interval < 1: return`)
 *   - Heartbeat uses v1 updateTask endpoint, not v2
 */
export class LeaseTracker {
  private leases = new Map<string, LeaseInfo>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    /**
     * Injected from TaskRunner. Calls TaskResource.updateTask (v1) with extendLease=true.
     * workerId is added by the closure in TaskRunner, not by LeaseTracker.
     */
    private readonly sendHeartbeatFn: (
      taskId: string,
      workflowInstanceId: string
    ) => Promise<void>,
    private readonly logger: ConductorLogger
  ) {}

  /**
   * Track a task lease.
   * No-op if responseTimeoutSeconds is falsy or computed interval < 1000ms.
   */
  track(task: Task): void {
    const timeout = task.responseTimeoutSeconds;
    if (!timeout || timeout <= 0) return;

    const intervalMs = timeout * LEASE_EXTEND_DURATION_FACTOR * 1000;
    if (intervalMs < 1000) return;

    this.leases.set(task.taskId as string, {
      taskId: task.taskId as string,
      workflowInstanceId: task.workflowInstanceId as string,
      responseTimeoutSeconds: timeout,
      lastHeartbeatTime: Date.now(),
      intervalMs,
      isHeartbeating: false,
    });
  }

  /** Remove a task from lease tracking. No-op if taskId is not tracked. */
  untrack(taskId: string): void {
    this.leases.delete(taskId);
  }

  /**
   * Start the heartbeat check interval.
   * Idempotent — safe to call multiple times.
   */
  start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => {
      void this.sendDueHeartbeats();
    }, HEARTBEAT_CHECK_INTERVAL_MS);
    // Prevent the interval from blocking clean process exit
    this.timer.unref?.();
  }

  /** Stop the heartbeat check interval. */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async sendDueHeartbeats(): Promise<void> {
    const now = Date.now();
    for (const [, info] of this.leases) {
      // isHeartbeating guard prevents concurrent heartbeat chains for the same task
      // (the 100ms check interval would otherwise launch a new chain every tick while retries are in flight)
      if (now - info.lastHeartbeatTime >= info.intervalMs && !info.isHeartbeating) {
        info.isHeartbeating = true;
        void this.sendHeartbeat(info);
      }
    }
  }

  private async sendHeartbeat(info: LeaseInfo): Promise<void> {
    try {
      for (let attempt = 0; attempt < LEASE_EXTEND_RETRY_COUNT; attempt++) {
        try {
          await this.sendHeartbeatFn(info.taskId, info.workflowInstanceId);
          // Update timestamp only on success
          const current = this.leases.get(info.taskId);
          if (current) {
            current.lastHeartbeatTime = Date.now();
          }
          return;
        } catch (err) {
          this.logger.error(
            `Heartbeat attempt ${attempt + 1}/${LEASE_EXTEND_RETRY_COUNT} failed for task ${info.taskId}: ${(err as Error).message}`
          );
          if (attempt < LEASE_EXTEND_RETRY_COUNT - 1) {
            await new Promise((resolve) => setTimeout(resolve, HEARTBEAT_RETRY_DELAY_MS));
          }
        }
      }
      // All retries exhausted — log but do not remove from tracking or fail the task
      this.logger.error(
        `All ${LEASE_EXTEND_RETRY_COUNT} heartbeat retries exhausted for task ${info.taskId}. Task may timeout on server.`
      );
    } finally {
      // Always release the in-flight guard so the next check interval can retry
      const current = this.leases.get(info.taskId);
      if (current) {
        current.isHeartbeating = false;
      }
    }
  }
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npx jest LeaseTracker.test --no-coverage 2>&1 | tail -20
```
Expected: all tests pass.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/sdk/clients/worker/constants.ts \
        src/sdk/clients/worker/LeaseTracker.ts \
        src/sdk/clients/worker/__tests__/LeaseTracker.test.ts
git commit -m "feat: add LeaseTracker for automatic task lease heartbeating"
```

---

## Chunk 2: Configuration Threading

### Task 3: Add `leaseExtendEnabled` to `ConductorWorker`, `WorkerConfig`, `RegisteredWorker`, `WorkerOptions`, and `TaskHandler`

All five changes are tightly coupled (they form one data-flow path), so they land in one task.

**Files:**
- Modify: `src/sdk/clients/worker/types.ts`
- Modify: `src/sdk/worker/config/WorkerConfig.ts`
- Modify: `src/sdk/worker/decorators/registry.ts`
- Modify: `src/sdk/worker/decorators/worker.ts`
- Modify: `src/sdk/worker/core/TaskHandler.ts`

- [ ] **Step 1: Add `leaseExtendEnabled` to `ConductorWorker` in `types.ts`**

In `src/sdk/clients/worker/types.ts`, find the `ConductorWorker` interface (line 47) and add after `pollInterval?`:

```typescript
  /** Enable automatic lease extension (heartbeat) for long-running tasks. Default: false. */
  leaseExtendEnabled?: boolean;
```

- [ ] **Step 2: Add `leaseExtendEnabled` to `WorkerConfig`**

In `src/sdk/worker/config/WorkerConfig.ts`:

1. Add to `WorkerConfig` interface (after `strictSchema`):
```typescript
  /** Enable automatic lease extension (heartbeat) for long-running tasks. Default: false. */
  leaseExtendEnabled?: boolean;
```

2. Add to `CONFIGURABLE_PROPERTIES` array:
```typescript
  "leaseExtendEnabled",
```

3. Add to `PROPERTY_TYPES` map:
```typescript
  leaseExtendEnabled: "boolean",
```

4. Add to `DEFAULT_VALUES` map:
```typescript
  leaseExtendEnabled: false,
```

- [ ] **Step 3: Add `leaseExtendEnabled` to `RegisteredWorker` in `registry.ts`**

In `src/sdk/worker/decorators/registry.ts`, add to `RegisteredWorker` interface (after `paused`):

```typescript
  /** Enable automatic lease extension (heartbeat) for long-running tasks. */
  leaseExtendEnabled?: boolean;
```

- [ ] **Step 4: Add `leaseExtendEnabled` to `WorkerOptions` in `worker.ts`**

In `src/sdk/worker/decorators/worker.ts`, add to `WorkerOptions` interface (after `outputType`):

```typescript
  /**
   * Enable automatic lease extension (heartbeat) for long-running tasks.
   * - Default: false
   * - When true: sends periodic heartbeats at 80% of the task's responseTimeoutSeconds
   * - Only applies to tasks where responseTimeoutSeconds > 1.25s
   * - Can be overridden via env: CONDUCTOR_WORKER_<NAME>_LEASE_EXTEND_ENABLED=true
   */
  leaseExtendEnabled?: boolean;
```

Then find the `const registeredWorker: RegisteredWorker = { ... }` object literal (not the `registerWorker(registeredWorker)` call site — `registeredWorker` is a variable constructed earlier and then passed by reference). Add `leaseExtendEnabled: options.leaseExtendEnabled` as the last field of that object literal, after `strictSchema: options.strictSchema`:

```typescript
const registeredWorker: RegisteredWorker = {
  // ... existing fields ...
  strictSchema: options.strictSchema,
  leaseExtendEnabled: options.leaseExtendEnabled,  // ADD THIS
};
```

- [ ] **Step 5: Thread `leaseExtendEnabled` through `TaskHandler`**

In `src/sdk/worker/core/TaskHandler.ts`, find the `resolveWorkerConfig` call (around line 193) and add `leaseExtendEnabled: registered.leaseExtendEnabled` to the `codeDefaults` object:

```typescript
const resolved = resolveWorkerConfig(
  registered.taskDefName,
  {
    pollInterval: registered.pollInterval,
    domain: registered.domain,
    workerId: registered.workerId,
    concurrency: registered.concurrency,
    registerTaskDef: registered.registerTaskDef,
    pollTimeout: registered.pollTimeout,
    paused: undefined,
    overwriteTaskDef: registered.overwriteTaskDef,
    strictSchema: registered.strictSchema,
    leaseExtendEnabled: registered.leaseExtendEnabled, // ADD THIS
  },
  this.logger
);
```

Then find the `conductorWorker` object construction (around line 209) and add:

```typescript
const conductorWorker: ConductorWorker = {
  taskDefName: registered.taskDefName,
  execute: registered.executeFunction,
  concurrency: resolved.concurrency,
  pollInterval: resolved.pollInterval,
  domain: resolved.domain,
  leaseExtendEnabled: resolved.leaseExtendEnabled, // ADD THIS
};
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Run existing tests to confirm nothing is broken**

```bash
npx jest --no-coverage 2>&1 | tail -20
```
Expected: all existing tests still pass.

- [ ] **Step 8: Commit**

```bash
git add src/sdk/clients/worker/types.ts \
        src/sdk/worker/config/WorkerConfig.ts \
        src/sdk/worker/decorators/registry.ts \
        src/sdk/worker/decorators/worker.ts \
        src/sdk/worker/core/TaskHandler.ts
git commit -m "feat: thread leaseExtendEnabled through worker config pipeline"
```

---

## Chunk 3: TaskRunner Integration

### Task 4: Wire `LeaseTracker` into `TaskRunner` (TDD)

**Files:**
- Modify: `src/sdk/clients/worker/TaskRunner.ts`
- Modify: `src/sdk/clients/worker/__tests__/TaskRunner.test.ts`

- [ ] **Step 1: Write failing tests**

Add the following tests to the bottom of `src/sdk/clients/worker/__tests__/TaskRunner.test.ts`.

First, update the existing `@jest/globals` import to add `beforeEach` (it is not in the current import):

```typescript
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
```

Then add this import alongside the other SDK imports:

```typescript
import { LeaseTracker } from "@/sdk/clients/worker/LeaseTracker";
```

Then add this `jest.mock` call alongside the existing `jest.mock("@open-api/generated", ...)`:

```typescript
jest.mock("@/sdk/clients/worker/LeaseTracker", () => ({
  LeaseTracker: jest.fn().mockImplementation(() => ({
    track: jest.fn(),
    untrack: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  })),
}));
```

Then add tests at the bottom of the file:

```typescript
describe("LeaseTracker integration", () => {
  // jest.config.mjs sets clearMocks: true, which wipes mockImplementation between tests.
  // Re-establish the LeaseTracker mock implementation before each test.
  let mockTrackerInstance: {
    track: jest.Mock;
    untrack: jest.Mock;
    start: jest.Mock;
    stop: jest.Mock;
  };

  beforeEach(() => {
    mockTrackerInstance = {
      track: jest.fn(),
      untrack: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    };
    (LeaseTracker as jest.Mock).mockImplementation(() => mockTrackerInstance);
  });

  const makeTaskWithTimeout = (responseTimeoutSeconds: number): Task => ({
    taskId: "lease-task-id",
    workflowInstanceId: "lease-wf-id",
    status: "IN_PROGRESS",
    responseTimeoutSeconds,
    inputData: {},
  });

  // Access the mock tracker via the module-level mockTrackerInstance (not private field cast)
  const getTrackerInstance = (_runner: TaskRunner) => mockTrackerInstance;

  test("startPolling() calls leaseTracker.start()", () => {
    const mockClient = createMockClient();
    const runner = new TaskRunner({
      worker: { taskDefName: "test", execute: async () => ({ status: "COMPLETED" as const }) },
      options: { workerID: "w1", domain: undefined },
      client: mockClient,
      logger: mockLogger,
    });
    activeRunners.push(runner);

    runner.startPolling();

    const tracker = getTrackerInstance(runner);
    expect(tracker.start).toHaveBeenCalledTimes(1);

    runner.stopPolling();
  });

  test("stopPolling() calls leaseTracker.stop()", async () => {
    const mockClient = createMockClient();
    const runner = new TaskRunner({
      worker: { taskDefName: "test", execute: async () => ({ status: "COMPLETED" as const }) },
      options: { workerID: "w1", domain: undefined },
      client: mockClient,
      logger: mockLogger,
    });
    activeRunners.push(runner);

    runner.startPolling();
    await runner.stopPolling();

    const tracker = getTrackerInstance(runner);
    expect(tracker.stop).toHaveBeenCalledTimes(1);
  });

  test("tracks lease when leaseExtendEnabled=true and task has responseTimeoutSeconds", async () => {
    const mockClient = createMockClient();
    const task = makeTaskWithTimeout(30);

    (TaskResource.batchPoll as jest.Mock).mockResolvedValue({ data: [task] });
    (TaskResource.updateTaskV2 as jest.Mock).mockResolvedValue({
      data: null, error: undefined, response: { status: 200, ok: true },
    });

    const runner = new TaskRunner({
      worker: {
        taskDefName: "lease-worker",
        execute: async () => ({ status: "COMPLETED" as const }),
        leaseExtendEnabled: true,
      },
      options: { workerID: "w1", domain: undefined, pollInterval: 10 },
      client: mockClient,
      logger: mockLogger,
    });
    activeRunners.push(runner);
    runner.startPolling();

    await new Promise((r) => setTimeout(r, 100));
    runner.stopPolling();

    const tracker = getTrackerInstance(runner);
    expect(tracker.track).toHaveBeenCalledWith(task);
  });

  test("does not track lease when leaseExtendEnabled is false", async () => {
    const mockClient = createMockClient();
    const task = makeTaskWithTimeout(30);

    (TaskResource.batchPoll as jest.Mock).mockResolvedValue({ data: [task] });
    (TaskResource.updateTaskV2 as jest.Mock).mockResolvedValue({
      data: null, error: undefined, response: { status: 200, ok: true },
    });

    const runner = new TaskRunner({
      worker: {
        taskDefName: "no-lease-worker",
        execute: async () => ({ status: "COMPLETED" as const }),
        leaseExtendEnabled: false,
      },
      options: { workerID: "w1", domain: undefined, pollInterval: 10 },
      client: mockClient,
      logger: mockLogger,
    });
    activeRunners.push(runner);
    runner.startPolling();

    await new Promise((r) => setTimeout(r, 100));
    runner.stopPolling();

    const tracker = getTrackerInstance(runner);
    expect(tracker.track).not.toHaveBeenCalled();
  });

  test("untracks lease after COMPLETED execution", async () => {
    const mockClient = createMockClient();
    const task = makeTaskWithTimeout(30);

    (TaskResource.batchPoll as jest.Mock).mockResolvedValueOnce({ data: [task] });
    (TaskResource.batchPoll as jest.Mock).mockResolvedValue({ data: [] });
    (TaskResource.updateTaskV2 as jest.Mock).mockResolvedValue({
      data: null, error: undefined, response: { status: 200, ok: true },
    });

    const runner = new TaskRunner({
      worker: {
        taskDefName: "lease-complete",
        execute: async () => ({ status: "COMPLETED" as const }),
        leaseExtendEnabled: true,
      },
      options: { workerID: "w1", domain: undefined, pollInterval: 10 },
      client: mockClient,
      logger: mockLogger,
    });
    activeRunners.push(runner);
    runner.startPolling();

    await new Promise((r) => setTimeout(r, 150));
    runner.stopPolling();

    const tracker = getTrackerInstance(runner);
    expect(tracker.untrack).toHaveBeenCalledWith(task.taskId);
  });

  test("untracks lease after FAILED execution (exception)", async () => {
    const mockClient = createMockClient();
    const task = makeTaskWithTimeout(30);

    (TaskResource.batchPoll as jest.Mock).mockResolvedValueOnce({ data: [task] });
    (TaskResource.batchPoll as jest.Mock).mockResolvedValue({ data: [] });
    (TaskResource.updateTaskV2 as jest.Mock).mockResolvedValue({
      data: null, error: undefined, response: { status: 200, ok: true },
    });

    const runner = new TaskRunner({
      worker: {
        taskDefName: "lease-fail",
        execute: async () => { throw new Error("worker error"); },
        leaseExtendEnabled: true,
      },
      options: { workerID: "w1", domain: undefined, pollInterval: 10 },
      client: mockClient,
      logger: mockLogger,
    });
    activeRunners.push(runner);
    runner.startPolling();

    await new Promise((r) => setTimeout(r, 150));
    runner.stopPolling();

    const tracker = getTrackerInstance(runner);
    expect(tracker.untrack).toHaveBeenCalledWith(task.taskId);
  });

  test("untracks lease after IN_PROGRESS return", async () => {
    const mockClient = createMockClient();
    const task = makeTaskWithTimeout(30);

    (TaskResource.batchPoll as jest.Mock).mockResolvedValueOnce({ data: [task] });
    (TaskResource.batchPoll as jest.Mock).mockResolvedValue({ data: [] });
    (TaskResource.updateTaskV2 as jest.Mock).mockResolvedValue({
      data: null, error: undefined, response: { status: 200, ok: true },
    });

    const runner = new TaskRunner({
      worker: {
        taskDefName: "lease-in-progress",
        execute: async () => ({ status: "IN_PROGRESS" as const, callbackAfterSeconds: 30 }),
        leaseExtendEnabled: true,
      },
      options: { workerID: "w1", domain: undefined, pollInterval: 10 },
      client: mockClient,
      logger: mockLogger,
    });
    activeRunners.push(runner);
    runner.startPolling();

    await new Promise((r) => setTimeout(r, 150));
    runner.stopPolling();

    const tracker = getTrackerInstance(runner);
    expect(tracker.untrack).toHaveBeenCalledWith(task.taskId);
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
npx jest TaskRunner.test --no-coverage 2>&1 | tail -30
```
Expected: new `LeaseTracker integration` tests fail — `TaskRunner` doesn't have a `leaseTracker` property yet.

- [ ] **Step 3: Add `LeaseTracker` to `TaskRunner`**

In `src/sdk/clients/worker/TaskRunner.ts`:

**3a. Add import** at the top (alongside existing imports):
```typescript
import { LeaseTracker } from "./LeaseTracker";
import { TaskResource } from "../../../open-api/generated";
```
(Note: `TaskResource` is already imported — no duplicate needed.)

**3b. Add `leaseTracker` field** in the class (after `private eventDispatcher`):
```typescript
private leaseTracker: LeaseTracker;
```

**3c. Initialize in constructor** (after `this.eventDispatcher = ...`):
```typescript
this.leaseTracker = new LeaseTracker(
  async (taskId: string, workflowInstanceId: string) => {
    await TaskResource.updateTask({
      client: this._client,
      body: {
        taskId,
        workflowInstanceId,
        status: "IN_PROGRESS",
        extendLease: true,
        workerId: this.options.workerID,
      },
      throwOnError: true,
    });
  },
  this.logger
);
```

**3d. Start tracker in `startPolling`** — add before the `this.poller.startPolling()` call:
```typescript
startPolling = () => {
  this.leaseTracker.start();
  this.poller.startPolling();
  this.logger.info(...);
};
```

**3e. Stop tracker in `stopPolling`** — add `this.leaseTracker.stop()` **before** `await this.poller.stopPolling()`:
```typescript
stopPolling = async () => {
  this.leaseTracker.stop();
  await this.poller.stopPolling();
};
```

**3f. Track and untrack in `executeOneTask`** — modify the method to add lease tracking.

Find this block at the start of the `try` in `executeOneTask` (around line 408):
```typescript
    try {
      // Wrap execution in TaskContext (AsyncLocalStorage)
      const { result, context } = await runWithTaskContext(
```

Add the `track` call before it:
```typescript
    // Track lease before execution (no-op if leaseExtendEnabled=false or interval too short)
    if (this.worker.leaseExtendEnabled) {
      this.leaseTracker.track(task);
    }

    try {
      // Wrap execution in TaskContext (AsyncLocalStorage)
      const { result, context } = await runWithTaskContext(
```

Now find the `isTaskInProgress(result)` block (around line 421):
```typescript
      // Handle TaskInProgress return
      if (isTaskInProgress(result)) {
        const contextLogs = context.getLogs();
        const nextTask = await this.updateTaskWithRetry(task, {
```

Add `untrack` before `updateTaskWithRetry`:
```typescript
      // Handle TaskInProgress return
      if (isTaskInProgress(result)) {
        // Untrack immediately — execution done, update will follow
        this.leaseTracker.untrack(taskId);
        const contextLogs = context.getLogs();
        const nextTask = await this.updateTaskWithRetry(task, {
```

Find the regular completion path `updateTaskWithRetry` call (around line 489):
```typescript
      const nextTask = await this.updateTaskWithRetry(task, {
        ...merged,
        workflowInstanceId,
        taskId,
      });
```

Add `untrack` just before it:
```typescript
      // Untrack immediately — execution done, update will follow
      this.leaseTracker.untrack(taskId);
      const nextTask = await this.updateTaskWithRetry(task, {
        ...merged,
        workflowInstanceId,
        taskId,
      });
```

Find the `catch` block (around line 496):
```typescript
    } catch (error: unknown) {
      const durationMs = Date.now() - startTime;
      const err = error as Error;
```

Add `untrack` as the first statement in the catch body:
```typescript
    } catch (error: unknown) {
      // Untrack immediately on failure — execution done, update will follow
      this.leaseTracker.untrack(taskId);
      const durationMs = Date.now() - startTime;
      const err = error as Error;
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npx jest TaskRunner.test --no-coverage 2>&1 | tail -30
```
Expected: all tests pass, including the new `LeaseTracker integration` suite.

- [ ] **Step 5: Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -20
```
Expected: all tests pass.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/sdk/clients/worker/TaskRunner.ts \
        src/sdk/clients/worker/__tests__/TaskRunner.test.ts
git commit -m "feat: integrate LeaseTracker into TaskRunner for automatic lease heartbeating"
```

---

## Chunk 4: PullWorkflowMessages Task Builder

### Task 5: Add `PULL_WORKFLOW_MESSAGES` task type and builder (TDD)

**Files:**
- Modify: `src/open-api/types.ts`
- Create: `src/sdk/builders/tasks/__tests__/pullWorkflowMessages.test.ts`
- Create: `src/sdk/builders/tasks/pullWorkflowMessages.ts`
- Modify: `src/sdk/builders/tasks/index.ts`

- [ ] **Step 1: Add `PULL_WORKFLOW_MESSAGES` to `TaskType` enum and define the interface**

In `src/open-api/types.ts`:

**1a.** In the `TaskType` enum (after `LIST_MCP_TOOLS`), add:
```typescript
  PULL_WORKFLOW_MESSAGES = "PULL_WORKFLOW_MESSAGES",
```

**1b.** Add the task def interface after the existing interfaces (e.g., after `WaitTaskDef`):
```typescript
export interface PullWorkflowMessagesTaskDef extends CommonTaskDef {
  type: TaskType.PULL_WORKFLOW_MESSAGES;
  inputParameters: {
    batchSize: number;
  };
  optional?: boolean;
}
```

**1c.** Add `PullWorkflowMessagesTaskDef` to the `TaskDefTypes` union:
```typescript
export type TaskDefTypes =
  | SimpleTaskDef
  | DoWhileTaskDef
  | EventTaskDef
  | ForkJoinTaskDef
  | ForkJoinDynamicDef
  | HttpTaskDef
  | InlineTaskDef
  | JsonJQTransformTaskDef
  | KafkaPublishTaskDef
  | SetVariableTaskDef
  | SubWorkflowTaskDef
  | SwitchTaskDef
  | TerminateTaskDef
  | JoinTaskDef
  | WaitTaskDef
  | PullWorkflowMessagesTaskDef;  // ADD THIS
```

- [ ] **Step 2: Write failing tests**

Create `src/sdk/builders/tasks/__tests__/pullWorkflowMessages.test.ts`:

```typescript
import { pullWorkflowMessages } from "@/sdk/builders/tasks/pullWorkflowMessages";
import { TaskType } from "@open-api/index";
import { describe, expect, test } from "@jest/globals";

describe("pullWorkflowMessages", () => {
  test("returns correct task type", () => {
    const task = pullWorkflowMessages("pull_ref");
    expect(task.type).toBe(TaskType.PULL_WORKFLOW_MESSAGES);
  });

  test("sets taskReferenceName and name from first argument", () => {
    const task = pullWorkflowMessages("pull_ref");
    expect(task.taskReferenceName).toBe("pull_ref");
    expect(task.name).toBe("pull_ref");
  });

  test("defaults batchSize to 1", () => {
    const task = pullWorkflowMessages("pull_ref");
    expect(task.inputParameters.batchSize).toBe(1);
  });

  test("accepts custom batchSize", () => {
    const task = pullWorkflowMessages("pull_ref", 10);
    expect(task.inputParameters.batchSize).toBe(10);
  });

  test("accepts optional flag", () => {
    const task = pullWorkflowMessages("pull_ref", 1, true);
    expect(task.optional).toBe(true);
  });

  test("optional is undefined when not specified", () => {
    const task = pullWorkflowMessages("pull_ref");
    expect(task.optional).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run tests and confirm they fail**

```bash
npx jest pullWorkflowMessages.test --no-coverage 2>&1 | tail -10
```
Expected: `Cannot find module '@/sdk/builders/tasks/pullWorkflowMessages'`

- [ ] **Step 4: Create the builder**

Create `src/sdk/builders/tasks/pullWorkflowMessages.ts`:

```typescript
import { TaskType, PullWorkflowMessagesTaskDef } from "../../../open-api";

/**
 * Consume messages from the workflow's message queue (WMQ).
 *
 * When messages are available, the task completes with:
 *   output.messages — list of WorkflowMessage objects
 *   output.count    — number of messages returned
 *
 * When the queue is empty, the task stays IN_PROGRESS and is re-evaluated
 * after ~1 second (non-blocking polling behavior).
 *
 * @param taskReferenceName - Unique task reference name within the workflow
 * @param batchSize - Max messages to dequeue per execution (default 1, server cap ~100)
 * @param optional - Whether the task is optional (default undefined)
 */
export const pullWorkflowMessages = (
  taskReferenceName: string,
  batchSize: number = 1,
  optional?: boolean
): PullWorkflowMessagesTaskDef => ({
  name: taskReferenceName,
  taskReferenceName,
  type: TaskType.PULL_WORKFLOW_MESSAGES,
  inputParameters: { batchSize },
  optional,
});
```

- [ ] **Step 5: Export from index**

In `src/sdk/builders/tasks/index.ts`, add at the end:
```typescript
export * from "./pullWorkflowMessages";
```

- [ ] **Step 6: Run tests and confirm they pass**

```bash
npx jest pullWorkflowMessages.test --no-coverage 2>&1 | tail -10
```
Expected: all 6 tests pass.

- [ ] **Step 7: Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -20
```
Expected: all tests pass.

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/open-api/types.ts \
        src/sdk/builders/tasks/pullWorkflowMessages.ts \
        src/sdk/builders/tasks/__tests__/pullWorkflowMessages.test.ts \
        src/sdk/builders/tasks/index.ts
git commit -m "feat: add pullWorkflowMessages task builder"
```

---

## Done

All four features are implemented. Verify the full suite one final time:

```bash
npx jest --no-coverage
npx tsc --noEmit
```

Both should exit clean.
