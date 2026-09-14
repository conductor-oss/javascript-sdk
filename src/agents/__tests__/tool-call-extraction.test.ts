/**
 * `result.toolCalls` extraction.
 * Task shapes mirror what the server emits per tool kind, taken from real runs.
 */

import { describe, it, expect } from "@jest/globals";

import { _extractToolCalls } from "../runtime.js";

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

const extract = (tasks: Record<string, unknown>[]): ToolCall[] =>
  _extractToolCalls({ tasks }) as ToolCall[];

/** A tool task as the dispatch script builds it. */
const toolTask = (
  overrides: Record<string, unknown> & { referenceTaskName: string; taskType: string },
): Record<string, unknown> => ({
  outputData: {},
  ...overrides,
  inputData: {
    ...((overrides.inputData ?? {}) as Record<string, unknown>),
  },
});

describe("_extractToolCalls — tool naming", () => {
  it("names an HTTP tool after the tool, not the task type", () => {
    const calls = extract([
      toolTask({
        referenceTaskName: "call_PMnNIdOPvm9EQ8e6tn2kbxPY_0__1",
        taskType: "HTTP",
        taskDefName: "get_forecast",
        inputData: {
          http_request: { uri: "https://example.com/forecast", method: "GET" },
          _agent_tool_name: "get_forecast",
        },
        outputData: { response: { body: { temp: 21 } } },
      }),
    ]);

    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("get_forecast");
    expect(calls[0].result).toEqual({ response: { body: { temp: 21 } } });
  });

  it("names an MCP tool after the tool, not `call_mcp_tool`", () => {
    const calls = extract([
      toolTask({
        referenceTaskName: "call_abc_0__1",
        taskType: "CALL_MCP_TOOL",
        taskDefName: "call_mcp_tool",
        inputData: {
          mcpServer: "files",
          method: "read_file",
          arguments: { path: "/tmp/a" },
          _agent_tool_name: "read_file",
        },
      }),
    ]);

    expect(calls.map((c) => c.name)).toEqual(["read_file"]);
  });

  it("names a human tool after the tool, not `human`", () => {
    const calls = extract([
      toolTask({
        referenceTaskName: "call_abc_0__1",
        taskType: "HUMAN",
        taskDefName: "ask_question",
        inputData: {
          __humanTaskDefinition: { displayName: "ask_question" },
          _agent_tool_name: "ask_question",
        },
      }),
    ]);

    expect(calls.map((c) => c.name)).toEqual(["ask_question"]);
  });

  it("preserves the tool name verbatim rather than case-folding it", () => {
    const calls = extract([
      toolTask({
        referenceTaskName: "call_abc_0__1",
        taskType: "getWeather",
        taskDefName: "getWeather",
        inputData: { city: "Lisbon", _agent_state: {}, _agent_tool_name: "getWeather" },
      }),
    ]);

    expect(calls.map((c) => c.name)).toEqual(["getWeather"]);
  });
});

