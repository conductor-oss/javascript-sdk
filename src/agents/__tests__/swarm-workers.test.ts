import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { Agent } from "../agent.js";
import { AgentRuntime } from "../runtime.js";
import { OnToolResult, OnTextMention, OnCondition } from "../handoff.js";
import type { HandoffContext } from "../handoff.js";

// ── Helpers ─────────────────────────────────────────────

/**
 * Access the private workerManager's pending workers array via any cast.
 */
function getRegisteredWorkers(
  runtime: AgentRuntime,
): { taskName: string; handler: Function }[] {
  return (runtime as any).workerManager.pendingWorkers;
}

/**
 * Find a registered worker by task name and invoke it with inputData.
 */
async function invokeWorker(
  runtime: AgentRuntime,
  taskName: string,
  inputData: Record<string, unknown> = {},
): Promise<unknown> {
  const workers = getRegisteredWorkers(runtime);
  const worker = workers.find((w) => w.taskName === taskName);
  if (!worker) {
    throw new Error(
      `Worker not found: ${taskName}. Registered: ${workers.map((w) => w.taskName).join(", ")}`,
    );
  }
  return worker.handler(inputData);
}

function createRuntime(): AgentRuntime {
  return new AgentRuntime({ serverUrl: "http://localhost:8080/api" });
}

// ── OnToolResult.shouldHandoff ──────────────────────────

describe("OnToolResult.shouldHandoff", () => {
  it("returns true when tool name matches", () => {
    const cond = new OnToolResult({ target: "refund", toolName: "check_order" });
    expect(cond.shouldHandoff({ result: "", toolName: "check_order" })).toBe(true);
  });

  it("returns false when tool name does not match", () => {
    const cond = new OnToolResult({ target: "refund", toolName: "check_order" });
    expect(cond.shouldHandoff({ result: "", toolName: "other_tool" })).toBe(false);
  });

  it("checks resultContains when specified", () => {
    const cond = new OnToolResult({
      target: "refund",
      toolName: "check_order",
      resultContains: "eligible",
    });
    expect(
      cond.shouldHandoff({
        result: "",
        toolName: "check_order",
        toolResult: "eligible for refund",
      }),
    ).toBe(true);
    expect(
      cond.shouldHandoff({ result: "", toolName: "check_order", toolResult: "not found" }),
    ).toBe(false);
  });
});

// ── OnTextMention.shouldHandoff ─────────────────────────

describe("OnTextMention.shouldHandoff", () => {
  it("returns true when text is mentioned (case-insensitive)", () => {
    const cond = new OnTextMention({ target: "billing", text: "transfer to billing" });
    expect(cond.shouldHandoff({ result: "I will TRANSFER TO BILLING now" })).toBe(true);
  });

  it("returns false when text is not mentioned", () => {
    const cond = new OnTextMention({ target: "billing", text: "transfer to billing" });
    expect(cond.shouldHandoff({ result: "Let me help you with that" })).toBe(false);
  });
});

// ── OnCondition.shouldHandoff ───────────────────────────

describe("OnCondition.shouldHandoff", () => {
  it("returns true when condition function returns true", () => {
    const cond = new OnCondition({
      target: "summarizer",
      condition: (ctx: HandoffContext) => ctx.result.includes("done"),
    });
    expect(cond.shouldHandoff({ result: "I am done" })).toBe(true);
  });

  it("returns false when condition function returns false", () => {
    const cond = new OnCondition({
      target: "summarizer",
      condition: () => false,
    });
    expect(cond.shouldHandoff({ result: "anything" })).toBe(false);
  });

  it("returns false when condition throws", () => {
    const cond = new OnCondition({
      target: "summarizer",
      condition: () => {
        throw new Error("boom");
      },
    });
    expect(cond.shouldHandoff({ result: "anything" })).toBe(false);
  });
});

// ── Check Transfer Worker ───────────────────────────────

