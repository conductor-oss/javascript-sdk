/**
 * 63e - Run Monitoring Agent — use runtime.run() and print the result.
 *
 * Requirements:
 *   - Conductor server running
 *   - AGENTSPAN_SERVER_URL=http://localhost:8080/api as environment variable
 *   - AGENTSPAN_LLM_MODEL=openai/gpt-4o-mini as environment variable
 */

import { monitoringAgent } from './63d-serve-from-package.js';
import { AgentRuntime } from '@io-orkes/conductor-javascript/agents';

const runtime = new AgentRuntime();
try {
  const result = await runtime.run(monitoringAgent, 'Is everything healthy? Run a full check.');
  result.printResult();

  // Production pattern:
  // 1. Deploy once during CI/CD (optional -- serve() below also deploys):
  // await runtime.deploy(monitoringAgent);
  // CLI alternative:
  // agentspan deploy --package sdk/typescript/examples --agents monitoring
  //
  // 2. In a separate long-lived worker process (deploys + registers workers + starts polling):
  // await runtime.serve(monitoringAgent);
} finally {
  await runtime.shutdown();
}
