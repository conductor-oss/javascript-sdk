/**
 * Suite 11: LangGraph Cross-SDK Parity Tests — serialization and compilation.
 *
 * Tests that LangGraph graphs serialize correctly into Agentspan workflows:
 *   - Full extraction: createReactAgent → model + tools in rawConfig
 *   - Graph-structure: StateGraph → nodes + edges in rawConfig._graph
 *   - Tool extraction: tools have correct names, descriptions, schemas
 *   - Conditional routing: conditional_edges in rawConfig._graph
 *   - Messages state: _input_is_messages flag detection
 *   - Passthrough fallback: plain graph → single worker
 *   - Compile via server: /agent/compile returns 200
 *   - Runtime execution: agent with tool produces correct output
 *
 * Uses serializeLangGraph() directly for compilation tests (no server needed).
 * Uses runtime.run() for the single execution test.
 *
 * All validation is algorithmic — structure assertions on serialized output.
 * Requires: @langchain/langgraph, @langchain/openai, @langchain/core
 * Skips if not installed.
 */

import { describe, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { AgentRuntime } from '@io-orkes/conductor-javascript/agents';
import { checkServerHealth, itSkipIf, expectMsg } from './helpers';


jest.setTimeout(300_000); // ported from vitest describe({ timeout }) options
// ── Dynamic imports (skip if LangGraph not installed) ───────────────────

let langGraphAvailable = false;
let createReactAgent: any;
let ChatOpenAI: any;
let DynamicStructuredTool: any;
let StateGraph: any;
let START: any;
let END: any;
let Annotation: any;
let _MessagesAnnotation: any;
let z: any;
let serializeLangGraph: any;
let detectFramework: any;

const SERVER_URL = process.env.AGENTSPAN_SERVER_URL ?? 'http://localhost:8080/api';
const BASE_URL = SERVER_URL.replace(/\/api$/, '');

try {
  // Synchronous require instead of upstream top-level await import — this file
  // compiles to CJS under ts-jest, where top-level await is illegal.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const lgPrebuilt = require('@langchain/langgraph/prebuilt');
  createReactAgent = lgPrebuilt.createReactAgent;
  const lgCore = require('@langchain/langgraph');
  StateGraph = lgCore.StateGraph;
  START = lgCore.START;
  END = lgCore.END;
  Annotation = lgCore.Annotation;
  _MessagesAnnotation = lgCore.MessagesAnnotation;
  const openai = require('@langchain/openai');
  ChatOpenAI = openai.ChatOpenAI;
  const tools = require('@langchain/core/tools');
  DynamicStructuredTool = tools.DynamicStructuredTool;
  const zod = require('zod');
  z = zod.z;
  // Import the serializer directly for plan-only tests
  const lgSerializer = require('../src/agents/frameworks/langgraph-serializer');
  serializeLangGraph = lgSerializer.serializeLangGraph;
  const detect = require('../src/agents/frameworks/detect');
  detectFramework = detect.detectFramework;
  /* eslint-enable @typescript-eslint/no-require-imports */
  langGraphAvailable = true;
} catch {
  // LangGraph packages not installed — tests will be skipped
}

// ── Helpers ─────────────────────────────────────────────────────────────

let runtime: AgentRuntime;

let serverAvailable = false;

beforeAll(async () => {
  if (!langGraphAvailable) return;
  serverAvailable = await checkServerHealth();
  if (serverAvailable) {
    runtime = new AgentRuntime();
  }
});

afterAll(async () => {
  if (runtime) await runtime.shutdown();
});

// ── Tests ───────────────────────────────────────────────────────────────

describe('Suite 11: LangGraph Integration', () => {

  // ── 1. Framework detection ──────────────────────────────────────────

  itSkipIf(!langGraphAvailable)('framework detection identifies langgraph', () => {
    const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 });
    const graph = createReactAgent({ llm, tools: [], name: 'detect_test' });

    const framework = detectFramework(graph);
    expectMsg(framework, 'detectFramework should return langgraph').toBe('langgraph');
  });

  // ── 2. Full extraction: ReAct agent with tools ──────────────────────

  itSkipIf(!langGraphAvailable)('full extraction — react agent with 3 tools', () => {
    const calculateTool = new DynamicStructuredTool({
      name: 'calculate',
      description: 'Evaluate a mathematical expression.',
      schema: z.object({ expression: z.string() }),
      func: async ({ expression }: { expression: string }) => String(eval(expression)),
    });

    const countWordsTool = new DynamicStructuredTool({
      name: 'count_words',
      description: 'Count words in text.',
      schema: z.object({ text: z.string() }),
      func: async ({ text }: { text: string }) => `${text.split(/\s+/).length} words`,
    });

    const reverseTool = new DynamicStructuredTool({
      name: 'reverse_text',
      description: 'Reverse a string.',
      schema: z.object({ text: z.string() }),
      func: async ({ text }: { text: string }) => text.split('').reverse().join(''),
    });

    const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 });
    const graph = createReactAgent({
      llm,
      tools: [calculateTool, countWordsTool, reverseTool],
      name: 'e2e_lg_react',
    });

    (graph as any)._agentspan = {
      model: 'anthropic/claude-sonnet-4-6',
      tools: [calculateTool, countWordsTool, reverseTool],
      framework: 'langgraph',
    };

    const [rawConfig, workers] = serializeLangGraph(graph);

    // Must be full extraction path (has model + tools)
    expectMsg(rawConfig.model, '[FullExtract] model missing from rawConfig').toBeDefined();
    expectMsg(
      String(rawConfig.model),
      '[FullExtract] wrong model',
    ).toContain('gpt-4o-mini');

    // Tools must be present with correct names
    const toolsList = rawConfig.tools as Record<string, unknown>[];
    expectMsg(toolsList, '[FullExtract] tools missing').toBeDefined();
    expectMsg(toolsList.length, '[FullExtract] expected 3 tools').toBe(3);

    const toolNames = toolsList.map((t) => t.name ?? t._worker_ref);
    expectMsg(toolNames, '[FullExtract] calculate missing').toContain('calculate');
    expectMsg(toolNames, '[FullExtract] count_words missing').toContain('count_words');
    expectMsg(toolNames, '[FullExtract] reverse_text missing').toContain('reverse_text');

    // Each tool should have description
    for (const t of toolsList) {
      expectMsg(t.description, `[FullExtract] tool ${t.name ?? t._worker_ref} missing description`).toBeTruthy();
    }

    // Workers should be extracted for each tool
    expectMsg(workers.length, '[FullExtract] expected workers for tools').toBeGreaterThanOrEqual(3);
  });

  // ── 3. Tool schema extraction ───────────────────────────────────────

  itSkipIf(!langGraphAvailable)('tool schemas have correct parameters', () => {
    const multiplyTool = new DynamicStructuredTool({
      name: 'multiply',
      description: 'Multiply two numbers.',
      schema: z.object({
        a: z.number().describe('First number'),
        b: z.number().describe('Second number'),
      }),
      func: async ({ a, b }: { a: number; b: number }) => String(a * b),
    });

    const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 });
    const graph = createReactAgent({ llm, tools: [multiplyTool], name: 'e2e_lg_schema' });

    (graph as any)._agentspan = {
      model: 'anthropic/claude-sonnet-4-6',
      tools: [multiplyTool],
      framework: 'langgraph',
    };

    const [rawConfig] = serializeLangGraph(graph);
    const toolsList = rawConfig.tools as Record<string, unknown>[];
    expect(toolsList.length).toBeGreaterThanOrEqual(1);

    const multiply = toolsList.find((t) => (t.name ?? t._worker_ref) === 'multiply');
    expectMsg(multiply, '[Schema] multiply tool not found').toBeDefined();
    expect(multiply!.description).toBe('Multiply two numbers.');

    // Parameters MUST be valid JSON Schema, NOT a raw Zod object.
    // The server expects {type: "object", properties: {a: ..., b: ...}}.
    const params = (multiply!.parameters ?? multiply!.inputSchema) as Record<string, unknown>;
    expectMsg(params, '[Schema] no parameters on multiply tool').toBeDefined();

    // Must be JSON Schema (has "type" and "properties"), not Zod internal (_def, typeName)
    expectMsg(
      params.type,
      `[Schema] parameters.type missing — got raw Zod object instead of JSON Schema. ` +
      `Keys: ${Object.keys(params)}`,
    ).toBe('object');
    expectMsg(
      params.properties,
      '[Schema] parameters.properties missing — not a valid JSON Schema',
    ).toBeDefined();

    const props = params.properties as Record<string, unknown>;
    expectMsg(props.a, '[Schema] missing property "a" in JSON Schema').toBeDefined();
    expectMsg(props.b, '[Schema] missing property "b" in JSON Schema').toBeDefined();
  });

  // ── 4. Graph-structure: StateGraph nodes + edges ────────────────────

  itSkipIf(!langGraphAvailable)('stategraph — 3 nodes and edges extracted', () => {
    const QueryState = Annotation.Root({
      query: Annotation<string>({
        reducer: (_prev: string, next: string) => next ?? _prev,
        default: () => '',
      }),
      output: Annotation<string>({
        reducer: (_prev: string, next: string) => next ?? _prev,
        default: () => '',
      }),
    });

    function validate(state: any) { return { query: (state.query || '').trim() || 'default' }; }
    function process(state: any) { return { query: `processed:${state.query}` }; }
    function format(state: any) { return { output: `result:${state.query}` }; }

    const builder = new StateGraph(QueryState);
    builder.addNode('validate', validate);
    builder.addNode('process', process);
    builder.addNode('format', format);
    builder.addEdge(START, 'validate');
    builder.addEdge('validate', 'process');
    builder.addEdge('process', 'format');
    builder.addEdge('format', END);

    const graph = builder.compile({ name: 'e2e_lg_sg' });

    const [rawConfig, workers] = serializeLangGraph(graph);
    const configStr = JSON.stringify(rawConfig);

    // Graph-structure path should extract nodes
    // Check _graph.nodes if present, or check workers reference node names
    const graphData = rawConfig._graph as Record<string, unknown> | undefined;

    if (graphData) {
      // Graph-structure extraction succeeded
      const nodes = graphData.nodes as Record<string, unknown>[];
      expectMsg(nodes, '[StateGraph] _graph.nodes missing').toBeDefined();
      expectMsg(nodes.length, '[StateGraph] expected 3 nodes').toBeGreaterThanOrEqual(3);

      const nodeNames = nodes.map((n) => n.name as string);
      expectMsg(nodeNames, '[StateGraph] validate missing').toContain('validate');
      expectMsg(nodeNames, '[StateGraph] process missing').toContain('process');
      expectMsg(nodeNames, '[StateGraph] format missing').toContain('format');

      // Edges should connect them
      const edges = graphData.edges as Record<string, unknown>[] | undefined;
      if (edges) {
        expectMsg(edges.length, '[StateGraph] expected edges').toBeGreaterThanOrEqual(3);
      }
    } else {
      // Passthrough or full extraction fallback — nodes should still be referenced
      // Check that worker names contain node references
      const workerNames = workers.map((w) => w.name);
      expectMsg(
        workerNames.some((n) => n.includes('validate')) ||
        configStr.includes('validate'),
        '[StateGraph] validate not found in config or workers',
      ).toBe(true);
    }
  });

  // ── 5. Passthrough fallback ─────────────────────────────────────────

  itSkipIf(!langGraphAvailable)('graph without metadata falls to passthrough', () => {
    const SimpleState = Annotation.Root({
      value: Annotation<string>({
        reducer: (_prev: string, next: string) => next ?? _prev,
        default: () => '',
      }),
    });

    const builder = new StateGraph(SimpleState);
    builder.addNode('echo', (state: any) => ({ value: `echo:${state.value}` }));
    builder.addEdge(START, 'echo');
    builder.addEdge('echo', END);

    const graph = builder.compile({ name: 'e2e_lg_passthrough' });
    // No _agentspan metadata → should fall to passthrough

    const [rawConfig, workers] = serializeLangGraph(graph);

    // Passthrough: should have _worker_name
    expectMsg(
      rawConfig._worker_name ?? rawConfig.name,
      '[Passthrough] no worker name or graph name',
    ).toBeDefined();

    // Should have exactly 1 worker (the passthrough worker)
    expectMsg(workers.length, '[Passthrough] expected 1 passthrough worker').toBe(1);
  });

  // ── 6. Conditional routing — conditional_edges in rawConfig ──────────

  itSkipIf(!langGraphAvailable)('conditional routing — conditional_edges extracted', () => {
    const RouteState = Annotation.Root({
      query: Annotation<string>({
        reducer: (_prev: string, next: string) => next ?? _prev,
        default: () => '',
      }),
      category: Annotation<string>({
        reducer: (_prev: string, next: string) => next ?? _prev,
        default: () => '',
      }),
      answer: Annotation<string>({
        reducer: (_prev: string, next: string) => next ?? _prev,
        default: () => '',
      }),
    });

    function classify(state: any) {
      const q = (state.query || '').toLowerCase();
      return { category: q.includes('math') ? 'math' : 'general' };
    }

    function routeQuery(state: any): string {
      return state.category || 'general';
    }

    function handleMath(_state: any) {
      return { answer: 'math_answer' };
    }

    function handleGeneral(_state: any) {
      return { answer: 'general_answer' };
    }

    const builder = new StateGraph(RouteState);
    builder.addNode('classify', classify);
    builder.addNode('handle_math', handleMath);
    builder.addNode('handle_general', handleGeneral);

    builder.addEdge(START, 'classify');
    builder.addConditionalEdges(
      'classify',
      routeQuery,
      { math: 'handle_math', general: 'handle_general' },
    );
    builder.addEdge('handle_math', END);
    builder.addEdge('handle_general', END);

    const graph = builder.compile({ name: 'e2e_lg_conditional' });

    const [rawConfig] = serializeLangGraph(graph);

    // Must be graph-structure path
    expectMsg(
      rawConfig._graph,
      '[Conditional] _graph missing from rawConfig',
    ).toBeDefined();

    const graphData = rawConfig._graph as Record<string, unknown>;

    // conditional_edges must be non-empty
    const condEdges = graphData.conditional_edges as Record<string, unknown>[];
    expectMsg(condEdges, '[Conditional] conditional_edges missing').toBeDefined();
    expectMsg(
      condEdges.length,
      '[Conditional] conditional_edges should be non-empty',
    ).toBeGreaterThan(0);

    // First conditional edge must have _router_ref
    const ce = condEdges[0];
    expectMsg(
      ce._router_ref,
      `[Conditional] conditional_edges[0] missing _router_ref. Keys: ${Object.keys(ce)}`,
    ).toBeDefined();

    // Source should be "classify"
    expectMsg(
      ce.source,
      `[Conditional] Expected source='classify', got '${ce.source}'`,
    ).toBe('classify');

    // Targets should map to handle_math and handle_general
    const targets = ce.targets as Record<string, string>;
    expectMsg(targets, '[Conditional] targets missing').toBeDefined();
    expectMsg(targets.math, '[Conditional] math target missing').toBeDefined();
    expectMsg(targets.general, '[Conditional] general target missing').toBeDefined();
  });

  // ── 7. Messages state detection — _input_is_messages flag ──────────

  itSkipIf(!langGraphAvailable)('messages state detected — _input_is_messages flag', () => {
    // Use MessagesAnnotation which defines a "messages" field with an add reducer.
    // This is the standard LangGraph pattern for chat-based agents.
    const MessagesState = Annotation.Root({
      messages: Annotation<Record<string, unknown>[]>({
        reducer: (prev: Record<string, unknown>[], next: Record<string, unknown>[]) => [...prev, ...next],
        default: () => [],
      }),
      output: Annotation<string>({
        reducer: (_prev: string, next: string) => next ?? _prev,
        default: () => '',
      }),
    });

    function processMessages(_state: any) {
      return { output: 'processed' };
    }

    const builder = new StateGraph(MessagesState);
    builder.addNode('process', processMessages);
    builder.addEdge(START, 'process');
    builder.addEdge('process', END);

    const graph = builder.compile({ name: 'e2e_lg_messages' });

    const [rawConfig] = serializeLangGraph(graph);

    // Must be graph-structure path
    expectMsg(rawConfig._graph, '[Messages] _graph missing').toBeDefined();

    const graphData = rawConfig._graph as Record<string, unknown>;

    // _input_is_messages must be true
    expectMsg(
      graphData._input_is_messages,
      `[Messages] _input_is_messages should be true. ` +
      `Graph keys: ${Object.keys(graphData)}. ` +
      `Got: ${graphData._input_is_messages}`,
    ).toBe(true);
  });

  // ── 8. Compile via server — /agent/compile returns 200 ─────────────

  itSkipIf(!langGraphAvailable)('compile hello_world via server', async () => {
    if (!serverAvailable) {
      console.log('Server not available — skipping compile test');
      return;
    }

    const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 });
    const graph = createReactAgent({ llm, tools: [], name: 'compile_hello_world' });

    (graph as any)._agentspan = {
      model: 'anthropic/claude-sonnet-4-6',
      tools: [],
      framework: 'langgraph',
    };

    const [rawConfig] = serializeLangGraph(graph);

    const resp = await fetch(`${BASE_URL}/api/agent/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ framework: 'langgraph', rawConfig }),
      signal: AbortSignal.timeout(30_000),
    });

    const body = await resp.text();
    expectMsg(
      resp.status,
      `[Compile hello_world] Expected 200, got ${resp.status}. Body: ${body.slice(0, 500)}`,
    ).toBe(200);
  });

  itSkipIf(!langGraphAvailable)('compile react_with_tools via server', async () => {
    if (!serverAvailable) {
      console.log('Server not available — skipping compile test');
      return;
    }

    const calculateTool = new DynamicStructuredTool({
      name: 'calculate',
      description: 'Evaluate a mathematical expression.',
      schema: z.object({ expression: z.string() }),
      func: async ({ expression }: { expression: string }) => String(eval(expression)),
    });

    const countWordsTool = new DynamicStructuredTool({
      name: 'count_words',
      description: 'Count words in text.',
      schema: z.object({ text: z.string() }),
      func: async ({ text }: { text: string }) => `${text.split(/\s+/).length} words`,
    });

    const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 });
    const graph = createReactAgent({
      llm,
      tools: [calculateTool, countWordsTool],
      name: 'compile_react_tools',
    });

    (graph as any)._agentspan = {
      model: 'anthropic/claude-sonnet-4-6',
      tools: [calculateTool, countWordsTool],
      framework: 'langgraph',
    };

    const [rawConfig] = serializeLangGraph(graph);

    const resp = await fetch(`${BASE_URL}/api/agent/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ framework: 'langgraph', rawConfig }),
      signal: AbortSignal.timeout(30_000),
    });

    const body = await resp.text();
    expectMsg(
      resp.status,
      `[Compile react_tools] Expected 200, got ${resp.status}. Body: ${body.slice(0, 500)}`,
    ).toBe(200);
  });

  itSkipIf(!langGraphAvailable)('compile stategraph via server', async () => {
    if (!serverAvailable) {
      console.log('Server not available — skipping compile test');
      return;
    }

    // Note: TS LangGraph forbids node names matching state field names.
    // Use 'result' for state field so node can be 'answer'.
    const QueryState = Annotation.Root({
      query: Annotation<string>({
        reducer: (_prev: string, next: string) => next ?? _prev,
        default: () => '',
      }),
      result: Annotation<string>({
        reducer: (_prev: string, next: string) => next ?? _prev,
        default: () => '',
      }),
    });

    function validateQ(state: any) { return { query: (state.query || '').trim() || 'default' }; }
    function answerQ(state: any) { return { result: `answer_for:${state.query}` }; }

    const builder = new StateGraph(QueryState);
    builder.addNode('validate', validateQ);
    builder.addNode('answer', answerQ);
    builder.addEdge(START, 'validate');
    builder.addEdge('validate', 'answer');
    builder.addEdge('answer', END);

    const graph = builder.compile({ name: 'compile_stategraph' });

    const [rawConfig] = serializeLangGraph(graph);

    const resp = await fetch(`${BASE_URL}/api/agent/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ framework: 'langgraph', rawConfig }),
      signal: AbortSignal.timeout(30_000),
    });

    const body = await resp.text();
    expectMsg(
      resp.status,
      `[Compile stategraph] Expected 200, got ${resp.status}. Body: ${body.slice(0, 500)}`,
    ).toBe(200);
  });

  // ── 9. Runtime execution: tool produces deterministic output ────────

  itSkipIf(!langGraphAvailable || !process.env.OPENAI_API_KEY)('runtime execution — multiply tool returns 56', async () => {
    if (!serverAvailable) {
      console.log('Server not available — skipping runtime test');
      return;
    }

    const multiplyTool = new DynamicStructuredTool({
      name: 'multiply',
      description: 'Multiply two numbers and return the product.',
      schema: z.object({
        a: z.number().describe('First number'),
        b: z.number().describe('Second number'),
      }),
      func: async ({ a, b }: { a: number; b: number }) => String(a * b),
    });

    const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 });
    const graph = createReactAgent({
      llm,
      tools: [multiplyTool],
      name: 'e2e_lg_runtime',
    });

    (graph as any)._agentspan = {
      model: 'anthropic/claude-sonnet-4-6',
      tools: [multiplyTool],
      framework: 'langgraph',
    };

    const result = await runtime.run(graph, 'Multiply 7 by 8', { timeout: 120_000 });

    expectMsg(result.executionId, '[Runtime] no executionId').toBeTruthy();
    expectMsg(result.status, '[Runtime] not COMPLETED').toBe('COMPLETED');

    // Check output contains "56" (7*8=56) — deterministic tool output
    const outputStr = JSON.stringify(result.output);
    expectMsg(
      outputStr.includes('56'),
      `[Runtime] output should contain "56". output=${outputStr.slice(0, 300)}`,
    ).toBe(true);
  });
});