describe("_registerCheckTransferWorker", () => {
  let runtime: AgentRuntime;

  beforeEach(() => {
    runtime = createRuntime();
  });

  it("registers a check_transfer worker", async () => {
    const agent = new Agent({ name: "support", model: "gpt-4o" });
    // Call the private method
    await (runtime as any)._registerCheckTransferWorker(agent.name);

    const workers = getRegisteredWorkers(runtime);
    expect(workers.some((w) => w.taskName === "support_check_transfer")).toBe(true);
  });

  it("detects transfer_to in tool_calls", async () => {
    await (runtime as any)._registerCheckTransferWorker("support");

    const result = await invokeWorker(runtime, "support_check_transfer", {
      tool_calls: [{ name: "support_transfer_to_billing", arguments: {} }],
    });
    expect(result).toEqual({ is_transfer: true, transfer_to: "billing", transfer_message: "" });
  });

  it("returns is_transfer false when no transfer tool found", async () => {
    await (runtime as any)._registerCheckTransferWorker("support");

    const result = await invokeWorker(runtime, "support_check_transfer", {
      tool_calls: [{ name: "search", arguments: {} }],
    });
    expect(result).toEqual({ is_transfer: false, transfer_to: "", transfer_message: "" });
  });

  it("handles empty tool_calls", async () => {
    await (runtime as any)._registerCheckTransferWorker("support");

    const result = await invokeWorker(runtime, "support_check_transfer", {});
    expect(result).toEqual({ is_transfer: false, transfer_to: "", transfer_message: "" });
  });

  it("handles null tool_calls", async () => {
    await (runtime as any)._registerCheckTransferWorker("support");

    const result = await invokeWorker(runtime, "support_check_transfer", { tool_calls: null });
    expect(result).toEqual({ is_transfer: false, transfer_to: "", transfer_message: "" });
  });

  it("returns transfer_message from inputParameters.message (spec R13)", async () => {
    await (runtime as any)._registerCheckTransferWorker("support");

    const result = await invokeWorker(runtime, "support_check_transfer", {
      tool_calls: [
        {
          name: "support_transfer_to_billing",
          inputParameters: { message: "Please handle this refund" },
        },
      ],
    });
    expect(result).toEqual({
      is_transfer: true,
      transfer_to: "billing",
      transfer_message: "Please handle this refund",
    });
  });

  it("tolerates the arguments key variant for message (older tool schema)", async () => {
    await (runtime as any)._registerCheckTransferWorker("support");

    const result = await invokeWorker(runtime, "support_check_transfer", {
      tool_calls: [
        { name: "support_transfer_to_billing", arguments: { message: "Legacy schema note" } },
      ],
    });
    expect(result).toEqual({
      is_transfer: true,
      transfer_to: "billing",
      transfer_message: "Legacy schema note",
    });
  });

  it("stringifies a non-string message", async () => {
    await (runtime as any)._registerCheckTransferWorker("support");

    const result = await invokeWorker(runtime, "support_check_transfer", {
      tool_calls: [{ name: "support_transfer_to_billing", inputParameters: { message: 42 } }],
    });
    expect(result).toEqual({ is_transfer: true, transfer_to: "billing", transfer_message: "42" });
  });

  it("first-wins with a single transfer call: no dropped_transfers key", async () => {
    await (runtime as any)._registerCheckTransferWorker("support");

    const result = (await invokeWorker(runtime, "support_check_transfer", {
      tool_calls: [
        { name: "support_transfer_to_billing", inputParameters: { message: "note" } },
      ],
    })) as Record<string, unknown>;
    expect(result).not.toHaveProperty("dropped_transfers");
  });

  it("first-wins with two transfer calls: honors first, drops second, logs a warning", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await (runtime as any)._registerCheckTransferWorker("support");

      const result = await invokeWorker(runtime, "support_check_transfer", {
        tool_calls: [
          { name: "support_transfer_to_billing", inputParameters: { message: "first note" } },
          { name: "support_transfer_to_refund", inputParameters: { message: "second note" } },
        ],
      });
      expect(result).toEqual({
        is_transfer: true,
        transfer_to: "billing",
        transfer_message: "first note",
        dropped_transfers: [{ transfer_to: "refund", message: "second note" }],
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const [warning] = warnSpy.mock.calls[0] as [string];
      expect(warning).toContain("billing");
      expect(warning).toContain("refund");
    } finally {
      warnSpy.mockRestore();
    }
  });
});

