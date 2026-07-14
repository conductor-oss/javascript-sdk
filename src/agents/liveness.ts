// Copyright (c) 2026 Agentspan
// Licensed under the MIT License. See LICENSE file in the project root for details.

/**
 * Watches a stateful (domain-routed) agent run for tasks nobody is polling.
 *
 * If the local worker process dies mid-run, the server-side task sits
 * SCHEDULED (or IN_PROGRESS with no lease extension) forever with
 * `pollCount=0`, and a blocking `wait()` would hang indefinitely. This polls
 * the workflow every `checkIntervalSeconds` and flags any such task, scoped
 * to this run's domain, once it has been queued past `stallSeconds` (spec
 * R11).
 */

import type { WorkflowClient } from "../sdk/clients/agent/WorkflowClient.js";
import { WorkerStallError } from "./errors.js";
import { TERMINAL_STATUSES } from "./result.js";

const STALLED_TASK_STATUSES = new Set(["SCHEDULED", "IN_PROGRESS"]);

export interface LivenessMonitorOptions {
  workflows: WorkflowClient;
  executionId: string;
  /** The run's domain — only tasks routed to this domain are eligible for stall detection. */
  domain: string;
  stallSeconds: number;
  checkIntervalSeconds: number;
  onStall: (error: WorkerStallError) => void;
}

/** Daemon-style poller; stops itself on terminal workflow state. */
export class LivenessMonitor {
  private timer?: ReturnType<typeof setInterval>;
  private readonly reported = new Set<string>();
  private stopped = false;

  constructor(private readonly options: LivenessMonitorOptions) {}

  start(): void {
    if (this.timer || this.stopped) return;
    this.timer = setInterval(() => {
      void this._tick();
    }, this.options.checkIntervalSeconds * 1000);
    // Never keep the process alive on its own.
    this.timer.unref?.();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async _tick(): Promise<void> {
    if (this.stopped) return;
    const { workflows, executionId, domain, stallSeconds, onStall } = this.options;

    let wf;
    try {
      wf = await workflows.getWorkflow(executionId, true);
    } catch {
      return; // Best-effort — try again next interval.
    }
    if (this.stopped) return;

    if (wf.status && TERMINAL_STATUSES.has(wf.status)) {
      this.stop();
      return;
    }

    const stallMs = stallSeconds * 1000;
    const now = Date.now();

    for (const task of wf.tasks ?? []) {
      const status = task.status as string | undefined;
      if (!status || !STALLED_TASK_STATUSES.has(status)) continue;
      if (task.domain !== domain) continue;
      if (((task.pollCount as number | undefined) ?? 0) !== 0) continue;

      const taskId = task.taskId as string | undefined;
      if (!taskId || this.reported.has(taskId)) continue;

      const scheduledTime = (task.scheduledTime as number | undefined) ?? 0;
      if (!scheduledTime || now - scheduledTime < stallMs) continue;

      this.reported.add(taskId);
      onStall(
        new WorkerStallError(
          executionId,
          (task.taskDefName as string | undefined) ?? "<unknown>",
          taskId,
          (now - scheduledTime) / 1000,
        ),
      );
    }
  }
}