describe("_extractToolCalls — which tasks count", () => {
  // The sub-workflow mapper leaves an agent tool's marker inside workflowInput.
  it("includes an agent invoked as a tool (SUB_WORKFLOW)", () => {
    const calls = extract([
      toolTask({
        referenceTaskName: "call_abc_0__1",
        taskType: "SUB_WORKFLOW",
        taskDefName: "billing_agent",
        inputData: {
          subWorkflowName: "billing_agent",
          workflowInput: { prompt: "refund status", _agent_tool_name: "billing_agent" },
        },
        outputData: { result: "refunded" },
      }),
    ]);

    expect(calls.map((c) => c.name)).toEqual(["billing_agent"]);
    expect(calls[0].result).toEqual({ result: "refunded" });
  });

  it("includes an agent tool whatever the tool-call id format", () => {
    const calls = extract([
      toolTask({
        referenceTaskName: "toolu_01A9EqMxQGxL_2__1",
        taskType: "SUB_WORKFLOW",
        taskDefName: "billing_agent",
        inputData: {
          subWorkflowName: "billing_agent",
          workflowInput: { prompt: "refund status", _agent_tool_name: "billing_agent" },
        },
      }),
    ]);

    expect(calls.map((c) => c.name)).toEqual(["billing_agent"]);
  });

  // A handoff is also SUB_WORKFLOW; the missing marker is all that separates them.
  it("excludes a handoff, which is a SUB_WORKFLOW carrying no marker", () => {
    const calls = extract([
      toolTask({
        referenceTaskName: "support_handoff_0_billing_agent__1",
        taskType: "SUB_WORKFLOW",
        taskDefName: "billing_agent",
        inputData: {
          subWorkflowName: "billing_agent",
          workflowInput: { prompt: "refund status", session_id: "s1" },
        },
      }),
      toolTask({
        referenceTaskName: "support_router__1",
        taskType: "SUB_WORKFLOW",
        taskDefName: "support_router",
        inputData: { subWorkflowName: "support_router", workflowInput: { prompt: "hi" } },
      }),
    ]);

    expect(calls).toEqual([]);
  });

  it("detects tools behind a non-OpenAI tool-call id format", () => {
    const calls = extract([
      toolTask({
        referenceTaskName: "toolu_01A9EqMxQGxL_0__1",
        taskType: "SIMPLE",
        taskDefName: "lookup",
        inputData: { q: "hello", _agent_tool_name: "lookup" },
      }),
      toolTask({
        referenceTaskName: "5f2c0d9e-2a0e-4c1f-9a3f-1f6d2f0b0c11_0__1",
        taskType: "HTTP",
        taskDefName: "fetch_page",
        inputData: { http_request: { uri: "https://example.com" }, _agent_tool_name: "fetch_page" },
      }),
    ]);

    expect(calls.map((c) => c.name)).toEqual(["lookup", "fetch_page"]);
  });

  it("excludes orchestration tasks", () => {
    const orchestration = [
      "LLM_CHAT_COMPLETE",
      "SWITCH",
      "DO_WHILE",
      "INLINE",
      "SET_VARIABLE",
      "FORK",
      "FORK_JOIN_DYNAMIC",
      "JOIN",
    ].map((taskType, i) =>
      toolTask({
        referenceTaskName: `call_orchestration_${i}`,
        taskType,
        inputData: { _agent_tool_name: "should_not_matter" },
      }),
    );

    expect(extract(orchestration)).toEqual([]);
  });

  it("returns an empty list when the execution has no tasks", () => {
    expect(_extractToolCalls({})).toEqual([]);
    expect(_extractToolCalls({ tasks: [] })).toEqual([]);
  });
});

describe("_extractToolCalls — arguments", () => {
  it("strips internal keys from the reported arguments", () => {
    const calls = extract([
      toolTask({
        referenceTaskName: "call_abc_0__1",
        taskType: "SIMPLE",
        taskDefName: "lookup",
        inputData: {
          q: "hello",
          _agent_state: { messages: [] },
          _agent_tool_name: "lookup",
          method: "lookup",
          __humanTaskDefinition: {},
        },
      }),
    ]);

    expect(calls[0].args).toEqual({ q: "hello" });
  });

  it("leaves the execution's own task input untouched", () => {
    const task = toolTask({
      referenceTaskName: "call_abc_0__1",
      taskType: "SIMPLE",
      taskDefName: "lookup",
      inputData: { q: "hello", _agent_tool_name: "lookup" },
    });

    extract([task]);

    expect(task.inputData).toEqual({ q: "hello", _agent_tool_name: "lookup" });
  });

  it("reads snake_case task fields", () => {
    const calls = extract([
      {
        reference_task_name: "call_abc_0__1",
        task_type: "SIMPLE",
        input_data: { q: "hello", _agent_tool_name: "lookup" },
        output_data: { result: "hi" },
      },
    ]);

    expect(calls).toEqual([{ name: "lookup", args: { q: "hello" }, result: { result: "hi" } }]);
  });
});

