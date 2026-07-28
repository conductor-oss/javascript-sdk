/**
 * 63c - Direct Run — kept alongside the Python "run by name" variant for parity.
 *
 * The current TypeScript runtime accepts agent objects here, so this example
 * uses the imported agent definition directly. The commented production
 * pattern below shows the standalone deploy() CI/CD step; serve() alone
 * (see 63b-serve.ts) deploys and starts workers in one call and is
 * sufficient without it.
 *
 * Requirements:
 *   - Conductor server running
 *   - AGENTSPAN_SERVER_URL=http://localhost:8080/api as environment variable
 *   - AGENTSPAN_LLM_MODEL=openai/gpt-4o-mini as environment variable
 */

import { docAssistant } from './63-deploy.js';
import { AgentRuntime } from '@io-orkes/conductor-javascript/agents';

async function main() {
  const runtime = new AgentRuntime();
  try {
    const result = await runtime.run(docAssistant, 'How do I reset my password?');
    result.printResult();

    // Production pattern:
    // 1. Deploy once during CI/CD (optional -- serve() below also deploys):
    // await runtime.deploy(docAssistant);
    // CLI alternative:
    // agentspan deploy --package sdk/typescript/examples --agents doc_assistant
    //
    // 2. In a separate long-lived worker process (deploys + registers workers + starts polling):
    // await runtime.serve(docAssistant);
  } finally {
    await runtime.shutdown();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
