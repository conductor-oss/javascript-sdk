/**
 * 63 - Deploy — register agents on the server (CI/CD step).
 *
 * deploy() sends agent configs to the server, which compiles them into
 * Conductor workflow definitions. No local workers are started. Use this
 * as a standalone CI/CD registration step when you want it decoupled from
 * worker start-up; serve() (see 63b-serve.ts) deploys and starts workers
 * in one call, so a separate deploy() isn't required in production.
 *
 * Requirements:
 *   - Conductor server running
 *   - AGENTSPAN_SERVER_URL=http://localhost:8080/api as environment variable
 *   - AGENTSPAN_LLM_MODEL=openai/gpt-4o-mini as environment variable
 */

import { Agent, AgentRuntime, tool } from '@io-orkes/conductor-javascript/agents';
import { llmModel } from './settings';

// -- Tools -------------------------------------------------------------------

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

// -- Deploy: compile + register on server ------------------------------------

async function main() {
  const runtime = new AgentRuntime();
  try {
    const result = await runtime.run(docAssistant, 'How do I reset my password?');
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
}

// Guard: 63c-run-by-name.ts imports docAssistant from this file — only run
// when executed directly, not on import.
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
