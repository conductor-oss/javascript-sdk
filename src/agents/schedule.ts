// Copyright (c) 2026 Agentspan
// Licensed under the MIT License. See LICENSE file in the project root for details.

/**
 * Cron-based scheduling for deployed agents.
 *
 * The models, wire-name mapping and typed errors live in
 * `src/sdk/clients/agent/schedule.ts` (shared with `SchedulerClient`'s
 * agent-lifecycle methods); this module re-exports them and hosts the
 * legacy raw-fetch `ScheduleClient` transport.
 */

import {
  Schedule,
  ScheduleInfo,
  ScheduleNotFound,
  _checkUniqueNames,
  _fromWorkflowSchedule,
  _toSaveRequest,
  _translate,
} from "../sdk/clients/agent/schedule.js";

export {
  Schedule,
  ScheduleError,
  ScheduleNameConflict,
  ScheduleNotFound,
  InvalidCronExpression,
  _prefix,
  _unprefix,
  _toSaveRequest,
  _fromWorkflowSchedule,
  _checkUniqueNames,
  _translate,
} from "../sdk/clients/agent/schedule.js";
export type { ScheduleOptions, ScheduleInfo } from "../sdk/clients/agent/schedule.js";

// ── Client (HTTP transport) ─────────────────────────────────────────────

export interface SchedulerFetcher {
  /** Issues HTTP requests against `${serverUrl}${path}`. */
  request(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<unknown>;
}

export class ScheduleClient {
  constructor(private readonly http: SchedulerFetcher) {}

  async save(schedule: Schedule, agentName: string): Promise<void> {
    try {
      await this.http.request("POST", "/scheduler/schedules", _toSaveRequest(schedule, agentName));
    } catch (e) {
      throw _translate(e);
    }
  }

  async get(wireName: string, agentName?: string): Promise<ScheduleInfo> {
    let ws: unknown;
    try {
      ws = await this.http.request("GET", `/scheduler/schedules/${encodeURIComponent(wireName)}`);
    } catch (e) {
      throw _translate(e);
    }
    if (
      !ws ||
      typeof ws !== "object" ||
      !(ws as Record<string, unknown>).name
    ) {
      throw new ScheduleNotFound(`Schedule '${wireName}' not found`);
    }
    return _fromWorkflowSchedule(ws as Record<string, unknown>, agentName);
  }

  async listForAgent(agentName: string): Promise<ScheduleInfo[]> {
    let results: unknown;
    try {
      results = await this.http.request(
        "GET",
        `/scheduler/schedules?workflowName=${encodeURIComponent(agentName)}`,
      );
    } catch (e) {
      throw _translate(e);
    }
    if (!Array.isArray(results)) return [];
    return results.map((r) => _fromWorkflowSchedule(r as Record<string, unknown>, agentName));
  }

  async pause(wireName: string, reason?: string): Promise<void> {
    const q = reason ? `?reason=${encodeURIComponent(reason)}` : "";
    try {
      await this.http.request("PUT", `/scheduler/schedules/${encodeURIComponent(wireName)}/pause${q}`);
    } catch (e) {
      throw _translate(e);
    }
  }

  async resume(wireName: string): Promise<void> {
    try {
      await this.http.request("PUT", `/scheduler/schedules/${encodeURIComponent(wireName)}/resume`);
    } catch (e) {
      throw _translate(e);
    }
  }

  async delete(wireName: string): Promise<void> {
    try {
      await this.http.request("DELETE", `/scheduler/schedules/${encodeURIComponent(wireName)}`);
    } catch (e) {
      throw _translate(e);
    }
  }

  async runNow(info: ScheduleInfo): Promise<string> {
    try {
      const r = (await this.http.request("POST", `/workflow/${encodeURIComponent(info.agent)}`, info.input)) as
        | string
        | { workflowId?: string };
      return typeof r === "string" ? r : (r.workflowId ?? "");
    } catch (e) {
      throw _translate(e);
    }
  }

  async previewNext(
    cron: string,
    opts: { n?: number; startAt?: number; endAt?: number } = {},
  ): Promise<number[]> {
    const params = new URLSearchParams();
    params.set("cronExpression", cron);
    if (opts.n !== undefined) params.set("limit", String(opts.n));
    if (opts.startAt !== undefined) params.set("scheduleStartTime", String(opts.startAt));
    if (opts.endAt !== undefined) params.set("scheduleEndTime", String(opts.endAt));
    try {
      const r = (await this.http.request("GET", `/scheduler/nextFewSchedules?${params}`)) as number[];
      return Array.isArray(r) ? r : [];
    } catch (e) {
      throw _translate(e);
    }
  }

  /**
   * Declarative reconciliation:
   * - `null`/`undefined` → no-op
   * - `[]` → purge all schedules whose `workflowName === agentName`
   * - `[Schedule, ...]` → upsert listed, delete the rest (scoped to this agent)
   */
  async reconcile(agentName: string, desired: Schedule[] | null | undefined): Promise<void> {
    if (desired === null || desired === undefined) return;
    _checkUniqueNames(desired);

    const existing = await this.listForAgent(agentName);
    const existingWireByShort = new Map<string, string>();
    for (const info of existing) {
      existingWireByShort.set(info.shortName, info.name);
    }
    const desiredShort = new Set(desired.map((s) => s.name));

    for (const [short, wire] of existingWireByShort) {
      if (!desiredShort.has(short)) {
        await this.delete(wire);
      }
    }
    for (const s of desired) {
      await this.save(s, agentName);
    }
  }
}