describe("_extractToolCalls — tools the dispatch script left unmarked", () => {
  it("falls back to the task definition name for an unmarked tool task", () => {
    const calls = extract([
      toolTask({
        referenceTaskName: "call_PMnNIdOPvm9EQ8e6tn2kbxPY_0__1",
        taskType: "SIMPLE",
        taskDefName: "getWeather",
        inputData: { city: "Lisbon" },
      }),
    ]);

    expect(calls.map((c) => c.name)).toEqual(["getWeather"]);
  });

  it("names an unmarked MCP tool from `method`, whatever the tool-call id format", () => {
    const calls = extract([
      toolTask({
        referenceTaskName: "toolu_01A9EqMxQGxL_0__1",
        taskType: "CALL_MCP_TOOL",
        taskDefName: "call_mcp_tool",
        inputData: { mcpServer: "files", method: "read_file", arguments: { path: "/tmp/a" } },
      }),
    ]);

    expect(calls).toEqual([
      {
        name: "read_file",
        args: { mcpServer: "files", arguments: { path: "/tmp/a" } },
        result: {},
      },
    ]);
  });

  it("detects an unmarked HTTP tool, whatever the tool-call id format", () => {
    const calls = extract([
      toolTask({
        referenceTaskName: "toolu_01A9EqMxQGxL_0__1",
        taskType: "HTTP",
        taskDefName: "get_forecast",
        inputData: { http_request: { uri: "https://example.com/forecast" } },
      }),
    ]);

    expect(calls.map((c) => c.name)).toEqual(["get_forecast"]);
  });

  it("does not read `method` off a worker tool that happens to take one", () => {
    const calls = extract([
      toolTask({
        referenceTaskName: "call_abc_0__1",
        taskType: "SIMPLE",
        taskDefName: "sendRequest",
        inputData: { method: "POST", url: "https://example.com" },
      }),
    ]);

    expect(calls.map((c) => c.name)).toEqual(["sendRequest"]);
  });

  it("ignores unmarked tasks of a type the agent compiler also emits itself", () => {
    const calls = extract([
      toolTask({
        referenceTaskName: "myagent_guardrail_check",
        taskType: "SIMPLE",
        taskDefName: "guardrail_worker",
        inputData: { q: "hello" },
      }),
      toolTask({
        referenceTaskName: "myagent_approval",
        taskType: "HUMAN",
        taskDefName: "approval",
        inputData: {},
      }),
      toolTask({
        referenceTaskName: "myagent_handoff",
        taskType: "SUB_WORKFLOW",
        taskDefName: "billing_agent_workflow",
        inputData: { prompt: "hi" },
      }),
    ]);

    expect(calls).toEqual([]);
  });
});

// GET /agent/execution/{id} returns no inputData and no taskDefName, so no
// declared name reaches the SDK. These pin how far extraction gets on that shape.
describe("_extractToolCalls — the trimmed shape run() receives", () => {
  const trimmed = (referenceTaskName: string, taskType: string) => ({
    referenceTaskName,
    taskType,
    status: "COMPLETED",
    outputData: { result: "ok" },
  });

  it("names a worker tool from its task type, which is the tool's own name", () => {
    const calls = extract([trimmed("call_9852jJV2Kzyae3MCDGHPeyXa__1", "getWeather")]);

    expect(calls.map((c) => c.name)).toEqual(["getWeather"]);
  });

  it("cannot recover a tool name for a transport-typed task, and does not fold its case", () => {
    const calls = extract([
      trimmed("call_mMLCQyj7CID3cjRLhvZNYV5p__1", "CALL_MCP_TOOL"),
      trimmed("call_vlC3GlsOMbCG9F8UD1iAyYov_1__1", "HTTP"),
    ]);

    expect(calls.map((c) => c.name)).toEqual(["CALL_MCP_TOOL", "HTTP"]);
  });
});
