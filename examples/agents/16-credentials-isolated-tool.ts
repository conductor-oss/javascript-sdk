/**
 * Credentials -- per-user secrets injected into isolated tool subprocesses.
 *
 * Demonstrates:
 *   - tool() with credentials: ["GITHUB_TOKEN"] (default isolated=true)
 *   - Credentials injected into a fresh subprocess -- parent env never touched
 *   - Tool reads credential from process.env inside the subprocess
 *
 * How it works:
 *   1. The server resolves declared credentials at task-poll time and
 *      delivers them wire-only on the polled Task's `runtimeMetadata` map --
 *      never persisted, never a separate fetch.
 *   2. Fail-closed: if a declared credential wasn't delivered, the task fails
 *      before the tool function ever runs. The ambient process.env is never
 *      read as a fallback.
 *   3. The tool function runs in a fresh subprocess with the resolved
 *      credentials injected as env vars. The parent process's process.env is
 *      unchanged.
 *
 * Setup (one-time, via CLI):
 *   agentspan login                                     # authenticate
 *   agentspan credentials set GITHUB_TOKEN <your-github-token> # enter token when prompted
 *
 * Requirements:
 *   - Agentspan server running at AGENTSPAN_SERVER_URL (> 0.4.2, for
 *     runtimeMetadata delivery) or conductor-oss (with PR #1255)
 *   - AGENTSPAN_LLM_MODEL set (or defaults to openai/gpt-4o-mini)
 *   - GITHUB_TOKEN stored via `agentspan credentials set`
 */

import { Agent, AgentRuntime, tool } from '@io-orkes/conductor-javascript/agents';
import { llmModel } from './settings';

// -- Isolated tool: list GitHub repos -----------------------------------------

const listGithubRepos = tool(
  async (args: { username: string }) => {
    const token = process.env.GITHUB_TOKEN ?? '';
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const resp = await fetch(
        `https://api.github.com/users/${args.username}/repos?per_page=5&sort=updated`,
        { headers, signal: AbortSignal.timeout(10_000) },
      );
      if (!resp.ok) {
        return { error: `GitHub API error: ${resp.status} ${resp.statusText}` };
      }
      const repos = (await resp.json()) as { name: string; stargazers_count: number }[];
      return {
        username: args.username,
        repos: repos.map((r) => ({ name: r.name, stars: r.stargazers_count })),
        authenticated: Boolean(token),
      };
    } catch (err) {
      return { error: String(err) };
    }
  },
  {
    name: 'list_github_repos',
    description: 'List public repositories for a GitHub user. GITHUB_TOKEN env var is injected automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        username: { type: 'string', description: 'GitHub username' },
      },
      required: ['username'],
    },
    credentials: ['GITHUB_TOKEN'],
  },
);

// -- Isolated tool: create GitHub issue ---------------------------------------

const createGithubIssue = tool(
  async (args: { repo: string; title: string; body: string }) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return { error: 'GITHUB_TOKEN not available -- cannot create issues without auth' };
    }

    try {
      const resp = await fetch(
        `https://api.github.com/repos/${args.repo}/issues`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title: args.title, body: args.body }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!resp.ok) {
        return { error: `GitHub API error: ${resp.status} ${resp.statusText}` };
      }
      const issue = (await resp.json()) as { number?: number; html_url?: string };
      return { issue_number: issue.number, url: issue.html_url };
    } catch (err) {
      return { error: String(err) };
    }
  },
  {
    name: 'create_github_issue',
    description:
      'Create a GitHub issue. Requires GITHUB_TOKEN with write access. repo format: "owner/repo-name"',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in "owner/repo" format' },
        title: { type: 'string', description: 'Issue title' },
        body: { type: 'string', description: 'Issue body' },
      },
      required: ['repo', 'title', 'body'],
    },
    credentials: ['GITHUB_TOKEN'],
  },
);

// -- Agent definition ---------------------------------------------------------

export const agent = new Agent({
  name: 'github_agent',
  model: llmModel,
  tools: [listGithubRepos, createGithubIssue],
  // Declare credentials at the agent level -- SDK auto-fetches for all tools
  credentials: ['GITHUB_TOKEN'],
  instructions:
    'You are a GitHub assistant. You can list repos and create issues. ' +
    'Always confirm with the user before creating issues.',
});

// -- Run ----------------------------------------------------------------------

async function main() {
  const runtime = new AgentRuntime();
  try {
    const result = await runtime.run(
    agent,
    "List the 5 most recently updated repos for the 'agentspan' GitHub user.",
    );
    result.printResult();

    // Production pattern:
    // 1. Deploy once during CI/CD (optional -- serve() below also deploys):
    // await runtime.deploy(agent);
    // CLI alternative:
    // agentspan deploy --package sdk/typescript/examples --agents github_agent
    //
    // 2. In a separate long-lived worker process (deploys + registers workers + starts polling):
    // await runtime.serve(agent);
  } finally {
    await runtime.shutdown();
  }
}

main().catch(console.error);
