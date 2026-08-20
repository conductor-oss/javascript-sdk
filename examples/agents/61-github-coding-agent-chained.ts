/**
 * 61 - GitHub Coding Agent (Chained) — issue to PR pipeline.
 *
 * Deploys and serves a three-stage pipeline:
 *   1. Fetch open issue, create branch (CLI tools: gh, git)
 *   2. Code fix + QA review (SWARM: coder <-> qa_tester)
 *   3. Create pull request (CLI tool: gh)
 *
 * Requirements:
 *   - Conductor server running
 *   - GITHUB_TOKEN stored: conductor secret put GITHUB_TOKEN <your-github-token>
 *   - gh CLI installed
 */

import { Agent, AgentRuntime, OnTextMention, TextGate } from '@io-orkes/conductor-javascript/agents';

const REPO = 'agentspan-ai/codingexamples';
const MODEL = 'anthropic/claude-sonnet-4-6';

// LLMs habitually wrap compound commands in `bash -c '...'`, but bash is not
// on the allowlist and the run_command tool rejects it — which spirals into
// retry loops. Steer every CLI-using stage away from the wrapper.
const CLI_RULES =
  '\n\nTOOL RULES:\n' +
  '- To run a compound command (&&, |, $(...)), put the FULL command line in the `command` field and set shell=true.\n' +
  '- NEVER wrap a command in `bash -c` or `sh -c` — bash/sh are not allowed commands and the call will be rejected.\n' +
  '- The FIRST word of every command must be one of the allowed executables. Never start a command with a VAR=... assignment — run `mktemp -d` as its own command first and reuse its output instead.\n' +
  '- Only set `cwd` to a REAL directory path you obtained from an earlier command output. Never invent placeholder paths like /path/to/repo — omit `cwd` entirely if you do not have one.';

// -- Stage 1: Fetch issues ---------------------------------------------------

/** Stop when the agent has produced the structured output with issue details. */
function fetchDone(messages: unknown[]): boolean {
  const last = String(messages[messages.length - 1] ?? '');
  return ['REPO:', 'BRANCH:', 'ISSUE:', 'AUTHOR:', 'DETAILS:'].every(tag => last.includes(tag));
}

export const gitFetchIssues = new Agent({
  name: 'git_fetch_issues',
  model: MODEL,
  maxTokens: 8192,
  instructions:
    `You fetch ONE open issue from ${REPO} and push an empty branch.\n\n` +
    `Step 1 — list open issues:\n` +
    `  gh issue list --repo ${REPO} --state open --limit 5\n` +
    `If no issues, respond: NO_OPEN_ISSUES\n\n` +
    `Step 2 — pick an issue and fetch its FULL details (body, author, labels):\n` +
    `  gh issue view <N> --repo ${REPO} --json number,title,body,author,labels\n\n` +
    `You MUST run this command — gh issue list only returns titles, not the issue body.\n` +
    `Read the JSON output carefully and extract the author login and the COMPLETE body text.\n\n` +
    `Step 3a — create a scratch directory (run exactly this, saving the output):\n` +
    `  mktemp -d   (set context_key to "working_dir")\n\n` +
    `Step 3b — clone and push the branch (one compound command, shell=true, substituting\n` +
    `<TMPDIR> with the directory printed by step 3a):\n` +
    `  gh repo clone ${REPO} <TMPDIR> && cd <TMPDIR> && git checkout -b fix/issue-<N> && git push -u origin fix/issue-<N>\n\n` +
    `Step 4 — respond with ONLY these lines (NO tool calls):\n` +
    `  REPO: ${REPO}\n` +
    `  BRANCH: fix/issue-<N>\n` +
    `  ISSUE: #<N> <title>\n` +
    `  AUTHOR: <who opened the issue>\n` +
    `  DETAILS: <full issue body — preserve all requirements, acceptance criteria, and context>\n` +
    `  SUMMARY: <one-sentence description>\n\n` +
    `RULES:\n` +
    `- Do NOT create files, commits, or pull requests.\n` +
    `- After step 3, you MUST stop using tools entirely. Just output text.\n` +
    `- Include the COMPLETE issue body in DETAILS — the next stage needs it to implement the fix.` + CLI_RULES,
  cliConfig: { enabled: true, allowedCommands: ['gh', 'git', 'mktemp', 'ls', 'cat'], allowShell: true, timeout: 60 },
  credentials: ['GITHUB_TOKEN', 'GH_TOKEN'],
  maxTurns: 20,
  stopWhen: fetchDone,
  gate: new TextGate({ text: 'NO_OPEN_ISSUES' }),
});

// -- Stage 2: Coding + QA (SWARM) -------------------------------------------