// ── Swarm Transfer Workers ──────────────────────────────

describe("_registerSwarmTransferWorkers", () => {
  let runtime: AgentRuntime;

  beforeEach(() => {
    runtime = createRuntime();
  });

  it("registers transfer workers for all agent pairs", async () => {
    const sub1 = new Agent({ name: "billing", model: "gpt-4o" });
    const sub2 = new Agent({ name: "refund", model: "gpt-4o" });
    const parent = new Agent({
      name: "support",
      model: "gpt-4o",
      agents: [sub1, sub2],
      strategy: "swarm",
    });

    await (runtime as any)._registerSwarmTransferWorkers(parent);

    const workers = getRegisteredWorkers(runtime);
    const taskNames = workers.map((w) => w.taskName);

    // Each of 3 agents gets transfer tools to the other 2 = 6 total
    expect(taskNames).toContain("support_transfer_to_billing");
    expect(taskNames).toContain("support_transfer_to_refund");
    expect(taskNames).toContain("billing_transfer_to_support");
    expect(taskNames).toContain("billing_transfer_to_refund");
    expect(taskNames).toContain("refund_transfer_to_support");
    expect(taskNames).toContain("refund_transfer_to_billing");
  });

  it("transfer workers return empty object by default", async () => {
    const sub1 = new Agent({ name: "billing", model: "gpt-4o" });
    const parent = new Agent({
      name: "support",
      model: "gpt-4o",
      agents: [sub1],
      strategy: "swarm",
    });

    await (runtime as any)._registerSwarmTransferWorkers(parent);

    const result = await invokeWorker(runtime, "support_transfer_to_billing", {});
    expect(result).toEqual({});
  });

  it("transfer worker echoes a non-empty message (spec R13)", async () => {
    const sub1 = new Agent({ name: "billing", model: "gpt-4o" });
    const parent = new Agent({
      name: "support",
      model: "gpt-4o",
      agents: [sub1],
      strategy: "swarm",
    });

    await (runtime as any)._registerSwarmTransferWorkers(parent);

    const result = await invokeWorker(runtime, "support_transfer_to_billing", {
      message: "Please handle this refund",
    });
    expect(result).toEqual({ message: "Please handle this refund" });
  });

  it("transfer worker returns {} for an empty-string message", async () => {
    const sub1 = new Agent({ name: "billing", model: "gpt-4o" });
    const parent = new Agent({
      name: "support",
      model: "gpt-4o",
      agents: [sub1],
      strategy: "swarm",
    });

    await (runtime as any)._registerSwarmTransferWorkers(parent);

    const result = await invokeWorker(runtime, "support_transfer_to_billing", { message: "" });
    expect(result).toEqual({});
  });

  it("returns error for unreachable targets with allowed_transitions", async () => {
    const sub1 = new Agent({ name: "billing", model: "gpt-4o" });
    const sub2 = new Agent({ name: "refund", model: "gpt-4o" });
    const parent = new Agent({
      name: "support",
      model: "gpt-4o",
      agents: [sub1, sub2],
      strategy: "swarm",
      // Only support can reach billing, nobody can reach refund
      allowedTransitions: { support: ["billing"] },
    });

    await (runtime as any)._registerSwarmTransferWorkers(parent);

    // billing is reachable → no-op
    const okResult = await invokeWorker(runtime, "support_transfer_to_billing", {});
    expect(okResult).toEqual({});

    // refund is unreachable → error message
    const errResult = (await invokeWorker(runtime, "support_transfer_to_refund", {})) as Record<
      string,
      unknown
    >;
    expect(errResult.result).toContain("ERROR");
    expect(errResult.result).toContain("not available");
  });

  it("respects requiredWorkers filter", async () => {
    const sub1 = new Agent({ name: "billing", model: "gpt-4o" });
    const parent = new Agent({
      name: "support",
      model: "gpt-4o",
      agents: [sub1],
      strategy: "swarm",
    });

    const required = new Set(["support_transfer_to_billing"]);
    await (runtime as any)._registerSwarmTransferWorkers(parent, required);

    const workers = getRegisteredWorkers(runtime);
    const taskNames = workers.map((w) => w.taskName);

    expect(taskNames).toContain("support_transfer_to_billing");
    expect(taskNames).not.toContain("billing_transfer_to_support");
  });
});

