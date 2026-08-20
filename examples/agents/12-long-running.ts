/**
 * 12 - Long-Running Agent — fire-and-forget with status checking.
 *
 * Demonstrates starting an agent asynchronously and checking its status
 * from any process. The agent runs as a Conductor workflow and can be
 * monitored from the UI or via the API.
 *
 * Requirements:
 *   - Conductor server with LLM support
 *   - CONDUCTOR_SERVER_URL=http://localhost:8080/api
 *   - CONDUCTOR_AGENT_LLM_MODEL=openai/gpt-4o-mini
 */

import { Agent, AgentRuntime } from '@io-orkes/conductor-javascript/agents';
import { llmModel } from './settings';

export const agent = new Agent({
  name: 'saas_analyst',
  model: llmModel,
  instructions:
    'You are a data analyst. Provide a brief analysis ' +
    'when asked about data topics.',
});

// Start agent asynchronously (returns immediately)

async function main() {
  const runtime = new AgentRuntime();
  try {
    const result = await runtime.run(
      agent,
      'What are the key metrics to track for a SaaS product?',
    );
    result.printResult();

    // Production pattern:
    // 1. Deploy once during CI/CD (optional -- serve() below also deploys):
    // await runtime.deploy(agent);
    // CLI alternative:
    // conductor deploy --package examples/agents --agents saas_analyst
    //
    // 2. In a separate long-lived worker process (deploys + registers workers + starts polling):
    // await runtime.serve(agent);

    // Async handle alternative:
    // const handle = await runtime.start(
    //   agent,
    //   'What are the key metrics to track for a SaaS product?',
    // );
    // console.log(handle.executionId);
  } finally {
    await runtime.shutdown();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
