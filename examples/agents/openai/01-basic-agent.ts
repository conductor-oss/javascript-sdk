// Copyright (c) 2025 Agentspan
// Licensed under the MIT License. See LICENSE file in the project root for details.

/**
 * Basic OpenAI Agent -- simplest possible agent with no tools.
 *
 * Demonstrates:
 *   - Defining an agent using the real @openai/agents SDK
 *   - Running it via Conductor passthrough (AgentRuntime)
 *
 * Requirements:
 *   - CONDUCTOR_SERVER_URL=http://localhost:8080/api
 */

import { Agent, setTracingDisabled } from '@openai/agents';
import { AgentRuntime } from '@io-orkes/conductor-javascript/agents';

// Disable OpenAI tracing for cleaner example output
setTracingDisabled(true);

export const agent = new Agent({
  name: 'greeter',
  instructions: 'You are a friendly assistant. Keep your responses concise and helpful.',
  model: 'gpt-4o-mini',
});

const prompt = 'Say hello and tell me a fun fact about the TypeScript programming language.';

// ── Run on Conductor ──────────────────────────────────────────────
async function main() {
  const runtime = new AgentRuntime();
  try {
    const result = await runtime.run(agent, prompt);
    console.log('Status:', result.status);
    result.printResult();

    // Production pattern:
    // 1. Deploy once during CI/CD:
    // await runtime.deploy(agent);
    // CLI alternative:
    // conductor deploy --package examples/agents/openai --agents greeter
    //
    // 2. In a separate long-lived worker process:
    // await runtime.serve(agent);
  } finally {
    await runtime.shutdown();
  }
}

main().catch(console.error);
