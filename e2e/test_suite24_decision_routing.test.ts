/**
 * Suite 24: Jev decision routing — decision-backed SWITCH, decision router, decision tool.
 *
 * The server must route decision inference to the deterministic fake in
 * e2e/fixtures/fake-providers.mjs:
 *
 *   node e2e/fixtures/fake-providers.mjs &
 *   java -jar conductor-server-boot.jar \
 *     --conductor.ai.decision.endpoint=http://localhost:9911/v1/systemone \
 *     --conductor.ai.decision.api-key=fake-key
 *
 * The fake picks the choice whose key or description shares a word stem with
 * the state, so every routing assertion is exact. Chat steps (router children,
 * the decision-tool agent) use the configured LLM; their text is not asserted.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { Agent, AgentRuntime } from '@io-orkes/conductor-javascript/agents';
import type { ToolDef } from '@io-orkes/conductor-javascript/agents';
import { ConductorWorkflow, OrkesClients, inlineTask, switchTask } from '../src/sdk';
import type { WorkflowExecutor } from '../src/sdk';
import type { Workflow } from '../src/open-api';
import { checkServerHealth, MODEL, TIMEOUT, getWorkflow, expectMsg } from './helpers';

jest.setTimeout(900_000);

const SUFFIX = Date.now();
const QUESTION = {
  type: 'choice',
  instructions: 'Choose the team best suited to handle this request.',
  choices: {
    billing: 'Payments, invoices, refunds, or subscriptions.',
    technical: 'Errors, outages, or product troubleshooting.',
  },
};
const BILLING_REQUEST = 'I was charged twice on my latest invoice.';
const TECHNICAL_REQUEST = 'The product crashes with an error on startup.';

type Task = NonNullable<Workflow['tasks']>[number];
type Def = Record<string, unknown>;

let runtime: AgentRuntime;
let executor: WorkflowExecutor;

beforeAll(async () => {
  if (!(await checkServerHealth())) throw new Error('Server not available');
  runtime = new AgentRuntime();
  executor = (await OrkesClients.from()).getWorkflowClient();
});

afterAll(async () => {
  await runtime?.shutdown();
});

function routingWorkflow(name: string, provider?: string) {
  const billing = inlineTask('handle_billing', '({team: "billing"})');
  const technical = inlineTask('handle_technical', '({team: "technical"})');
  const decision = switchTask('route_request', 'route', { billing: [billing], technical: [technical] }, [], undefined, 'decision');
  decision.inputParameters = {
    model: 'jev-1.13',
    ...(provider !== undefined && { provider }),
    state: '${workflow.input.request}',
    questions: { route: QUESTION },
  };
  return new ConductorWorkflow(executor, name, 1)
    .add([decision])
    .outputParameters({ selectedCase: '${route_request.output.selectedCase}' });
}

async function runToTerminal(id: string): Promise<Workflow> {
  const deadline = Date.now() + 120_000;
  for (;;) {
    const wf = await executor.getWorkflow(id, true);
    if (['COMPLETED', 'FAILED', 'TIMED_OUT', 'TERMINATED'].includes(wf.status ?? '')) return wf;
    if (Date.now() > deadline) throw new Error(`workflow ${id} still ${wf.status}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

function collectTasks(tasks: unknown, out: Def[] = []): Def[] {
  for (const t of (tasks as Def[] | undefined) ?? []) {
    out.push(t);
    collectTasks(t.loopOver, out);
    collectTasks(t.defaultCase, out);
    for (const branch of Object.values((t.decisionCases as Record<string, unknown>) ?? {})) collectTasks(branch, out);
    for (const fork of (t.forkTasks as unknown[][] | undefined) ?? []) collectTasks(fork, out);
  }
  return out;
}

function decisionRouterAgent(name: string, provider?: string) {
  const billingName = `billing_${SUFFIX}`;
  const technicalName = `technical_${SUFFIX}`;
  const selector: ToolDef = {
    name: `selector_${SUFFIX}`,
    description: 'Choose the support agent.',
    toolType: 'decision',
    inputSchema: { type: 'object', properties: {} },
    config: {
      model: 'jev-1.13',
      ...(provider !== undefined && { provider }),
      questions: {
        agent: {
          type: 'choice',
          instructions: 'Choose the right support team.',
          choices: { [billingName]: 'Payments and invoices', [technicalName]: 'Product errors and troubleshooting' },
        },
      },
    },
  };
  const agent = new Agent({
    name,
    strategy: 'router',
    router: selector,
    agents: [
      new Agent({ name: billingName, model: MODEL, instructions: 'Answer billing questions in one sentence.' }),
      new Agent({ name: technicalName, model: MODEL, instructions: 'Answer technical questions in one sentence.' }),
    ],
    maxTurns: 1,
    synthesize: false,
  });
  return { agent, billingName, technicalName };
}

// ── Traditional workflow: decision-backed SWITCH ──────────────────────

describe('Suite 24: decision-backed SWITCH', () => {
  const name = `jssdk_e2e_decision_switch_${SUFFIX}`;

  beforeAll(async () => {
    await routingWorkflow(name).register(true);
  });

  it.each([
    ['billing', BILLING_REQUEST, 'handle_billing', 'handle_technical'],
    ['technical', TECHNICAL_REQUEST, 'handle_technical', 'handle_billing'],
  ])('routes to %s and runs only that branch', async (expected, request, ran, skipped) => {
    const id = await executor.startWorkflow({ name, version: 1, input: { request } });
    const wf = await runToTerminal(id);
    expectMsg(wf.status, `workflow ${id}: ${wf.reasonForIncompletion}`).toBe('COMPLETED');
    expect(wf.output?.selectedCase).toBe(expected);

    const refs = (wf.tasks ?? []).map((t: Task) => t.referenceTaskName);
    expect(refs).toContain(ran);
    expect(refs).not.toContain(skipped);

    const sw = (wf.tasks ?? []).find((t: Task) => t.referenceTaskName === 'route_request');
    expect(sw?.taskType).toBe('SWITCH');
    expect(sw?.outputData).toMatchObject({
      selectedCase: expected,
      model: 'jev-1.13',
      answers: { route: { type: 'choice', choice: expected } },
    });
    expect(typeof sw?.outputData?.latencyMs).toBe('number');
  });

  it('fails the workflow without retrying when the provider is not configured', async () => {
    const failing = `jssdk_e2e_decision_unconfigured_${SUFFIX}`;
    await routingWorkflow(failing, 'unconfigured_provider').register(true);
    const id = await executor.startWorkflow({ name: failing, version: 1, input: { request: BILLING_REQUEST } });
    const wf = await runToTerminal(id);
    expect(wf.status).toBe('FAILED');
    expect(wf.reasonForIncompletion ?? '').toContain('Decision');
    // Exactly one SWITCH attempt, failed, never retried; no branch scheduled.
    const tasks = (wf.tasks ?? []).map((t: Task) => ({
      ref: t.referenceTaskName,
      status: t.status,
      retryCount: t.retryCount,
      retried: t.retried,
    }));
    expect(tasks).toEqual([{ ref: 'route_request', status: 'FAILED', retryCount: 0, retried: false }]);
  });
});

// ── Agent router with a decision ToolDef selector ─────────────────────

describe('Suite 24: decision router agent', () => {
  it('compiles the selector into one decision SWITCH over the child agents', async () => {
    const { agent, billingName, technicalName } = decisionRouterAgent(`jssdk_e2e_decision_router_plan_${SUFFIX}`, 'typesafe');
    const plan = (await runtime.plan(agent)) as { workflowDef?: Def };
    const tasks = collectTasks(plan.workflowDef?.tasks);

    const decisions = tasks.filter((t) => t.type === 'SWITCH' && t.evaluatorType === 'decision');
    expect(decisions).toHaveLength(1);
    const [router] = decisions;
    expect(router.expression).toBe('agent');
    expect(Object.keys(router.decisionCases as Def).sort()).toEqual([billingName, technicalName].sort());
    expect(router.inputParameters).toMatchObject({ model: 'jev-1.13', provider: 'typesafe' });

    // synthesize: false — no parent synthesis LLM step after the specialist.
    const finalRefs = tasks.filter((t) => String(t.taskReferenceName).endsWith('_final'));
    expect(finalRefs).toHaveLength(0);
  });

  it('runs the child agent the decision selects', async () => {
    const { agent, billingName, technicalName } = decisionRouterAgent(`jssdk_e2e_decision_router_${SUFFIX}`);
    const result = await runtime.run(agent, BILLING_REQUEST, { timeoutSeconds: TIMEOUT / 1000 });
    expectMsg(result.status, `${result.executionId}: ${String(result.error)}`).toBe('COMPLETED');

    const wf = (await getWorkflow(result.executionId)) as { tasks?: Def[] };
    const router = (wf.tasks ?? []).find((t) => t.taskType === 'SWITCH' && (t.outputData as Def | undefined)?.selectedCase !== undefined && String(t.referenceTaskName).includes('_router'));
    expect((router?.outputData as Def | undefined)?.selectedCase).toBe(billingName);

    const children = (wf.tasks ?? []).filter((t) => t.taskType === 'SUB_WORKFLOW').map((t) => String(t.referenceTaskName));
    expect(children.some((r) => r.includes(billingName))).toBe(true);
    expect(children.some((r) => r.includes(technicalName))).toBe(false);
  });
});

// ── Decision as a tool inside a chat agent ────────────────────────────

describe('Suite 24: decision tool', () => {
  it('executes the tool call as a branchless decision SWITCH', async () => {
    const classify: ToolDef = {
      name: 'classify_request',
      description: 'Classify the customer request before answering.',
      toolType: 'decision',
      inputSchema: { type: 'object', properties: { state: { type: 'string' } }, required: ['state'] },
      config: { model: 'jev-1.13', questions: { department: { ...QUESTION } } },
    };
    const agent = new Agent({
      name: `jssdk_e2e_decision_tool_${SUFFIX}`,
      model: MODEL,
      maxTurns: 3,
      instructions:
        'You have one tool: classify_request. Call classify_request exactly once with the ' +
        'customer message as state, then answer in one sentence.',
      tools: [classify],
    });

    // Whether a real LLM chooses to call the tool is not deterministic. Rerun only
    // when the run completed without a tool call; any other failure fails at once.
    let decisionCalls: Def[] = [];
    for (let attempt = 1; attempt <= 3 && decisionCalls.length === 0; attempt++) {
      const result = await runtime.run(agent, BILLING_REQUEST, { timeoutSeconds: TIMEOUT / 1000 });
      expectMsg(result.status, `attempt ${attempt} ${result.executionId}: ${String(result.error)}`).toBe('COMPLETED');
      const wf = (await getWorkflow(result.executionId)) as { tasks?: Def[] };
      decisionCalls = (wf.tasks ?? []).filter(
        (t) => t.taskType === 'SWITCH' && ((t.outputData as Def | undefined)?.answers as Def | undefined)?.department !== undefined,
      );
    }
    expectMsg(decisionCalls.length, 'LLM never called classify_request in 3 runs').toBeGreaterThanOrEqual(1);
    expect((decisionCalls[0].outputData as Def).selectedCase).toBe('billing');
  });
});
