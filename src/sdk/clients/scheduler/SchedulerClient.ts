import type {
  Client,
  SaveScheduleRequest,
  SearchResultWorkflowScheduleExecutionModel,
  Tag,
  WorkflowSchedule,
  WorkflowScheduleModel,
} from "../../../open-api";
import { SchedulerResource } from "../../../open-api/generated";
import { handleSdkError } from "../../helpers/errors";
import {
  Schedule,
  ScheduleInfo,
  ScheduleNotFound,
  _checkUniqueNames,
  _fromWorkflowSchedule,
  _toSaveRequest,
  _translate,
} from "../agent/schedule";

/** Non-throwing hey-api result shape (`throwOnError: false`). */
interface RawResult {
  data?: unknown;
  error?: unknown;
  response: Response;
}

function _rawError(res: RawResult): Error & { status: number; body: string } {
  const body =
    typeof res.error === "string"
      ? res.error
      : JSON.stringify(res.error ?? "") || String(res.error);
  const err = new Error(
    `HTTP ${res.response.status}: ${body}`
  ) as Error & { status: number; body: string };
  err.status = res.response.status;
  err.body = body;
  return err;
}

export class SchedulerClient {
  public readonly _client: Client | PromiseLike<Client>;

  /**
   * Accepts the shared client directly, or a promise of it — callers whose
   * client construction is async (e.g. the agent runtime's memoized
   * `createConductorClient`) can hand the promise over and keep synchronous
   * accessors; every method awaits it before issuing requests.
   */
  constructor(client: Client | PromiseLike<Client>) {
    this._client = client;
  }

  private async client(): Promise<Client> {
    return this._client;
  }

