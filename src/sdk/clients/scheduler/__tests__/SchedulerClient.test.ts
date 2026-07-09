import { describe, expect, it, jest } from "@jest/globals";
import { SchedulerClient } from "../SchedulerClient";
import {
  Schedule,
  ScheduleNameConflict,
  ScheduleNotFound,
} from "../../agent/schedule";
import type { Client } from "../../../../open-api";

interface RawResult {
  data?: unknown;
  error?: unknown;
  response: { ok: boolean; status: number };
}

function ok(data?: unknown): RawResult {
  return { data, response: { ok: true, status: 200 } };
}

function fail(status: number, error: unknown = "boom"): RawResult {
  return { error, response: { ok: false, status } };
}

type VerbFn = (options: Record<string, unknown>) => Promise<RawResult>;

/** Minimal mocked hey-api client — only the raw verb methods the new code paths use. */
function mockClient() {
  return {
    get: jest.fn<VerbFn>(async () => ok()),
    put: jest.fn<VerbFn>(async () => ok()),
    post: jest.fn<VerbFn>(async () => ok()),
    delete: jest.fn<VerbFn>(async () => ok()),
  };
}

function schedulerFor(client: ReturnType<typeof mockClient>): SchedulerClient {
  return new SchedulerClient(client as unknown as Client);
}

describe("SchedulerClient pause/resume verb fallback (PUT → 405 → GET)", () => {
  it("pauseSchedule issues PUT first and stops there on success", async () => {
    const client = mockClient();
    await schedulerFor(client).pauseSchedule("s1");

    expect(client.put).toHaveBeenCalledTimes(1);
    expect(client.put.mock.calls[0][0]).toMatchObject({
      url: "/api/scheduler/schedules/{name}/pause",
      path: { name: "s1" },
    });
    expect(client.get).not.toHaveBeenCalled();
  });

  it("falls back to GET on 405, preserving the reason query param", async () => {
    const client = mockClient();
    client.put.mockResolvedValueOnce(fail(405));

    await schedulerFor(client).pauseSchedule("s1", "rate limit");

    expect(client.put).toHaveBeenCalledTimes(1);
    expect(client.put.mock.calls[0][0]).toMatchObject({ query: { reason: "rate limit" } });
    expect(client.get).toHaveBeenCalledTimes(1);
    expect(client.get.mock.calls[0][0]).toMatchObject({
      url: "/api/scheduler/schedules/{name}/pause",
      path: { name: "s1" },
      query: { reason: "rate limit" },
    });
  });

  it("does NOT fall back on non-405 failures (pauseSchedule → ConductorSdkError)", async () => {
    const client = mockClient();
    client.put.mockResolvedValueOnce(fail(500, "server broke"));

    await expect(schedulerFor(client).pauseSchedule("s1")).rejects.toThrow(
      /Failed to pause schedule 's1'/
    );
    expect(client.get).not.toHaveBeenCalled();
  });

  it("typed pause maps 404 to ScheduleNotFound without falling back", async () => {
    const client = mockClient();
    client.put.mockResolvedValueOnce(fail(404, "no such schedule"));

    await expect(schedulerFor(client).pause("s1")).rejects.toBeInstanceOf(ScheduleNotFound);
    expect(client.get).not.toHaveBeenCalled();
  });

  it("is stateless — every call retries PUT first even after a 405", async () => {
    const client = mockClient();
    client.put.mockResolvedValueOnce(fail(405));
    const scheduler = schedulerFor(client);

    await scheduler.resumeSchedule("s1");
    await scheduler.resumeSchedule("s1");

    expect(client.put).toHaveBeenCalledTimes(2);
    expect(client.get).toHaveBeenCalledTimes(1);
    expect(client.put.mock.calls[1][0]).toMatchObject({
      url: "/api/scheduler/schedules/{name}/resume",
    });
  });

  it("surfaces the GET fallback failure when both verbs fail", async () => {
    const client = mockClient();
    client.put.mockResolvedValueOnce(fail(405));
    client.get.mockResolvedValueOnce(fail(403, "forbidden"));

    await expect(schedulerFor(client).resume("s1")).rejects.toThrow(/403/);
  });
});

