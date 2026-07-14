import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { stubGlobal } from "./helpers/stub-global.js";
import { OCGMemoryStore } from "../ocg-memory.js";
import type { FeedbackEvent } from "../ocg-memory.js";
import { Agent } from "../agent.js";
import { AgentRuntime } from "../runtime.js";
import { AgentAPIError } from "../errors.js";

// ── Helpers ──────────────────────────────────────────────

/** A jest-mocked fetch returning a single canned JSON response (200 OK). */
function mockJson(body: unknown) {
  const fn = jest.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  }));
  stubGlobal("fetch", fn);
  return fn;
}

function makeStore() {
  return new OCGMemoryStore({ url: "https://ocg.test/", agent: "agent:a", user: "user:bob" });
}

describe("OCGMemoryStore", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("strips trailing slash from the OCG url and exposes config", () => {
    const store = new OCGMemoryStore({ url: "https://ocg.example.com/", agent: "agent:x" });
    expect(store.ocgUrl).toBe("https://ocg.example.com");
    expect(store.credential).toBe("OCG_PUBLIC_KEY");
    expect(store.scope).toBe("user");
  });

  it("rejects a blank url or agent", () => {
    expect(() => new OCGMemoryStore({ url: "  ", agent: "agent:x" })).toThrow();
    expect(() => new OCGMemoryStore({ url: "https://ocg.test", agent: "" })).toThrow();
  });

  it("add posts a value field (not string_value / confidence) and agent/user", async () => {
    const fetchMock = mockJson({ key: "k1" });
    const store = makeStore();

    const key = await store.add({ content: "alice prefers email", metadata: { key: "pref" } });

    expect(key).toBe("pref");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://ocg.test/api/v1/memories");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.value).toBe("alice prefers email"); // field is "value", NOT "string_value"
    expect(body).not.toHaveProperty("string_value");
    expect(body).not.toHaveProperty("confidence"); // confidence was removed from the API
    expect(body.agent).toBe("agent:a");
    expect(body.user).toBe("user:bob");
    expect(body.source).toBe("agent_inferred");
  });

  it("search folds the good/bad signal into result content", async () => {
    const fetchMock = mockJson({
      memories: [
        {
          key: "m1",
          value_preview: "use us-east-1",
          good_count: 2,
          bad_count: 1,
          relevance_score: 0.9,
          feedback_notes: [{ verdict: "bad", reason: "stale region" }],
        },
      ],
    });
    const store = makeStore();

    const entries = await store.search("which region", 5);

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe("https://ocg.test/api/v1/memories/search");
    expect(entries).toHaveLength(1);
    expect(entries[0].content).toContain("[good 2 / bad 1]");
    expect(entries[0].content).toContain('bad: "stale region"');
  });

  it("feedbackLinks hits the mint route and returns the urls", async () => {
    const fetchMock = mockJson({
      good_url: "https://ocg.test/api/v1/feedback/GOOD",
      bad_url: "https://ocg.test/api/v1/feedback/BAD",
      expires_at: "2026-09-01T00:00:00Z",
    });
    const store = makeStore();

    const links = await store.feedbackLinks("k1");

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url.split("?")[0]).toBe("https://ocg.test/api/v1/memories/k1/feedback-links");
    expect(links.good_url).toContain("/feedback/GOOD");
    expect(links.bad_url).toContain("/feedback/BAD");
  });

  it("sends the bearer token when provided", async () => {
    const fetchMock = mockJson({ key: "k" });
    const store = new OCGMemoryStore({ url: "https://ocg.test", agent: "agent:a", token: "tok-123" });

    await store.add({ content: "x", metadata: { key: "k" } });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-123");
  });

  it("throws AgentAPIError on a non-2xx response", async () => {
    stubGlobal(
      "fetch",
      jest.fn(async () => ({ ok: false, status: 500, text: async () => "boom" })),
    );
    const store = makeStore();
    await expect(store.add({ content: "x", metadata: { key: "k" } })).rejects.toThrow(AgentAPIError);
  });
});

// ── Runtime feedbackSink worker ──────────────────────────

interface PendingWorker {
  taskName: string;
  handler: (input: Record<string, unknown>) => Promise<unknown>;
}

function findWorker(runtime: AgentRuntime, taskName: string): PendingWorker | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workers = (runtime as any).workerManager.pendingWorkers as PendingWorker[];
  return workers.find((w) => w.taskName === taskName);
}

describe("AgentRuntime feedbackSink worker", () => {
  it("registers a feedback_sink worker that rebuilds a FeedbackEvent and calls the sink", async () => {
    const runtime = new AgentRuntime();
    const events: FeedbackEvent[] = [];
    const agent = new Agent({
      name: "support",
      model: "openai/gpt-4o",
      semanticMemory: new OCGMemoryStore({ url: "https://ocg.test", agent: "agent:a" }),
      feedbackSink: (ev) => {
        events.push(ev);
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (runtime as any)._registerSystemWorkers(agent, null);

    const worker = findWorker(runtime, "support_feedback_sink");
    expect(worker).toBeDefined();

    const result = await worker!.handler({
      memory_key: "conversation:sess-9",
      summary: "Alice is on Enterprise.",
      facts: ["plan=enterprise"],
      tags: ["billing"],
      good_url: "https://ocg.test/api/v1/feedback/GOOD",
      bad_url: "https://ocg.test/api/v1/feedback/BAD",
      agent: "agent:a",
      user: "user:alice",
    });

    expect(result).toEqual({ delivered: true });
    expect(events).toHaveLength(1);
    expect(events[0].memoryKey).toBe("conversation:sess-9");
    expect(events[0].summary).toBe("Alice is on Enterprise.");
    expect(events[0].facts).toEqual(["plan=enterprise"]);
    expect(events[0].goodUrl).toContain("/feedback/GOOD");
    expect(events[0].badUrl).toContain("/feedback/BAD");
  });

  it("swallows sink failures so memory never fails the run", async () => {
    const runtime = new AgentRuntime();
    const agent = new Agent({
      name: "support",
      model: "openai/gpt-4o",
      semanticMemory: new OCGMemoryStore({ url: "https://ocg.test", agent: "agent:a" }),
      feedbackSink: () => {
        throw new Error("sink exploded");
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (runtime as any)._registerSystemWorkers(agent, null);
    const worker = findWorker(runtime, "support_feedback_sink");
    expect(worker).toBeDefined();

    await expect(worker!.handler({ memory_key: "k", summary: "s" })).resolves.toEqual({
      delivered: false,
    });
  });

  it("registers no feedback_sink worker without a sink", async () => {
    const runtime = new AgentRuntime();
    const agent = new Agent({
      name: "plain",
      model: "openai/gpt-4o",
      semanticMemory: new OCGMemoryStore({ url: "https://ocg.test", agent: "agent:a" }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (runtime as any)._registerSystemWorkers(agent, null);
    expect(findWorker(runtime, "plain_feedback_sink")).toBeUndefined();
  });

  it("stores the memory attrs on the Agent", () => {
    const agent = new Agent({
      name: "a",
      model: "openai/gpt-4o",
      semanticMemory: new OCGMemoryStore({ url: "https://ocg.test", agent: "agent:a" }),
    });
    expect(agent.semanticMemory).toBeDefined();
    expect(agent.memorySummaryModel).toBeUndefined(); // defaults to reuse the agent model
    expect(agent.feedbackSink).toBeUndefined();
  });
});
