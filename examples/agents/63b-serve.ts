/**
 * 63b - Serve — keep tool workers running as a persistent service.
 *
 * serve() deploys the agent(s) (registering the workflow definition on the
 * server, same as deploy()), registers the tool functions as Conductor
 * workers, and starts polling for tasks — one call, no separate deploy()
 * step required. Pass `{ blocking: false }` to return once deploy +
 * registration + polling have started instead of blocking forever.
 *
 * NOTE: serve() is blocking by default. This example defines the agents and
 * prints a message about how to call serve(). In production, uncomment
 * the runtime.serve() call and run this as a long-lived process.
 *
 * Requirements:
 *   - Conductor server running
 *   - AGENTSPAN_SERVER_URL=http://localhost:8080/api as environment variable
 *   - AGENTSPAN_LLM_MODEL=openai/gpt-4o-mini as environment variable
 */

import { Agent, AgentRuntime, tool } from '@io-orkes/conductor-javascript/agents';
import { llmModel } from './settings';

// -- Tools (same definitions as 63-deploy.ts) --------------------------------

const searchDocs = tool(
  async (args: { query: string }) => {
    return `Found 3 results for: ${args.query}`;
  },
  {
    name: 'search_docs',
    description: 'Search internal documentation.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query string' },
      },
      required: ['query'],
    },
  },
);

const checkStatus = tool(
  async (args: { service: string }) => {
    return `${args.service}: healthy`;
  },
  {
    name: 'check_status',
    description: 'Check service health status.',
    inputSchema: {
      type: 'object',
      properties: {
        service: { type: 'string', description: 'Name of the service to check' },
      },
      required: ['service'],
    },
  },
);

// -- Define agents -----------------------------------------------------------

export const docAssistant = new Agent({
  name: 'doc_assistant',
  model: llmModel,
  tools: [searchDocs],
  instructions: 'Help users find documentation. Use search_docs to look up answers.',
});

export const opsBot = new Agent({
  name: 'ops_bot',
  model: llmModel,
  tools: [checkStatus],
  instructions: 'Monitor service health. Use check_status to inspect services.',
});

// -- Serve: register workers and block ---------------------------------------

const runtime = new AgentRuntime();
try {
  const result = await runtime.run(opsBot, 'Check the status of the API gateway.');
  result.printResult();

  // Production pattern:
  // 1. Deploy once during CI/CD (optional -- serve() below also deploys):
  // await runtime.deploy(docAssistant);
  // await runtime.deploy(opsBot);
  // CLI alternative:
  // agentspan deploy --package sdk/typescript/examples --agents doc_assistant
  //
  // 2. In a separate long-lived worker process (deploys + registers workers + starts polling):
  // await runtime.serve(docAssistant, opsBot);
} finally {
  await runtime.shutdown();
}
