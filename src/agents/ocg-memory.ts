// ── OCG-backed long-term memory for agents ───────────────

/**
 * OCG-backed long-term memory for agents.
 *
 * Backs the SDK's memory abstraction with an OCG (Open Context Graph)
 * instance, so an agent's memories persist in OCG and ride OCG's
 * feedback-aware ranking.
 *
 * Three pieces:
 *
 * - {@link OCGMemoryStore} — an async HTTP adapter over the OCG BFF
 *   (`add` / `search` / `delete` / `clear` / `listAll` / `feedbackLinks`).
 * - {@link MemorySummary} + {@link buildMemorySummarizer} — a small agent that
 *   distills a conversation into durable facts.
 * - {@link FeedbackEvent} — what the runtime hands to an Agent's `feedbackSink`
 *   after saving a memory: the distilled summary plus signed *capability URLs*
 *   a human can click to mark the memory good/bad (no OCG account needed).
 *
 * Design notes:
 *
 * - The OCG bearer `token` is held **client-side** here (e.g. from `OCG_TOKEN`),
 *   unlike the credential-resolving retrieval tools which resolve a credential
 *   server-side.
 * - Agents only ever **create and read** memories. Good/bad feedback is
 *   human-only: it is delivered out-of-band through `feedbackSink` (e.g. into a
 *   Zendesk ticket) and the capability URLs are never surfaced to the agent's
 *   LLM.
 *
 * Unlike the synchronous in-memory {@link MemoryStore}, an OCG-backed store
 * talks HTTP, so its methods are asynchronous.
 */

import { createHash } from "node:crypto";
import { AgentAPIError } from "./errors.js";
import { Agent } from "./agent.js";
import type { MemoryEntry } from "./memory.js";

// ── Types ────────────────────────────────────────────────

/** An entry to persist. `id` / `metadata.key` seed the OCG memory key. */
export interface OCGMemoryInput {
  id?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/** Signed good/bad capability URLs minted for a memory. */
export interface FeedbackLinks {
  good_url?: string;
  bad_url?: string;
  expires_at?: string;
  [key: string]: unknown;
}

/**
 * Handed to an Agent's `feedbackSink` after a conversation memory is saved.
 *
 * Carries the distilled summary plus the signed capability URLs a human can
 * click to mark the memory good/bad. The integrator routes these out-of-band
 * (e.g. posts them into a Zendesk ticket). These URLs are never shown to the
 * agent's LLM.
 */
export interface FeedbackEvent {
  memoryKey: string;
  summary: string;
  facts: string[];
  tags: string[];
  goodUrl?: string;
  badUrl?: string;
  expiresAt?: string;
  agent?: string;
  user?: string;
  sessionId?: string;
}

/**
 * Options for constructing an {@link OCGMemoryStore}.
 */
export interface OCGMemoryStoreOptions {
  /** Base URL of the OCG instance (required). */
  url: string;
  /** Agent owner key, e.g. `"agent:support"` (required). */
  agent: string;
  /** Optional user owner, e.g. `"user:alice"`. */
  user?: string;
  /**
   * OCG bearer token, held client-side (e.g. from `OCG_TOKEN`). Used by the
   * client-side path when calling OCG directly.
   */
  token?: string;
  /**
   * Server-resolvable credential NAME (default `"OCG_PUBLIC_KEY"`) for the OCG
   * bearer token. Used by the COMPILED/deployed path — the server resolves this
   * via a `#{NAME}` HTTP-header placeholder. Distinct from `token` (the raw
   * client token); both can coexist.
   */
  credential?: string;
  /** Memory scope for writes (default `"user"`). */
  scope?: string;
  /** Maximum results per search query (default 5). */
  maxResults?: number;
  /** Per-request timeout in milliseconds (default 10000). */
  timeoutMs?: number;
}

// ── Helpers ──────────────────────────────────────────────

function hashKey(content: string): string {
  return "mem-" + createHash("sha256").update(content, "utf-8").digest("hex").slice(0, 16);
}

/**
 * Fold the human good/bad signal into a search result's content so the injected
 * prompt context shows the agent when a memory was marked bad and why.
 */
function withSignal(content: string, m: Record<string, unknown>): string {
  const good = Number(m.good_count ?? 0) || 0;
  const bad = Number(m.bad_count ?? 0) || 0;
  if (!good && !bad) return content;
  let out = `${content}  [good ${good} / bad ${bad}]`;
  const notes = Array.isArray(m.feedback_notes) ? m.feedback_notes : [];
  for (const note of notes) {
    const n = note as Record<string, unknown>;
    if (n.verdict === "bad" && n.reason) {
      out += ` (bad: "${String(n.reason)}")`;
    }
  }
  return out;
}

// ── OCGMemoryStore ───────────────────────────────────────

/**
 * Back an agent's long-term memory with an OCG instance.
 *
 * Implements an async store over the OCG BFF:
 *
 * - `add`     -> `POST   /api/v1/memories`
 * - `search`  -> `POST   /api/v1/memories/search` (feedback-blended ranking)
 * - `delete`  -> `DELETE /api/v1/memories/{key}`
 * - `listAll` -> `GET    /api/v1/memories`
 * - `feedbackLinks` -> `POST /api/v1/memories/{key}/feedback-links`
 */
export class OCGMemoryStore {
  /** OCG instance base URL (trailing slash stripped). Read by the serializer. */
  readonly ocgUrl: string;
  /** Agent owner key. */
  readonly agent: string;
  /** Optional user owner. */
  readonly user?: string;
  /** Server-resolvable credential NAME for the OCG bearer token. */
  readonly credential: string;
  /** Memory scope for writes. */
  readonly scope: string;
  /** Maximum results per search query. */
  readonly maxResults: number;