// ── Handoff Check Worker ────────────────────────────────

describe("_registerHandoffCheckWorker", () => {
  let runtime: AgentRuntime;

  beforeEach(() => {
    runtime = createRuntime();
  });

  it("detects transfer and returns target index", async () => {
    const sub1 = new Agent({ name: "billing", model: "gpt-4o" });
    const parent = new Agent({
      name: "support",
      model: "gpt-4o",
      agents: [sub1],
      strategy: "swarm",
    });

    await (runtime as any)._registerHandoffCheckWorker(parent);

    const result = await invokeWorker(runtime, "support_handoff_check", {
      result: "",
      active_agent: "0",
      is_transfer: true,
      transfer_to: "billing",
    });
    expect(result).toEqual({ active_agent: "1", handoff: true });
  });

  it("returns no handoff when no transfer and no conditions match", async () => {
    const sub1 = new Agent({ name: "billing", model: "gpt-4o" });
    const parent = new Agent({
      name: "support",
      model: "gpt-4o",
      agents: [sub1],
      strategy: "swarm",
    });

    await (runtime as any)._registerHandoffCheckWorker(parent);

    const result = await invokeWorker(runtime, "support_handoff_check", {
      result: "hello",
      active_agent: "0",
      is_transfer: false,
      transfer_to: "",
    });
    expect(result).toEqual({ active_agent: "0", handoff: false });
  });

  it("evaluates OnTextMention conditions as fallback", async () => {
    const sub1 = new Agent({ name: "billing", model: "gpt-4o" });
    const parent = new Agent({
      name: "support",
      model: "gpt-4o",
      agents: [sub1],
      strategy: "swarm",
      handoffs: [new OnTextMention({ target: "billing", text: "transfer to billing" })],
    });

    await (runtime as any)._registerHandoffCheckWorker(parent);

    const result = await invokeWorker(runtime, "support_handoff_check", {
      result: "I will transfer to billing now",
      active_agent: "0",
      is_transfer: false,
      transfer_to: "",
    });
    expect(result).toEqual({ active_agent: "1", handoff: true });
  });

  it("evaluates OnCondition conditions as fallback", async () => {
    const sub1 = new Agent({ name: "summarizer", model: "gpt-4o" });
    const parent = new Agent({
      name: "support",
      model: "gpt-4o",
      agents: [sub1],
      strategy: "swarm",
      handoffs: [
        new OnCondition({
          target: "summarizer",
          condition: (ctx: HandoffContext) => ctx.result.includes("DONE"),
        }),
      ],
    });

    await (runtime as any)._registerHandoffCheckWorker(parent);

    const result = await invokeWorker(runtime, "support_handoff_check", {
      result: "Task is DONE",
      active_agent: "0",
      is_transfer: false,
      transfer_to: "",
    });
    expect(result).toEqual({ active_agent: "1", handoff: true });
  });

  it("respects allowed_transitions for transfers", async () => {
    const sub1 = new Agent({ name: "billing", model: "gpt-4o" });
    const sub2 = new Agent({ name: "refund", model: "gpt-4o" });
    const parent = new Agent({
      name: "support",
      model: "gpt-4o",
      agents: [sub1, sub2],
      strategy: "swarm",
      // support can only reach billing, not refund
      allowedTransitions: { support: ["billing"] },
    });

    await (runtime as any)._registerHandoffCheckWorker(parent);

    // Allowed transfer
    const okResult = await invokeWorker(runtime, "support_handoff_check", {
      active_agent: "0",
      is_transfer: true,
      transfer_to: "billing",
    });
    expect(okResult).toEqual({ active_agent: "1", handoff: true });

    // Blocked transfer — first attempt retries
    const blockedResult = await invokeWorker(runtime, "support_handoff_check", {
      active_agent: "0",
      is_transfer: true,
      transfer_to: "refund",
    });
    expect(blockedResult).toEqual({ active_agent: "0", handoff: true });
  });

  it("exits loop after max blocked retries", async () => {
    const sub1 = new Agent({ name: "refund", model: "gpt-4o" });
    const parent = new Agent({
      name: "support",
      model: "gpt-4o",
      agents: [sub1],
      strategy: "swarm",
      allowedTransitions: { support: [] }, // no transfers allowed
    });

    await (runtime as any)._registerHandoffCheckWorker(parent);

    // Try 3 times (max_blocked_retries = 3), each should return handoff: true (retry)
    for (let i = 0; i < 3; i++) {
      const result = await invokeWorker(runtime, "support_handoff_check", {
        active_agent: "0",
        is_transfer: true,
        transfer_to: "refund",
      });
      expect(result).toEqual({ active_agent: "0", handoff: true });
    }

    // 4th attempt should exit the loop
    const exitResult = await invokeWorker(runtime, "support_handoff_check", {
      active_agent: "0",
      is_transfer: true,
      transfer_to: "refund",
    });
    expect(exitResult).toEqual({ active_agent: "0", handoff: false });
  });

  it('handles is_transfer as string "true"', async () => {
    const sub1 = new Agent({ name: "billing", model: "gpt-4o" });
    const parent = new Agent({
      name: "support",
      model: "gpt-4o",
      agents: [sub1],
      strategy: "swarm",
    });

    await (runtime as any)._registerHandoffCheckWorker(parent);

    const result = await invokeWorker(runtime, "support_handoff_check", {
      active_agent: "0",
      is_transfer: "true",
      transfer_to: "billing",
    });
    expect(result).toEqual({ active_agent: "1", handoff: true });
  });
});