export const coderStage = new Agent({
  name: 'coder',
  model: MODEL,
  maxTokens: 60000,
  credentials: ['GITHUB_TOKEN', 'GH_TOKEN'],
  instructions:
    'You are a senior developer. Your input contains issue details from the previous stage\n' +
    'including REPO, BRANCH, ISSUE, AUTHOR, DETAILS, and SUMMARY.\n\n' +
    '1. Read the DETAILS field carefully — it contains the full issue body with requirements.\n' +
    '2. Create a fresh scratch directory: run `mktemp -d` (set context_key to "working_dir").\n' +
    '3. Clone and check out the branch (substitute <TMPDIR> with the step-2 output):\n' +
    '   gh repo clone <REPO> <TMPDIR> && cd <TMPDIR> && git checkout <BRANCH>\n' +
    '4. Implement the fix according to ALL requirements in DETAILS. Satisfy every acceptance\n' +
    '   criterion literally, even if the repo already partially meets it.\n' +
    '5. Commit and push your changes (run from <TMPDIR>): git add -A && git commit -m "Fix <ISSUE>" && git push\n' +
    '6. Say HANDOFF_TO_QA with REPO, BRANCH, and a summary of CHANGES.' + CLI_RULES,
  cliConfig: { enabled: true, allowedCommands: ['gh', 'git', 'mktemp', 'rm', 'ls', 'cat', 'mkdir', 'cp', 'echo', 'printf'], allowShell: true, timeout: 120 },
});

export const qaStage = new Agent({
  name: 'qa_tester',
  model: MODEL,
  credentials: ['GITHUB_TOKEN', 'GH_TOKEN'],
  instructions:
    'You are a QA engineer. Clone the repo, review changes, run tests.\n' +
    'If bugs found: say HANDOFF_TO_CODER with what to fix.\n' +
    'If good: say QA_APPROVED with REPO/BRANCH/SUMMARY.' + CLI_RULES,
  cliConfig: { enabled: true, allowedCommands: ['gh', 'git', 'mktemp', 'rm', 'ls', 'cat'], allowShell: true, timeout: 120 },
  maxTokens: 60000,
  maxTurns: 15,
});

export const codingQA = new Agent({
  name: 'coding_qa',
  model: MODEL,
  instructions:
    'Delegate to coder, then qa_tester. Loop until QA approves. ' +
    'Output REPO/BRANCH/SUMMARY when done.',
  agents: [coderStage, qaStage],
  strategy: 'swarm',
  handoffs: [
    new OnTextMention({ text: 'HANDOFF_TO_QA', target: 'qa_tester' }),
    new OnTextMention({ text: 'HANDOFF_TO_CODER', target: 'coder' }),
  ],
  maxTurns: 200,
  maxTokens: 60000,
  timeoutSeconds: 6000,
});

// -- Stage 3: Create PR ------------------------------------------------------

/** Stop when the agent has output a PR URL. */
function prDone(messages: unknown[]): boolean {
  const last = String(messages[messages.length - 1] ?? '');
  return last.includes('github.com') && last.includes('/pull/');
}

export const gitPushPR = new Agent({
  name: 'git_push_pr',
  model: MODEL,
  maxTokens: 8192,
  maxTurns: 15,
  credentials: ['GITHUB_TOKEN', 'GH_TOKEN'],
  instructions:
    'Create a pull request. Extract REPO, BRANCH, and ISSUE from the previous stage output.\n\n' +
    'Run this command (shell=true so quotes are handled correctly):\n' +
    '  gh pr create --repo <REPO> --base main --head <BRANCH> --title "Fix <ISSUE>" --body "Fixes <ISSUE>"\n\n' +
    'After the command succeeds, STOP calling tools and respond with ONLY the PR URL.' + CLI_RULES,
  cliConfig: { enabled: true, allowedCommands: ['gh', 'git', 'cat'], allowShell: true, timeout: 60 },
  stopWhen: prDone,
});

// -- Pipeline ----------------------------------------------------------------

const pipeline = gitFetchIssues.pipe(codingQA).pipe(gitPushPR);

async function main() {
  const runtime = new AgentRuntime();
  try {
    const result = await runtime.run(
      pipeline,
      'Pick an open issue and create a PR.',
      { timeoutSeconds: 2400 },
    );
    result.printResult();

    // Production pattern:
    // 1. Deploy once during CI/CD (optional -- serve() below also deploys):
    // await runtime.deploy(pipeline);
    // CLI alternative:
    // conductor deploy --package examples/agents --agents git_fetch_issues
    //
    // 2. In a separate long-lived worker process (deploys + registers workers + starts polling):
    // await runtime.serve(pipeline);
  } finally {
    await runtime.shutdown();
  }
}

main().catch(console.error);