  private readonly headers: Record<string, string>;
  private readonly timeoutMs: number;

  constructor(options: OCGMemoryStoreOptions) {
    if (!options.url || !options.url.trim()) {
      throw new Error("OCGMemoryStore requires a non-blank OCG instance url");
    }
    if (!options.agent || !options.agent.trim()) {
      throw new Error("OCGMemoryStore requires a non-blank agent owner");
    }
    this.ocgUrl = options.url.trim().replace(/\/+$/, "");
    this.agent = options.agent;
    this.user = options.user;
    this.credential = options.credential ?? "OCG_PUBLIC_KEY";
    this.scope = options.scope ?? "user";
    this.maxResults = options.maxResults ?? 5;
    this.timeoutMs = options.timeoutMs ?? 10_000;

    this.headers = { "Content-Type": "application/json" };
    if (options.token) {
      this.headers.Authorization = `Bearer ${options.token}`;
    }
  }

  // ── HTTP plumbing ──────────────────────────────────────

  private async request(
    method: string,
    path: string,
    opts?: { query?: Record<string, string | number | undefined>; body?: unknown },
  ): Promise<unknown> {
    let url = this.ocgUrl + path;
    if (opts?.query) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined && v !== null) params.set(k, String(v));
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: this.headers,
        body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      throw new AgentAPIError(
        `OCG request failed (${method} ${url}): ${err instanceof Error ? err.message : String(err)}`,
        0,
        "",
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new AgentAPIError(`OCG request failed (${method} ${url})`, response.status, body);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  // ── Store interface ────────────────────────────────────

  /** Persist a memory. Returns the memory key. */
  async add(entry: OCGMemoryInput): Promise<string> {
    const key =
      entry.id ||
      (entry.metadata?.key !== undefined ? String(entry.metadata.key) : "") ||
      hashKey(entry.content);
    const rawTags = entry.metadata?.tags;
    const tags = Array.isArray(rawTags) ? (rawTags as unknown[]) : [];
    const body: Record<string, unknown> = {
      key,
      agent: this.agent,
      value: entry.content,
      description: entry.content.slice(0, 200),
      scope: this.scope,
      source: "agent_inferred",
      tags: [...tags],
    };
    if (this.user) body.user = this.user;
    await this.request("POST", "/api/v1/memories", { body });
    return key;
  }

  /** Search memories (feedback-blended ranking). */
  async search(query: string, topK?: number): Promise<MemoryEntry[]> {
    const body: Record<string, unknown> = {
      query,
      agent: this.agent,
      limit: topK ?? this.maxResults,
      include_shared: true,
    };
    if (this.user) body.user = this.user;
    const data = (await this.request("POST", "/api/v1/memories/search", { body })) as {
      memories?: Record<string, unknown>[];
    };
    return (data.memories ?? []).map((m) => ({
      id: String(m.key ?? ""),
      content: withSignal(String(m.value_preview ?? ""), m),
      metadata: {
        relevance_score: m.relevance_score,
        good_count: m.good_count ?? 0,
        bad_count: m.bad_count ?? 0,
      },
      timestamp: Date.now(),
    }));
  }

  /** Delete a memory by key. Returns false on failure (never throws). */
  async delete(memoryId: string): Promise<boolean> {
    try {
      await this.request("DELETE", `/api/v1/memories/${memoryId}`, {
        query: { agent: this.agent, user: this.user },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete every memory for the configured agent/user. No bulk-clear endpoint —
   * fans out over the listed keys.
   */
  async clear(): Promise<void> {
    const entries = await this.listAll();
    await Promise.all(entries.map((e) => this.delete(e.id)));
  }

  /** List all memories for the configured agent/user. */
  async listAll(): Promise<MemoryEntry[]> {
    const data = (await this.request("GET", "/api/v1/memories", {
      query: { agent: this.agent, user: this.user, limit: 200 },
    })) as { memories?: Record<string, unknown>[] };
    return (data.memories ?? []).map((m) => ({
      id: String(m.key ?? ""),
      content: String(m.value_preview ?? ""),
      timestamp: Date.now(),
    }));
  }

  // ── Capability feedback links (human-only, out-of-band) ─

  /**
   * Mint signed good/bad capability URLs for a memory.
   *
   * The URLs require no OCG login — a human (e.g. a support engineer) clicks
   * them to vote. Requires the OCG instance to have a feedback-link secret
   * configured (else OCG returns 501).
   */
  async feedbackLinks(key: string): Promise<FeedbackLinks> {
    return (await this.request("POST", `/api/v1/memories/${key}/feedback-links`, {
      query: { agent: this.agent, user: this.user },
    })) as FeedbackLinks;
  }
}

// ── Conversation summarization (Claude-style distillation) ─

/** Structured output for the conversation summarizer agent. */
export interface MemorySummary {
  /** One short paragraph: what happened / what was learned. */
  summary: string;
  /** Durable, reusable facts about the user or task (no chit-chat). */
  facts: string[];
  /** Short topical tags. */
  tags: string[];
}

/** JSON Schema describing {@link MemorySummary} (used as the summarizer's outputType). */
export const MEMORY_SUMMARY_SCHEMA = {
  type: "object",
  description: "MemorySummary",
  properties: {
    summary: {
      type: "string",
      description: "One short paragraph: what happened / what was learned.",
    },
    facts: {
      type: "array",
      items: { type: "string" },
      description: "Durable, reusable facts about the user or task (no chit-chat).",
    },
    tags: {
      type: "array",
      items: { type: "string" },
      description: "Short topical tags.",
    },
  },
  required: ["summary"],
} as const;

export const MEMORY_SUMMARIZER_INSTRUCTIONS =
  "You distill a conversation into a durable memory. Read the transcript and " +
  "extract only reusable, durable facts about the user, their preferences, and " +
  "the task — the kind of thing worth remembering for next time. Ignore greetings, " +
  "filler, and one-off details. Write a one-paragraph summary, a short list of " +
  "facts, and a few topical tags. Be concise and concrete.";

/**
 * Build the internal agent that summarizes a conversation into a memory.
 *
 * It uses {@link MemorySummary} structured output and is intentionally created
 * WITHOUT `semanticMemory` so any post-run save hook skips it (no recursion).
 */
export function buildMemorySummarizer(model: string, name = "__memory_summarizer"): Agent {
  return new Agent({
    name,
    model,
    instructions: MEMORY_SUMMARIZER_INSTRUCTIONS,
    outputType: MEMORY_SUMMARY_SCHEMA,
    maxTurns: 1,
  });
}