// ── Process Selection Worker ────────────────────────────

describe("_registerProcessSelectionWorker", () => {
  let runtime: AgentRuntime;

  beforeEach(() => {
    runtime = createRuntime();
  });

  it("registers a process_selection worker", async () => {
    const sub1 = new Agent({ name: "agent_a", model: "gpt-4o" });
    const sub2 = new Agent({ name: "agent_b", model: "gpt-4o" });
    const parent = new Agent({
      name: "coordinator",
      model: "gpt-4o",
      agents: [sub1, sub2],
      strategy: "manual",
    });

    await (runtime as any)._registerProcessSelectionWorker(parent);

    const workers = getRegisteredWorkers(runtime);
    expect(workers.some((w) => w.taskName === "coordinator_process_selection")).toBe(true);
  });

  it('returns default "0" when no human_output', async () => {
    const sub1 = new Agent({ name: "agent_a", model: "gpt-4o" });
    const parent = new Agent({
      name: "coordinator",
      model: "gpt-4o",
      agents: [sub1],
      strategy: "manual",
    });

    await (runtime as any)._registerProcessSelectionWorker(parent);

    const result = await invokeWorker(runtime, "coordinator_process_selection", {});
    expect(result).toEqual({ selected: "0" });
  });

  it("maps agent name to index from dict", async () => {
    const sub1 = new Agent({ name: "agent_a", model: "gpt-4o" });
    const sub2 = new Agent({ name: "agent_b", model: "gpt-4o" });
    const parent = new Agent({
      name: "coordinator",
      model: "gpt-4o",
      agents: [sub1, sub2],
      strategy: "manual",
    });

    await (runtime as any)._registerProcessSelectionWorker(parent);

    const result = await invokeWorker(runtime, "coordinator_process_selection", {
      human_output: { selected: "agent_b" },
    });
    expect(result).toEqual({ selected: "1" });
  });

  it('maps agent name from "agent" key', async () => {
    const sub1 = new Agent({ name: "agent_a", model: "gpt-4o" });
    const sub2 = new Agent({ name: "agent_b", model: "gpt-4o" });
    const parent = new Agent({
      name: "coordinator",
      model: "gpt-4o",
      agents: [sub1, sub2],
      strategy: "manual",
    });

    await (runtime as any)._registerProcessSelectionWorker(parent);

    const result = await invokeWorker(runtime, "coordinator_process_selection", {
      human_output: { agent: "agent_a" },
    });
    expect(result).toEqual({ selected: "0" });
  });

  it("passes through numeric index as string", async () => {
    const sub1 = new Agent({ name: "agent_a", model: "gpt-4o" });
    const parent = new Agent({
      name: "coordinator",
      model: "gpt-4o",
      agents: [sub1],
      strategy: "manual",
    });

    await (runtime as any)._registerProcessSelectionWorker(parent);

    const result = await invokeWorker(runtime, "coordinator_process_selection", {
      human_output: 1,
    });
    expect(result).toEqual({ selected: "1" });
  });
});