describe("SchedulerClient agent-schedule lifecycle surface", () => {
  const wire = { name: "digest-daily", cronExpression: "0 0 9 * * ?", startWorkflowRequest: { name: "digest", input: { a: 1 } } };

  it("get maps the wire payload to ScheduleInfo (unprefixed shortName)", async () => {
    const client = mockClient();
    client.get.mockResolvedValueOnce(ok(wire));

    const info = await schedulerFor(client).get("digest-daily", "digest");
    expect(info).toMatchObject({ name: "digest-daily", shortName: "daily", agent: "digest", cron: "0 0 9 * * ?" });
  });

  it("get throws ScheduleNotFound on an empty/nameless body", async () => {
    const client = mockClient();
    client.get.mockResolvedValueOnce(ok({}));

    await expect(schedulerFor(client).get("nope")).rejects.toBeInstanceOf(ScheduleNotFound);
  });

  it("listForAgent queries by workflowName and maps results (non-array → [])", async () => {
    const client = mockClient();
    client.get.mockResolvedValueOnce(ok([wire]));
    const scheduler = schedulerFor(client);

    const infos = await scheduler.listForAgent("digest");
    expect(client.get.mock.calls[0][0]).toMatchObject({
      url: "/api/scheduler/schedules",
      query: { workflowName: "digest" },
    });
    expect(infos).toHaveLength(1);
    expect(infos[0].shortName).toBe("daily");

    client.get.mockResolvedValueOnce(ok(undefined));
    expect(await scheduler.listForAgent("digest")).toEqual([]);
  });

  it("save posts the prefixed SaveScheduleRequest payload", async () => {
    const client = mockClient();
    await schedulerFor(client).save(new Schedule({ name: "daily", cron: "0 0 9 * * ?" }), "digest");

    expect(client.post.mock.calls[0][0]).toMatchObject({
      url: "/api/scheduler/schedules",
      body: expect.objectContaining({
        name: "digest-daily",
        cronExpression: "0 0 9 * * ?",
        startWorkflowRequest: { name: "digest", input: {} },
      }),
    });
  });

  it("runNow starts the agent workflow and returns the workflow id", async () => {
    const client = mockClient();
    client.post.mockResolvedValueOnce(ok("wf-123"));

    const id = await schedulerFor(client).runNow({
      name: "digest-daily",
      shortName: "daily",
      agent: "digest",
      input: { a: 1 },
    } as never);

    expect(id).toBe("wf-123");
    expect(client.post.mock.calls[0][0]).toMatchObject({
      url: "/api/workflow/{name}",
      path: { name: "digest" },
      body: { a: 1 },
    });
  });

  it("previewNext forwards cron + window params", async () => {
    const client = mockClient();
    client.get.mockResolvedValueOnce(ok([1, 2, 3]));

    const next = await schedulerFor(client).previewNext("0 0 9 * * ?", { n: 3, startAt: 10, endAt: 20 });
    expect(next).toEqual([1, 2, 3]);
    expect(client.get.mock.calls[0][0]).toMatchObject({
      url: "/api/scheduler/nextFewSchedules",
      query: { cronExpression: "0 0 9 * * ?", limit: 3, scheduleStartTime: 10, scheduleEndTime: 20 },
    });
  });

  it("reconcile rejects duplicate short names before any wire call", async () => {
    const client = mockClient();
    const dup = [
      new Schedule({ name: "daily", cron: "0 0 9 * * ?" }),
      new Schedule({ name: "daily", cron: "0 0 10 * * ?" }),
    ];

    await expect(schedulerFor(client).reconcile("digest", dup)).rejects.toBeInstanceOf(
      ScheduleNameConflict
    );
    expect(client.get).not.toHaveBeenCalled();
    expect(client.post).not.toHaveBeenCalled();
  });

  it("reconcile upserts desired and deletes stale schedules; null is a no-op", async () => {
    const client = mockClient();
    client.get.mockResolvedValueOnce(
      ok([
        { name: "digest-daily", startWorkflowRequest: { name: "digest" } },
        { name: "digest-stale", startWorkflowRequest: { name: "digest" } },
      ])
    );
    const scheduler = schedulerFor(client);

    await scheduler.reconcile("digest", [new Schedule({ name: "daily", cron: "0 0 9 * * ?" })]);
    expect(client.delete.mock.calls[0][0]).toMatchObject({ path: { name: "digest-stale" } });
    expect(client.post).toHaveBeenCalledTimes(1);

    client.get.mockClear();
    await scheduler.reconcile("digest", null);
    expect(client.get).not.toHaveBeenCalled();
  });
});

describe("SchedulerClient promise-based construction", () => {
  it("accepts a PromiseLike<Client> and resolves it lazily per call", async () => {
    const client = mockClient();
    const scheduler = new SchedulerClient(
      Promise.resolve(client as unknown as Client)
    );

    await scheduler.pause("s1");
    expect(client.put).toHaveBeenCalledTimes(1);
  });
});
