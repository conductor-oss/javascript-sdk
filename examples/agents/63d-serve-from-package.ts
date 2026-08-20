/**
 * 63d - Serve from Package — auto-discover and serve all agents.
 *
 * Demonstrates:
 *   - discoverAgents() for auto-discovery of agents
 *   - Mixing explicit agents with package-based discovery
 *
 * NOTE: serve() is blocking. This example prints usage instructions.
 * In production, uncomment the runtime.serve() call.
 *
 * Requirements:
 *   - Conductor server running
 *   - CONDUCTOR_SERVER_URL=http://localhost:8080/api
 *   - CONDUCTOR_AGENT_LLM_MODEL=openai/gpt-4o-mini
 */

import { Agent, AgentRuntime, tool } from '@io-orkes/conductor-javascript/agents';
import { llmModel } from './settings';

// -- Explicit agent ----------------------------------------------------------

const healthCheck = tool(
  async () => {
    return 'All systems operational';
  },
  {
    name: 'health_check',
    description: 'Perform a basic health check.',
    inputSchema: {
      type: 'object',
      properties: {
      },
    },
  },
);

export const monitoringAgent = new Agent({
  name: 'monitoring',
  model: llmModel,
  tools: [healthCheck],
  instructions: 'You monitor system health.',
});

// -- Serve -------------------------------------------------------------------

async function main() {
  const runtime = new AgentRuntime();
  try {
    const result = await runtime.run(monitoringAgent, 'Is everything healthy? Run a full check.');
    result.printResult();

    // Production pattern:
    // 1. Deploy once during CI/CD (optional -- serve() below also deploys):
    // await runtime.deploy(monitoringAgent);
    // CLI alternative:
    // conductor deploy --package examples/agents --agents monitoring
    //
    // 2. In a separate long-lived worker process (deploys + registers workers + starts polling):
    // await runtime.serve(monitoringAgent);
  } finally {
    await runtime.shutdown();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