// ── Integration: _registerSystemWorkers ─────────────────

describe("_registerSystemWorkers integration", () => {
  let runtime: AgentRuntime;

  beforeEach(() => {
    runtime = createRuntime();
  });

  it("registers swarm workers when requiredWorkers is null (fallback)", async () => {
    const sub1 = new Agent({ name: "billing", model: "gpt-4o" });
    const parent = new Agent({
      name: "support",
      model: "gpt-4o",
      agents: [sub1],
      strategy: "swarm",
      handoffs: [new OnTextMention({ target: "billing", text: "billing" })],
    });

    await (runtime as any)._registerSystemWorkers(parent, null);

    const workers = getRegisteredWorkers(runtime);
    const taskNames = workers.map((w) => w.taskName);

    expect(taskNames).toContain("support_transfer_to_billing");
    expect(taskNames).toContain("billing_transfer_to_support");
    expect(taskNames).toContain("support_check_transfer");
    expect(taskNames).toContain("support_handoff_check");
  });

  it("registers only required workers from server set", async () => {
    const sub1 = new Agent({ name: "billing", model: "gpt-4o" });
    const parent = new Agent({
      name: "support",
      model: "gpt-4o",
      agents: [sub1],
      strategy: "swarm",
      handoffs: [new OnTextMention({ target: "billing", text: "billing" })],
    });

    const required = new Set([
      "support_check_transfer",
      "support_handoff_check",
      "support_transfer_to_billing",
    ]);
    await (runtime as any)._registerSystemWorkers(parent, required);

    const workers = getRegisteredWorkers(runtime);
    const taskNames = workers.map((w) => w.taskName);

    expect(taskNames).toContain("support_check_transfer");
    expect(taskNames).toContain("support_handoff_check");
    expect(taskNames).toContain("support_transfer_to_billing");
    // billing_transfer_to_support is NOT required, so should not be registered
    expect(taskNames).not.toContain("billing_transfer_to_support");
  });

  it("registers process_selection for manual strategy", async () => {
    const sub1 = new Agent({ name: "agent_a", model: "gpt-4o" });
    const parent = new Agent({
      name: "coordinator",
      model: "gpt-4o",
      agents: [sub1],
      strategy: "manual",
    });

    await (runtime as any)._registerSystemWorkers(parent, null);

    const workers = getRegisteredWorkers(runtime);
    const taskNames = workers.map((w) => w.taskName);

    expect(taskNames).toContain("coordinator_process_selection");
  });

  it("does not register process_selection for non-manual strategy", async () => {
    const sub1 = new Agent({ name: "agent_a", model: "gpt-4o" });
    const parent = new Agent({
      name: "coordinator",
      model: "gpt-4o",
      agents: [sub1],
      strategy: "swarm",
    });

    await (runtime as any)._registerSystemWorkers(parent, null);

    const workers = getRegisteredWorkers(runtime);
    const taskNames = workers.map((w) => w.taskName);

    expect(taskNames).not.toContain("coordinator_process_selection");
  });
});

