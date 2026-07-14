// Copyright (c) 2026 Agentspan
// Licensed under the MIT License. See LICENSE file in the project root for details.

/**
 * Cron-based scheduling for deployed agents — models, wire-name mapping and
 * typed errors shared by `SchedulerClient`'s agent-lifecycle methods.
 *
 * Mirrors the Python SDK's `conductor.client.ai.schedule` mapping layer.
 */

// ── Public types ────────────────────────────────────────────────────────

export interface ScheduleOptions {
  /** Short identifier, unique per agent. Required. */
  name: string;
  /** Cron expression — 6-field Quartz (seconds-precision) accepted by Conductor. */
  cron: string;
  /** IANA timezone id, defaults to UTC. */
  timezone?: string;
  /** Workflow input passed when the cron fires. */
  input?: Record<string, unknown>;
  /** Replay missed fires on resume. Defaults to false. */
  catchup?: boolean;
  /** Start in paused state. Defaults to false. */
  paused?: boolean;
  /** Window start, epoch ms. */
  startAt?: number;
  /** Window end, epoch ms. */
  endAt?: number;
  /** Human-readable description. */
  description?: string;
}

export class Schedule {
  readonly name: string;
  readonly cron: string;
  readonly timezone: string;
  readonly input: Record<string, unknown>;
  readonly catchup: boolean;
  readonly paused: boolean;
  readonly startAt?: number;
  readonly endAt?: number;
  readonly description?: string;

  constructor(opts: ScheduleOptions) {
    if (!opts.name || !opts.name.trim()) {
      throw new ScheduleError("Schedule.name is required and must be non-empty");
    }
    if (!opts.cron || !opts.cron.trim()) {
      throw new ScheduleError("Schedule.cron is required and must be non-empty");
    }
    if (opts.startAt !== undefined && opts.endAt !== undefined && opts.startAt >= opts.endAt) {
      throw new ScheduleError("Schedule.startAt must be < endAt");
    }

    this.name = opts.name;
    this.cron = opts.cron;
    this.timezone = opts.timezone ?? "UTC";
    this.input = opts.input ?? {};
    this.catchup = opts.catchup ?? false;
    this.paused = opts.paused ?? false;
    this.startAt = opts.startAt;
    this.endAt = opts.endAt;
    this.description = opts.description;
  }
}

/** Server view of a schedule, as returned by `schedules.list/get`. */
export interface ScheduleInfo {
  /** Wire name (prefixed with `${agent}-`). */
  name: string;
  /** User-supplied name (the part after the `${agent}-` prefix). */
  shortName: string;
  /** Agent / workflow name this schedule fires. */
  agent: string;
  cron: string;
  timezone: string;
  input: Record<string, unknown>;
  paused: boolean;
  pausedReason: string | null;
  catchup: boolean;
  startAt: number | null;
  endAt: number | null;
  description: string | null;
  nextRun: number | null;
  createTime: number | null;
  updateTime: number | null;
  createdBy: string | null;
  updatedBy: string | null;
}

// ── Errors ──────────────────────────────────────────────────────────────

export class ScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScheduleError";
  }
}

export class ScheduleNameConflict extends ScheduleError {
  constructor(message: string) {
    super(message);
    this.name = "ScheduleNameConflict";
  }
}

export class ScheduleNotFound extends ScheduleError {
  constructor(message: string) {
    super(message);
    this.name = "ScheduleNotFound";
  }
}

export class InvalidCronExpression extends ScheduleError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCronExpression";
  }
}

// ── Wire-name helpers ───────────────────────────────────────────────────

export function _prefix(agentName: string, shortName: string): string {
  return `${agentName}-${shortName}`;
}

export function _unprefix(agentName: string, wireName: string): string {
  const p = `${agentName}-`;
  return wireName.startsWith(p) ? wireName.slice(p.length) : wireName;
}

// ── Payload mapping ─────────────────────────────────────────────────────

export function _toSaveRequest(schedule: Schedule, agentName: string): Record<string, unknown> {
  return {
    name: _prefix(agentName, schedule.name),
    cronExpression: schedule.cron,
    zoneId: schedule.timezone,
    runCatchupScheduleInstances: schedule.catchup,
    paused: schedule.paused,
    scheduleStartTime: schedule.startAt ?? undefined,
    scheduleEndTime: schedule.endAt ?? undefined,
    description: schedule.description ?? undefined,
    startWorkflowRequest: {
      name: agentName,
      input: { ...schedule.input },
    },
  };
}

export function _fromWorkflowSchedule(ws: Record<string, unknown>, agentName?: string): ScheduleInfo {
  const swr = (ws.startWorkflowRequest as Record<string, unknown>) ?? {};
  const wireName = (ws.name as string) ?? "";
  const swrName = (swr.name as string) ?? "";
  const agent = agentName || swrName || "";

  return {
    name: wireName,
    shortName: _unprefix(agent, wireName),
    agent: swrName,
    cron: (ws.cronExpression as string) ?? "",
    timezone: (ws.zoneId as string) ?? "UTC",
    input: (swr.input as Record<string, unknown>) ?? {},
    paused: Boolean(ws.paused),
    pausedReason: (ws.pausedReason as string) ?? null,
    catchup: Boolean(ws.runCatchupScheduleInstances),
    startAt: (ws.scheduleStartTime as number) ?? null,
    endAt: (ws.scheduleEndTime as number) ?? null,
    description: (ws.description as string) ?? null,
    nextRun: (ws.nextRunTime as number) ?? null,
    createTime: (ws.createTime as number) ?? null,
    updateTime: (ws.updatedTime as number) ?? null,
    createdBy: (ws.createdBy as string) ?? null,
    updatedBy: (ws.updatedBy as string) ?? null,
  };
}

// ── Validation / error translation ──────────────────────────────────────

export function _checkUniqueNames(schedules: Schedule[]): void {
  const seen = new Set<string>();
  for (const s of schedules) {
    if (seen.has(s.name)) {
      throw new ScheduleNameConflict(
        `Duplicate schedule name '${s.name}' — names must be unique per agent`,
      );
    }
    seen.add(s.name);
  }
}

export function _translate(exc: unknown): Error {
  if (exc instanceof Error) {
    const anyExc = exc as Error & { status?: number; body?: string };
    const status = anyExc.status;
    const body = anyExc.body ?? exc.message;
    if (status === 404) return new ScheduleNotFound(body);
    if (status === 400 && body.toLowerCase().includes("cron")) {
      return new InvalidCronExpression(body);
    }
    return exc;
  }
  return new Error(String(exc));
}
