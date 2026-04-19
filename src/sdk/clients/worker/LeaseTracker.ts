import type { Task } from "../../../open-api";
import type { ConductorLogger } from "../../helpers/logger";
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

    if (!task.taskId || !task.workflowInstanceId) return;

    this.leases.set(task.taskId, {
      taskId: task.taskId,
      workflowInstanceId: task.workflowInstanceId,
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
          // Update timestamp only on success, only if still the current entry
          if (this.leases.get(info.taskId) === info) {
            info.lastHeartbeatTime = Date.now();
          }
          return;
        } catch (err) {
          this.logger.error(
            `Heartbeat attempt ${attempt + 1}/${LEASE_EXTEND_RETRY_COUNT} failed for task ${info.taskId}: ${(err as Error)?.message ?? String(err)}`
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
      // Only release guard if we're still the current entry for this taskId
      if (this.leases.get(info.taskId) === info) {
        info.isHeartbeating = false;
      }
    }
  }
}