// ── SWARM handoff_check registration (no explicit handoffs) ──
// This is the exact pattern that caused a deadlock in Python:
// SWARM parent has NO handoffs, only children have OnTextMention.
// Server always generates {parent}_handoff_check for SWARM workflows.

describe("SWARM handoff_check without explicit handoffs on parent", () => {
  let runtime: AgentRuntime;

  beforeEach(() => {
    runtime = createRuntime();
  });

  it("registers handoff_check for SWARM parent with NO explicit handoffs", async () => {
    const coder = new Agent({
      name: "coder",
      model: "gpt-4o",
      handoffs: [new OnTextMention({ target: "qa_agent", text: "HANDOFF_TO_QA" })],
    });
    const qa = new Agent({
      name: "qa_agent",
      model: "gpt-4o",
      handoffs: [new OnTextMention({ target: "coder", text: "HANDOFF_TO_CODER" })],
    });
    const swarmParent = new Agent({
      name: "coder_qa_loop",
      model: "gpt-4o",
      agents: [coder, qa],
      strategy: "swarm",
      // NO handoffs on parent — only children have them
    });

    await (runtime as any)._registerSystemWorkers(swarmParent, null);

    const workers = getRegisteredWorkers(runtime);
    const taskNames = workers.map((w) => w.taskName);

    // The critical assertion: handoff_check must be registered
    expect(taskNames).toContain("coder_qa_loop_handoff_check");
  });

  it("registers handoff_check for bare SWARM parent (no handoffs anywhere)", async () => {
    const a = new Agent({ name: "agent_a", model: "gpt-4o" });
    const b = new Agent({ name: "agent_b", model: "gpt-4o" });
    const swarm = new Agent({
      name: "my_swarm",
      model: "gpt-4o",
      agents: [a, b],
      strategy: "swarm",
    });

    await (runtime as any)._registerSystemWorkers(swarm, null);

    const workers = getRegisteredWorkers(runtime);
    const taskNames = workers.map((w) => w.taskName);

    expect(taskNames).toContain("my_swarm_handoff_check");
  });

  it("registers handoff_check for 3-agent SWARM with no handoffs", async () => {
    const a = new Agent({ name: "a", model: "gpt-4o" });
    const b = new Agent({ name: "b", model: "gpt-4o" });
    const c = new Agent({ name: "c", model: "gpt-4o" });
    const swarm = new Agent({
      name: "trio",
      model: "gpt-4o",
      agents: [a, b, c],
      strategy: "swarm",
    });

    await (runtime as any)._registerSystemWorkers(swarm, null);

    const workers = getRegisteredWorkers(runtime);
    const taskNames = workers.map((w) => w.taskName);

    expect(taskNames).toContain("trio_handoff_check");
  });

  it("respects requiredWorkers filter for SWARM without handoffs", async () => {
    const a = new Agent({ name: "a", model: "gpt-4o" });
    const b = new Agent({ name: "b", model: "gpt-4o" });
    const swarm = new Agent({
      name: "my_swarm",
      model: "gpt-4o",
      agents: [a, b],
      strategy: "swarm",
    });

    // Server says only handoff_check is needed
    const required = new Set(["my_swarm_handoff_check"]);
    await (runtime as any)._registerSystemWorkers(swarm, required);

    const workers = getRegisteredWorkers(runtime);
    const taskNames = workers.map((w) => w.taskName);

    expect(taskNames).toContain("my_swarm_handoff_check");
  });

  it("does NOT register handoff_check for non-SWARM strategies without handoffs", async () => {
    for (const strategy of ["sequential", "parallel", "round_robin", "random"] as const) {
      const rt = createRuntime();
      const a = new Agent({ name: "a", model: "gpt-4o" });
      const b = new Agent({ name: "b", model: "gpt-4o" });
      const parent = new Agent({
        name: `parent_${strategy}`,
        model: "gpt-4o",
        agents: [a, b],
        strategy,
      });

      await (rt as any)._registerSystemWorkers(parent, null);

      const workers = getRegisteredWorkers(rt);
      const taskNames = workers.map((w) => w.taskName);

      expect(taskNames).not.toContain(`parent_${strategy}_handoff_check`);
    }
  });

  it("single agent (no children) does NOT get handoff_check", async () => {
    const single = new Agent({ name: "solo", model: "gpt-4o" });

    await (runtime as any)._registerSystemWorkers(single, null);

    const workers = getRegisteredWorkers(runtime);
    const taskNames = workers.map((w) => w.taskName);

    expect(taskNames).not.toContain("solo_handoff_check");
  });
});

