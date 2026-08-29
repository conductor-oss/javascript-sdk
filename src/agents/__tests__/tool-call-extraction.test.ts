/**
 * `result.toolCalls` extraction.
 *
 * The task shapes below mirror what the server's tool-dispatch script emits for
 * each tool kind: a per-call reference name built from the provider's tool-call
 * id, a task type that varies by kind (`HTTP`, `CALL_MCP_TOOL`, `SUB_WORKFLOW`,
 * `HUMAN`, `SIMPLE`), and an `_agent_tool_name` marker carrying the tool's
 * declared name on every dispatched tool.
 */

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
  it("includes an agent invoked as a tool (SUB_WORKFLOW)", () => {
    const calls = extract([
      toolTask({
        referenceTaskName: "call_abc_0__1",
        taskType: "SUB_WORKFLOW",
        taskDefName: "billing_agent_workflow",
        inputData: { prompt: "refund status", _agent_tool_name: "billing_agent" },
        outputData: { result: "refunded" },
      }),
    ]);

    expect(calls).toEqual([
      { name: "billing_agent", args: { prompt: "refund status" }, result: { result: "refunded" } },
    ]);
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

describe("_extractToolCalls — servers older than the dispatch marker", () => {
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

  it("ignores unmarked tasks that carry no tool-call reference name", () => {
    const calls = extract([
      toolTask({
        referenceTaskName: "prefill_lookup",
        taskType: "SIMPLE",
        taskDefName: "lookup",
        inputData: { q: "hello" },
      }),
    ]);

    expect(calls).toEqual([]);
  });
});
