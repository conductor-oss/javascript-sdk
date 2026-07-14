/**
 * Suite 23: AgentClient / WorkflowClient control-plane surface (TypeScript SDK).
 *
 * Exercises the extracted control-plane client against a live runtime:
 * - OrkesAgentClient.run on an LLM-only agent (no local tools) → COMPLETED
 * - WorkflowClient.getWorkflow after a completed run → COMPLETED workflow
 * - OrkesAgentClient.schedule create → list → purge (counterfactual)
 * - AgentRuntime exposes `.client` (AgentClient) and `.workflows` (WorkflowClient)
 *
 * Deterministic: asserts on status / structure only — never validates the
 * LLM text with another LLM.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import {
  Agent,
  OrkesAgentClient,
  AgentRuntime,
  WorkflowClient,
  Schedule,
} from '@io-orkes/conductor-javascript/agents';
import { checkServerHealth, MODEL } from './helpers';

describe('Suite 23: AgentClient / WorkflowClient', () => {
  // Ported from upstream's top-level-await describe.skip gate: TS e2e fails
  // hard when the server is down (the CI workflow health-gates before tests).
  beforeAll(async () => {
    if (!(await checkServerHealth())) {
      throw new Error('agentspan server is not healthy — these e2e suites need a running server');
    }
  });
  const client = new OrkesAgentClient();

  function llmOnlyAgent(name: string): Agent {
    return new Agent({
      name,
      model: MODEL,
      instructions: 'Reply with the single word: pong. Do not add anything else.',
    });
  }

  it('OrkesAgentClient.run on an LLM-only agent completes', async () => {
    const result = await client.run(llmOnlyAgent('ts_ac_run'), 'ping');
    expect(result.status).toBe('COMPLETED');
    expect(result.executionId).toBeTruthy();
    expect(result.output).toBeTruthy();
  });

  it('WorkflowClient.getWorkflow after a completed run returns a COMPLETED workflow', async () => {
    const handle = await client.start(llmOnlyAgent('ts_ac_wf'), 'ping');
    const result = await handle.wait();
    expect(result.status).toBe('COMPLETED');

    const wf = await client.workflows.getWorkflow(result.executionId);
    expect(wf.workflowId).toBe(result.executionId);
    expect(wf.status).toBe('COMPLETED');
    expect(Array.isArray(wf.tasks)).toBe(true);

    // getStatus convenience returns the same status string.
    expect(await client.workflows.getStatus(result.executionId)).toBe('COMPLETED');
  });

  it('OrkesAgentClient.schedule create → list → purge (counterfactual)', async () => {
    const agent = llmOnlyAgent(`ts_ac_sched_${Math.random().toString(36).slice(2, 10)}`);

    // Counterfactual baseline: no schedules before we create any.
    expect(await client.schedules.listForAgent(agent.name)).toEqual([]);

    try {
      await client.schedule(agent, [
        new Schedule({ name: 'daily', cron: '0 0 9 * * ?', input: { k: 1 } }),
      ]);

      const infos = await client.schedules.listForAgent(agent.name);
      const byShort = new Map(infos.map((i) => [i.shortName, i]));
      expect(new Set(byShort.keys())).toEqual(new Set(['daily']));
      expect(byShort.get('daily')!.name).toBe(`${agent.name}-daily`);
      expect(byShort.get('daily')!.cron).toBe('0 0 9 * * ?');
    } finally {
      // Purge: empty list removes all schedules for the agent.
      await client.schedule(agent, []);
    }

    // Counterfactual: after purge, none remain.
    expect(await client.schedules.listForAgent(agent.name)).toEqual([]);
  });

  it('AgentRuntime exposes .client (AgentClient) and .workflows (WorkflowClient)', () => {
    const runtime = new AgentRuntime();
    expect(runtime.client).toBeInstanceOf(OrkesAgentClient);
    expect(runtime.workflows).toBeInstanceOf(WorkflowClient);
    // The runtime's workflow accessor is the client's workflow client.
    // (`runtime.client` is the narrow AgentClient interface — spec R1 surface
    // — so the concrete-class-only `.workflows` needs a cast here.)
    expect(runtime.workflows).toBe((runtime.client as OrkesAgentClient).workflows);
  });
});