  /**
   * Create or update a schedule for a specified workflow with a corresponding start workflow request
   * @param requestBody
   * @returns
   */
  public async saveSchedule(param: SaveScheduleRequest): Promise<void> {
    try {
      await SchedulerResource.saveSchedule({
        body: param,
        client: await this.client(),
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, "Failed to save schedule");
    }
  }

  /**
   * Searches for existing scheduler execution based on below parameters
   *
   * @param start
   * @param size
   * @param sort
   * @param freeText
   * @param query
   * @returns SearchResultWorkflowScheduleExecutionModel
   */
  public async search(
    start: number,
    size = 100,
    sort = "",
    freeText = "*",
    query?: string
  ): Promise<SearchResultWorkflowScheduleExecutionModel> {
    try {
      const { data } = await SchedulerResource.searchV2({
        query: { start, size, sort, freeText, query },
        client: await this.client(),
        throwOnError: true,
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(error, "Failed to search schedules");
    }
  }

  /**
   * Get an existing schedule by name
   * @param name
   * @returns WorkflowSchedule
   */
  public async getSchedule(name: string): Promise<WorkflowSchedule> {
    try {
      const { data } = await SchedulerResource.getSchedule({
        path: { name },
        client: await this.client(),
        throwOnError: true,
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get schedule '${name}'`);
    }
  }

  /**
   * Pauses an existing schedule by name.
   *
   * Issues PUT first and falls back to GET on HTTP 405 — per-schedule
   * pause/resume verbs differ by server family (see
   * `pauseResumeWithVerbFallback`).
   * @param name
   * @param reason optional pause reason, recorded as `pausedReason`
   * @returns
   */
  public async pauseSchedule(name: string, reason?: string): Promise<void> {
    try {
      await this.pauseResumeWithVerbFallback("pause", name, reason);
    } catch (error: unknown) {
      handleSdkError(error, `Failed to pause schedule '${name}'`);
    }
  }

  /**
   * Resume a paused schedule by name.
   *
   * Issues PUT first and falls back to GET on HTTP 405 — per-schedule
   * pause/resume verbs differ by server family (see
   * `pauseResumeWithVerbFallback`).
   * @param name
   * @returns
   */
  public async resumeSchedule(name: string): Promise<void> {
    try {
      await this.pauseResumeWithVerbFallback("resume", name);
    } catch (error: unknown) {
      handleSdkError(error, `Failed to resume schedule '${name}'`);
    }
  }

  /**
   * Deletes an existing scheduler execution by name
   *
   * @param name
   * @returns
   */
  public async deleteSchedule(name: string): Promise<void> {
    try {
      await SchedulerResource.deleteSchedule({
        path: { name },
        client: await this.client(),
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to delete schedule '${name}'`);
    }
  }

  /**
   * Get all existing workflow schedules and optionally filter by workflow name
   * @param workflowName
   * @returns Array<WorkflowScheduleModel>
   */
  public async getAllSchedules(
    workflowName?: string
  ): Promise<WorkflowScheduleModel[]> {
    try {
      const { data } = await SchedulerResource.getAllSchedules({
        query: { workflowName },
        client: await this.client(),
        throwOnError: true,
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(error, "Failed to get all schedules");
    }
  }

  /**
   * Get list of the next x (default 3, max 5) execution times for a scheduler
   * @param cronExpression
   * @param scheduleStartTime
   * @param scheduleEndTime
   * @param limit
   * @returns number OK
   * @throws ApiError
   */
  public async getNextFewSchedules(
    cronExpression: string,
    scheduleStartTime?: number,
    scheduleEndTime?: number,
    limit = 3
  ): Promise<number[]> {
    try {
      const { data } = await SchedulerResource.getNextFewSchedules({
        query: { cronExpression, scheduleStartTime, scheduleEndTime, limit },
        client: await this.client(),
        throwOnError: true,
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(error, "Failed to get next few schedules");
    }
  }

  /**
   * Pause all scheduling in a single conductor server instance (for debugging only)
   * @returns any OK
   * @throws ApiError
   */
  public async pauseAllSchedules(): Promise<void> {
    try {
      await SchedulerResource.pauseAllSchedules({
        client: await this.client(),
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, "Failed to pause all schedules");
    }
  }

  /**
   * Requeue all execution records
   * @returns any OK
   * @throws ApiError
   */
  public async requeueAllExecutionRecords(): Promise<void> {
    try {
      await SchedulerResource.requeueAllExecutionRecords({
        client: await this.client(),
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, "Failed to requeue all execution records");
    }
  }

  /**
   * Resume all scheduling
   * @returns any OK
   * @throws ApiError
   */
  public async resumeAllSchedules(): Promise<void> {
    try {
      await SchedulerResource.resumeAllSchedules({
        client: await this.client(),
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, "Failed to resume all schedules");
    }
  }

  /**
   * Set tags for a schedule
   * @param tags - The tags to set
   * @param name - The schedule name
   */
  public async setSchedulerTags(tags: Tag[], name: string): Promise<void> {
    try {
      await SchedulerResource.putTagForSchedule({
        path: { name },
        body: tags,
        client: await this.client(),
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to set tags for schedule '${name}'`);
    }
  }

  /**
   * Get tags for a schedule
   * @param name - The schedule name
   * @returns Array of tags
   */
  public async getSchedulerTags(name: string): Promise<Tag[]> {
    try {
      const { data } = await SchedulerResource.getTagsForSchedule({
        path: { name },
        client: await this.client(),
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get tags for schedule '${name}'`);
    }
  }

  /**
   * Delete tags from a schedule
   * @param tags - The tags to delete
   * @param name - The schedule name
   */
  public async deleteSchedulerTags(tags: Tag[], name: string): Promise<void> {
    try {
      await SchedulerResource.deleteTagForSchedule({
        path: { name },
        body: tags,
        client: await this.client(),
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to delete tags from schedule '${name}'`);
    }
  }

  // ── Agent-schedule lifecycle surface ──────────────────────────────────
  // Typed counterparts of the endpoint wrappers above, operating on the
  // agent-flavored `Schedule`/`ScheduleInfo` models with wire-name
  // prefixing (`${agent}-${name}`). Errors surface as the typed schedule
  // errors via `_translate` (callers match on ScheduleNotFound etc.), not
  // as ConductorSdkError.

  /** Create or update an agent schedule (wire name = `${agent}-${name}`). */
  async save(schedule: Schedule, agentName: string): Promise<void> {
    try {
      await this.raw("post", "/api/scheduler/schedules", {
        body: _toSaveRequest(schedule, agentName),
      });
    } catch (e) {
      throw _translate(e);
    }
  }

  /** Fetch one schedule by wire name; throws `ScheduleNotFound` when absent. */
  async get(wireName: string, agentName?: string): Promise<ScheduleInfo> {
    let ws: unknown;
    try {
      ws = await this.raw("get", "/api/scheduler/schedules/{name}", {
        path: { name: wireName },
      });
    } catch (e) {
      throw _translate(e);
    }
    if (!ws || typeof ws !== "object" || !(ws as Record<string, unknown>).name) {
      throw new ScheduleNotFound(`Schedule '${wireName}' not found`);
    }
    return _fromWorkflowSchedule(ws as Record<string, unknown>, agentName);
  }

  /** List all schedules whose workflow is `agentName`. */
  async listForAgent(agentName: string): Promise<ScheduleInfo[]> {
    let results: unknown;
    try {
      results = await this.raw("get", "/api/scheduler/schedules", {
        query: { workflowName: agentName },
      });
    } catch (e) {
      throw _translate(e);
    }
    if (!Array.isArray(results)) return [];
    return results.map((r) => _fromWorkflowSchedule(r as Record<string, unknown>, agentName));
  }

  /** Pause a schedule by wire name; typed-error counterpart of `pauseSchedule`. */
  async pause(wireName: string, reason?: string): Promise<void> {
    try {
      await this.pauseResumeWithVerbFallback("pause", wireName, reason);
    } catch (e) {
      throw _translate(e);
    }
  }

  /** Resume a schedule by wire name; typed-error counterpart of `resumeSchedule`. */
  async resume(wireName: string): Promise<void> {
    try {
      await this.pauseResumeWithVerbFallback("resume", wireName);
    } catch (e) {
      throw _translate(e);
    }
  }

  /** Delete a schedule by wire name; typed-error counterpart of `deleteSchedule`. */
  async delete(wireName: string): Promise<void> {
    try {
      await this.raw("delete", "/api/scheduler/schedules/{name}", {
        path: { name: wireName },
      });
    } catch (e) {
      throw _translate(e);
    }
  }

  /** Fire the schedule's agent once with the schedule's stored input. */
  async runNow(info: ScheduleInfo): Promise<string> {
    try {
      const r = (await this.raw("post", "/api/workflow/{name}", {
        path: { name: info.agent },
        body: info.input,
      })) as string | { workflowId?: string };
      return typeof r === "string" ? r : (r?.workflowId ?? "");
    } catch (e) {
      throw _translate(e);
    }
  }

  /** Preview the next execution times for a cron expression. */
  async previewNext(
    cron: string,
    opts: { n?: number; startAt?: number; endAt?: number } = {}
  ): Promise<number[]> {
    try {
      const r = await this.raw("get", "/api/scheduler/nextFewSchedules", {
        query: {
          cronExpression: cron,
          ...(opts.n !== undefined ? { limit: opts.n } : {}),
          ...(opts.startAt !== undefined ? { scheduleStartTime: opts.startAt } : {}),
          ...(opts.endAt !== undefined ? { scheduleEndTime: opts.endAt } : {}),
        },
      });
      return Array.isArray(r) ? (r as number[]) : [];
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

  // ── Transport helpers ─────────────────────────────────────────────────

  /**
   * Auth header for the raw calls below, borrowed from the shared client's
   * `getAuthenticationHeaders()` accessor (same TTL-aware token the generated
   * call path attaches via its `security` metadata). A client without the
   * accessor or without a token (bare hey-api client / anonymous server)
   * yields no header — matching the generated path when no `auth` callback
   * is configured.
   */
  private async authHeaders(): Promise<Record<string, string>> {
    const client = (await this.client()) as Client & {
      getAuthenticationHeaders?: () => Promise<Record<string, string> | null>;
    };
    return (await client.getAuthenticationHeaders?.()) ?? {};
  }

  /**
   * Per-schedule pause/resume verbs differ by server family: OSS/embedded
   * Conductor maps them PUT-only, Orkes Conductor GET-only. Try PUT first;
   * on HTTP 405 — and only 405 — retry via GET (`reason` is re-applied on
   * the fallback URL). Stateless: the verb is decided per call.
   *
   * Implemented with raw non-throwing client calls because the generated
   * transport is GET-only and the fallback needs the raw HTTP status,
   * which `handleSdkError` does not preserve.
   */
  private async pauseResumeWithVerbFallback(
    action: "pause" | "resume",
    name: string,
    reason?: string
  ): Promise<void> {
    const client = await this.client();
    const options = {
      url: `/api/scheduler/schedules/{name}/${action}`,
      path: { name },
      ...(reason !== undefined ? { query: { reason } } : {}),
      headers: await this.authHeaders(),
      throwOnError: false as const,
    };
    const put = (await client.put(options)) as unknown as RawResult;
    if (put.response.ok) return;
    if (put.response.status !== 405) throw _rawError(put);
    const get = (await client.get(options)) as unknown as RawResult;
    if (!get.response.ok) throw _rawError(get);
  }

  /**
   * Raw non-throwing request on the shared client; failures throw an
   * `Error` carrying `status`/`body` for `_translate`.
   */
  private async raw(
    method: "get" | "post" | "put" | "delete",
    url: string,
    opts: {
      path?: Record<string, unknown>;
      query?: Record<string, unknown>;
      body?: unknown;
    } = {}
  ): Promise<unknown> {
    const client = await this.client();
    const auth = await this.authHeaders();
    const res = (await client[method]({
      url,
      ...(opts.path ? { path: opts.path } : {}),
      ...(opts.query ? { query: opts.query } : {}),
      ...(opts.body !== undefined
        ? { body: opts.body, headers: { "Content-Type": "application/json", ...auth } }
        : { headers: auth }),
      throwOnError: false,
    })) as unknown as RawResult;
    if (!res.response.ok) throw _rawError(res);
    return res.data;
  }
}
