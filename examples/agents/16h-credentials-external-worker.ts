/**
 * Credentials -- External worker credential resolution.
 *
 * Demonstrates:
 *   - tool() with external: true, credentials: ["GITHUB_TOKEN"] declares
 *     credentials for an external worker
 *   - The server resolves declared credentials at task-poll time and
 *     delivers them wire-only on the polled Task's `runtimeMetadata` map
 *     (name -> value) -- the external worker reads them directly, no
 *     separate resolve call needed
 *   - Works for workers running in separate processes, containers,
 *     or machines
 *
 * This example shows two sides:
 *   1. Agent definition (declares the external tool with credentials)
 *   2. External worker pattern (reads runtimeMetadata from the polled task)
 *
 * The external worker typically runs in a separate process, polling
 * Conductor's task API directly. Here we demonstrate both patterns in one
 * file.
 *
 * Setup (one-time):
 *   agentspan credentials set GITHUB_TOKEN <your-github-token>
 *
 * Requirements:
 *   - Agentspan server running at AGENTSPAN_SERVER_URL (> 0.4.2, for
 *     runtimeMetadata delivery) or conductor-oss (with PR #1255)
 *   - AGENTSPAN_LLM_MODEL set (or defaults to openai/gpt-4o-mini)
 *   - GITHUB_TOKEN stored via `agentspan credentials set`
 */

import { Agent, tool } from '@io-orkes/conductor-javascript/agents';
import { llmModel } from './settings';

// -- Agent side: declare external tool with credentials -----------------------

const githubLookup = tool(
  async (_args: { username: string }) => {
    // Stub -- actual implementation is in the external worker below
    return { stub: true };
  },
  {
    name: 'github_lookup',
    description: "Look up a GitHub user's profile. Runs on an external worker.",
    inputSchema: {
      type: 'object',
      properties: {
        username: { type: 'string', description: 'GitHub username to look up' },
      },
      required: ['username'],
    },
    external: true,
    credentials: ['GITHUB_TOKEN'],
  },
);

export const agent = new Agent({
  name: 'external_cred_agent',
  model: llmModel,
  tools: [githubLookup],
  instructions: 'You can look up GitHub users. Use the github_lookup tool.',
});

// -- External worker side: read runtimeMetadata from the polled task ---------
// In production, this would run in a separate process polling Conductor's
// task API directly (GET /tasks/poll/github_lookup); the polled Task object
// carries `runtimeMetadata` as a sibling of `inputData`, already resolved.

async function externalWorkerExample(task: {
  inputData: Record<string, unknown>;
  runtimeMetadata?: Record<string, string>;
}) {
  const token = task.runtimeMetadata?.GITHUB_TOKEN;
  if (!token) {
    // Fail closed: the server didn't deliver the declared credential.
    // Never fall back to reading it from ambient process.env.
    console.log('  GITHUB_TOKEN missing from runtimeMetadata -- failing the task');
    return { error: 'GITHUB_TOKEN not found in runtimeMetadata' };
  }

  console.log('  Resolved GITHUB_TOKEN: present');

  // Use the credential to make API calls
  const username = (task.inputData.username as string) ?? 'octocat';
  const resp = await fetch(`https://api.github.com/users/${username}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (resp.ok) {
    const user = (await resp.json()) as Record<string, unknown>;
    return {
      name: user.name,
      login: user.login,
      public_repos: user.public_repos,
      followers: user.followers,
    };
  } else {
    return { error: `GitHub API error: ${resp.status}` };
  }
}

// Suppress unused variable warning
void externalWorkerExample;

console.log('Note: This example demonstrates the pattern for external workers.');
console.log('The external worker (externalWorkerExample) would run in a separate process.');
console.log();
console.log('To run end-to-end:');
console.log('  1. Start the external worker in one terminal');
console.log('  2. Run the agent in another terminal');
console.log();
console.log('Agent definition:');
console.log(`  name: ${agent.name}`);
console.log(`  tools: [${agent.tools.map((t) => (t as { name?: string }).name ?? 'unknown').join(', ')}]`);
console.log();
console.log('External worker pattern:');
console.log('  const token = task.runtimeMetadata?.GITHUB_TOKEN;');
console.log('  if (!token) { /* fail closed -- never read process.env as a fallback */ }');