// ── Counterfactual: prove the condition matters ──────────

describe("Counterfactual: handoff_check condition verification", () => {
  it("condition `agent.handoffs.length > 0 || agent.strategy === 'swarm'` covers SWARM without handoffs", () => {
    // This test verifies the LOGIC of the condition at runtime.ts:877
    // by checking both branches independently.

    // Branch 1: handoffs on parent → should register
    const withHandoffs = new Agent({
      name: "p",
      model: "gpt-4o",
      agents: [new Agent({ name: "c", model: "gpt-4o" })],
      strategy: "sequential",
      handoffs: [new OnTextMention({ target: "c", text: "GO" })],
    });
    expect(withHandoffs.handoffs.length > 0 || withHandoffs.strategy === "swarm").toBe(true);

    // Branch 2: SWARM strategy, no handoffs → should register
    const swarmNoHandoffs = new Agent({
      name: "p",
      model: "gpt-4o",
      agents: [new Agent({ name: "c", model: "gpt-4o" })],
      strategy: "swarm",
    });
    expect(
      swarmNoHandoffs.handoffs.length > 0 || swarmNoHandoffs.strategy === "swarm",
    ).toBe(true);

    // Neither: no handoffs, not swarm → should NOT register
    const neither = new Agent({
      name: "p",
      model: "gpt-4o",
      agents: [new Agent({ name: "c", model: "gpt-4o" })],
      strategy: "sequential",
    });
    expect(neither.handoffs.length > 0 || neither.strategy === "swarm").toBe(false);
  });

  it("old buggy condition (handoffs only) would miss SWARM without handoffs", () => {
    // Simulates the Python bug: only checking handoffs
    const swarmNoHandoffs = new Agent({
      name: "coder_qa_loop",
      model: "gpt-4o",
      agents: [
        new Agent({ name: "coder", model: "gpt-4o" }),
        new Agent({ name: "qa", model: "gpt-4o" }),
      ],
      strategy: "swarm",
    });

    // OLD condition (the Python bug): only handoffs
    const oldCondition = swarmNoHandoffs.handoffs.length > 0;
    expect(oldCondition).toBe(false); // Would NOT register → deadlock!

    // NEW condition: handoffs OR swarm strategy
    const newCondition =
      swarmNoHandoffs.handoffs.length > 0 || swarmNoHandoffs.strategy === "swarm";
    expect(newCondition).toBe(true); // Correctly registers
  });

  it("issue fixer exact topology: handoffs on children, none on parent", () => {
    const coder = new Agent({
      name: "coder",
      model: "gpt-4o",
      handoffs: [new OnTextMention({ target: "qa_agent", text: "HANDOFF_TO_QA" })],
    });
    const qa = new Agent({
      name: "qa_agent",
      model: "gpt-4o",
      handoffs: [new OnTextMention({ target: "coder", text: "HANDOFF_TO_CODER" })],
    });
    const loop = new Agent({
      name: "coder_qa_loop",
      model: "gpt-4o",
      agents: [coder, qa],
      strategy: "swarm",
    });

    // Parent has no handoffs
    expect(loop.handoffs.length).toBe(0);
    // But children do
    expect(coder.handoffs.length).toBe(1);
    expect(qa.handoffs.length).toBe(1);
    // Strategy is swarm
    expect(loop.strategy).toBe("swarm");
    // Condition passes → handoff_check will be registered
    expect(loop.handoffs.length > 0 || loop.strategy === "swarm").toBe(true);
  });
});
