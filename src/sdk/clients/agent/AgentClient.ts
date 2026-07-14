// Copyright (c) 2026 Agentspan
// Licensed under the MIT License. See LICENSE file in the project root for details.

/**
 * Control-plane surface for the Agent Runtime API (`/agent/*`).
 *
 * Mirrors the Java/C#/Python SDK split: the `/agent/*` HTTP surface
 * (compile / deploy / start / status / respond / stop / signal / stream)
 * is reached through a dedicated client rather than inline on
 * {@link AgentRuntime}, and routes through the same authenticated call path
 * every other Conductor resource client uses (see {@link OrkesAgentClient}).
 *
 * `AgentClient` is the interface (11 ops, the spec's `R1` surface);
 * {@link OrkesAgentClient} is the Conductor/Orkes implementation, which also
 * carries the agent-level convenience methods ({@link OrkesAgentClient.run},
 * `start`, `deploy`, `schedule`) and the `workflows`/`schedules` accessors.
 */

import type { createConductorClient } from "../../createConductorClient";
import type { AgentResult, AgentStatus } from "../../../agents/types.js";
import type { AgentStream } from "../../../agents/stream.js";

/**
 * The resource client returned by `createConductorClient`. The package's
 * exported `ConductorClient` alias points at the bare `Client`, which lacks
 * the `*Resource` members (and the R2 auth accessors), so we derive the real
 * shape from the factory.
 */
export type ConductorClient = Awaited<ReturnType<typeof createConductorClient>>;

/** Handle to a control-plane-started agent (no local workers). */
export interface ClientHandle {
  readonly executionId: string;
  getStatus(): Promise<AgentStatus>;
  wait(pollIntervalMs?: number): Promise<AgentResult>;
  respond(output: unknown): Promise<void>;
  approve(output?: Record<string, unknown>): Promise<void>;
  reject(reason?: string): Promise<void>;
  send(message: string): Promise<void>;
  stop(): Promise<void>;
  stream(): AgentStream;
}

/**
 * The `/agent/*` control-plane surface (spec R1). Every non-streaming op
 * rides the shared {@link ConductorClient}'s authenticated call path — no
 * bespoke auth/transport logic lives behind this interface.
 */
export interface AgentClient {
  /** POST /agent/start — start an agent execution. */
  startAgent(payload: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>>;
  /** POST /agent/deploy — compile + register (no execution). */
  deployAgent(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
  /** POST /agent/compile — compile agent config to a workflow def. */
  compile(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
  /** GET /agent/{id}/status — current execution status. */
  status(executionId: string, signal?: AbortSignal): Promise<AgentStatus>;
  /** GET /agent/execution/{id} — full execution data (tasks, output, tokens). */
  getExecution(executionId: string, signal?: AbortSignal): Promise<Record<string, unknown> | null>;
  /** GET /agent/executions — list executions, optionally filtered. */
  listExecutions(params?: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>>;
  /** POST /agent/{id}/respond — complete a pending human task. */
  respond(executionId: string, body: unknown, signal?: AbortSignal): Promise<void>;
  /** POST /agent/{id}/stop — stop a running execution. */
  stop(executionId: string, signal?: AbortSignal): Promise<void>;
  /** POST /agent/{id}/signal — inject persistent context into a running execution. */
  signal(executionId: string, message: string, signal?: AbortSignal): Promise<void>;
  /** A connected {@link AgentStream} for an execution's SSE feed. */
  stream(executionId: string, lastEventId?: string, signal?: AbortSignal): Promise<AgentStream>;
  /**
   * Release this client's open {@link AgentStream}s. The shared Conductor
   * client owns the underlying HTTP transport (and is stopped too, but only
   * when this instance built its own client rather than reusing an injected
   * one — see {@link OrkesAgentClient}).
   */
  close(): Promise<void>;
}
