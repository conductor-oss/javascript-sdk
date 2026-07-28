# Examples

Runnable examples demonstrating every feature of the Agentspan TypeScript SDK.

**200+ runnable examples in total**: the core examples cataloged below, plus
the [quickstart/](quickstart/) guides and framework ports for Google ADK,
LangGraph, OpenAI Agents SDK, and Vercel AI SDK.

---

## Examples vs. Production

> **Every example uses `runtime.run()` for convenience. In production, you should not.**

Examples call `runtime.run()` so you can try them in a single command — no setup, no
separate processes. But `run()` blocks the caller until the agent finishes, which is fine
for demos but not how you deploy real agents.

### Production: Deploy → Serve → Run

In production, the three concerns are separated:

```
┌──────────────────────────────────────────────────────────────┐
│  1. DEPLOY (once, during CI/CD)                              │
│     Registers the agent definition with the Agentspan server │
│                                                              │
│     await runtime.deploy(agent);                             │
│     // or CLI: agentspan deploy --package my-agents          │
├──────────────────────────────────────────────────────────────┤
│  2. SERVE (long-running worker process)                      │
│     Listens for tool-call tasks and executes them            │
│                                                              │
│     await runtime.serve(agent);                              │
│     // typically run as a daemon or container                │
├──────────────────────────────────────────────────────────────┤
│  3. RUN (on-demand, from anywhere)                           │
│     Triggers an agent execution                              │
│                                                              │
│     agentspan run <agent-name> "prompt"                      │
│     // or SDK: await runtime.run("agent_name", "prompt");    │
│     // or REST API                                           │
└──────────────────────────────────────────────────────────────┘
```

Every example includes the deploy/serve pattern as commented code at the bottom of its
`main()` function — look for the `// Production pattern:` comment.

See [63-deploy.ts](63-deploy.ts), [63b-serve.ts](63b-serve.ts), and
[63c-run-by-name.ts](63c-run-by-name.ts) for a complete working example of this pattern.

---

## Getting Started

### 1. Install dependencies

The core examples (numbered files in this directory) are repository examples.
They resolve `@io-orkes/conductor-javascript/agents` straight to the repo's
`src/agents/` sources (via this directory's `tsconfig.json` paths), so they are
meant to be run from this checkout of the SDK:

```bash
# from the repository root
npm install
```

Framework-specific examples require additional packages. Install only what you need:

### 1.1. Copy/paste into your own project

If you want to copy an example into a separate project after `npm install`, switch
its imports to the published package:

```bash
npm install @io-orkes/conductor-javascript zod
```

```ts
import { Agent, AgentRuntime } from '@io-orkes/conductor-javascript/agents';
```

The files under `examples/` are not copy/paste-ready as-is because they import the
SDK source tree directly.

#### Google ADK examples (`adk/`)

```bash
cd adk && npm install
```

#### LangGraph examples (`langgraph/`)

```bash
cd langgraph && npm install
```

#### OpenAI Agents SDK examples (`openai/`)

```bash
cd openai && npm install
```

Requires `OPENAI_API_KEY` environment variable.

#### Vercel AI examples (`vercel-ai/`)

```bash
cd vercel-ai && npm install
```

### 2. Configure your environment

Export environment variables:

```bash
export AGENTSPAN_LLM_MODEL=openai/gpt-4o-mini
export AGENTSPAN_SERVER_URL=http://localhost:8080/api
# export AGENTSPAN_AUTH_KEY=<key>     # if authentication is enabled
# export AGENTSPAN_AUTH_SECRET=<secret>
```

#### 2.1. Choose a model

The `AGENTSPAN_LLM_MODEL` variable uses the `provider/model-name` format. Examples:

| Provider | Model string | API key env var |
|----------|-------------|-----------------|
| OpenAI | `anthropic/claude-sonnet-4-6` (default) | `OPENAI_API_KEY` |
| Anthropic | `anthropic/claude-sonnet-4-20250514` | `ANTHROPIC_API_KEY` |
| Google Gemini | `google_gemini/gemini-2.0-flash` | `GOOGLE_GEMINI_API_KEY` |
| AWS Bedrock | `aws_bedrock/...` | AWS credentials |
| Azure OpenAI | `azure_openai/...` | Azure credentials |

### 3. Run an example

```bash
# Core agent examples (run from the repository root)
npx tsx examples/agents/01-basic-agent.ts
npx tsx examples/agents/15-agent-discussion.ts

# Framework-specific examples (install their deps first, see 1.1)
cd examples/agents/adk && npx tsx 01-basic-agent.ts
cd examples/agents/langgraph && npx tsx 01-hello-world.ts
cd examples/agents/openai && npx tsx 01-basic-agent.ts
```

---

## Basic Examples

| # | Example | What it demonstrates |
|---|---------|---------------------|
| 01 | [Basic Agent](01-basic-agent.ts) | Simplest possible agent — single LLM, no tools |
| 02 | [Tools](02-tools.ts) | Multiple `tool()` functions, approval-required tools |
| — | [Kitchen Sink](kitchen-sink.ts) | Content publishing platform — every major feature in one example |

## Tool Calling & Structured Output

| # | Example | What it demonstrates |
|---|---------|---------------------|
| 02a | [Simple Tools](02a-simple-tools.ts) | Two tools (weather, stocks) — LLM picks the right one |
| 02b | [Multi-Step Tools](02b-multi-step-tools.ts) | Chained tool calls: lookup → fetch → calculate → answer |
| 03 | [Structured Output](03-structured-output.ts) | Zod `outputType` for typed, validated responses |
| 04 | [HTTP & MCP Tools](04-http-and-mcp-tools.ts) | Server-side tools via `httpTool()` and `mcpTool()` — no workers needed |
| 04b | [MCP Weather](04-mcp-weather.ts) | Real-time weather via an MCP server |
| 09 | [Structured Output (agent run)](09-structured-output.ts) | Zod schema as `outputType` — typed result from a full agent run |
| 14 | [Existing Workers](14-existing-workers.ts) | Use existing worker task functions directly as agent tools |
| 33 | [Single Turn Tool](33-single-turn-tool.ts) | Single-turn tool invocation with immediate response |
| 33 | [External Workers](33-external-workers.ts) | Reference workers in other services — no local code needed |
| 45 | [Agent Tool](45-agent-tool.ts) | Invoke a child agent inline as a function call (vs handoff) |
| 51 | [Shared State](51-shared-state.ts) | Tools sharing state across calls via `ToolContext` |
| 71 | [API Tool](71-api-tool.ts) | Auto-discover endpoints from OpenAPI, Swagger, or Postman specs |
| 74 | [CLI Error Output](74-cli-error-output.ts) | Agent sees stdout/stderr when a CLI tool exits non-zero |

## Multi-Agent Orchestration

| # | Example | Pattern |
|---|---------|---------|
| 03 | [Multi-Agent](03-multi-agent.ts) | Three strategies in one file: sequential, parallel, handoff |
| 05 | [Handoffs](05-handoffs.ts) | LLM-driven delegation to sub-agents |
| 06 | [Sequential Pipeline](06-sequential-pipeline.ts) | Agents run in order, output chains forward |
| 07 | [Parallel Agents](07-parallel-agents.ts) | All agents run concurrently, results aggregated |
| 08 | [Router Agent](08-router-agent.ts) | Router selects which sub-agent runs |
| 13 | [Hierarchical Agents](13-hierarchical-agents.ts) | 3-level nested hierarchy: CEO → leads → specialists |
| 15 | [Agent Discussion](15-agent-discussion.ts) | Round-robin debate between agents, piped to a summarizer |
| 16 | [Random Strategy](16-random-strategy.ts) | Random agent selected each turn (brainstorming) |
| 17 | [Swarm Orchestration](17-swarm-orchestration.ts) | Automatic transitions via handoff conditions |
| 18 | [Manual Selection](18-manual-selection.ts) | Human picks which agent speaks each turn |
| 19 | [Composable Termination](19-composable-termination.ts) | AND/OR rules for stopping multi-agent runs |
| 20 | [Constrained Transitions](20-constrained-transitions.ts) | Restrict which agents can follow which |
| 29 | [Agent Introductions](29-agent-introductions.ts) | Agents introduce themselves before a group discussion |
| 38 | [Tech Trends](38-tech-trends.ts) | Multi-agent research pipeline with live HTTP API tools |
| 41 | [Sequential Pipeline with Tools](41-sequential-pipeline-tools.ts) | Stage-level tools in a pipeline |
| 46 | [Transfer Control](46-transfer-control.ts) | Constrained handoff paths between sub-agents |
| 52 | [Nested Strategies](52-nested-strategies.ts) | Parallel agents inside a sequential pipeline |
| 58 | [Scatter-Gather](58-scatter-gather.ts) | Massive parallel multi-agent orchestration |
| 64 | [Swarm with Tools](64-swarm-with-tools.ts) | Sub-agents with their own domain tools |
| 65 | [Parallel with Tools](65-parallel-with-tools.ts) | Each parallel branch has its own tools |
| 66 | [Handoff to Parallel](66-handoff-to-parallel.ts) | Delegate to a multi-agent group |
| 67 | [Router to Sequential](67-router-to-sequential.ts) | Route to a pipeline sub-agent |

## Human-in-the-Loop

| # | Example | What it demonstrates |
|---|---------|---------------------|
| 06 | [HITL Basics](06-hitl.ts) | Approval-required tool with interactive console prompts |
| 09 | [Human-in-the-Loop](09-human-in-the-loop.ts) | Tool approval gate — approve or reject before execution |
| 09b | [HITL with Feedback](09b-hitl-with-feedback.ts) | Custom feedback via `respond()` — editorial review |
| 09c | [HITL with Streaming](09c-hitl-streaming.ts) | Real-time event stream with approval pauses |
| 09d | [Human Tool](09d-human-tool.ts) | Human-as-a-tool for interactive conversations |

## Guardrails & Safety

| # | Example | What it demonstrates |
|---|---------|---------------------|
| 04 | [Guardrail Types](04-guardrails.ts) | Regex, LLM, and custom guardrails in one file |
| 10 | [Guardrails](10-guardrails.ts) | Output validation with guardrail functions |
| 21 | [Regex Guardrails](21-regex-guardrails.ts) | Pattern-based blocking (emails, SSNs) and allow-listing |
| 22 | [LLM Guardrails](22-llm-guardrails.ts) | AI-powered content safety evaluation via a judge LLM |
| 31 | [Tool Guardrails](31-tool-guardrails.ts) | Pre-execution validation on tool inputs |
| 32 | [Human Guardrail](32-human-guardrail.ts) | Pause agent for human review when output fails |
| 35 | [Standalone Guardrails](35-standalone-guardrails.ts) | Use guardrails as plain callables — no agent needed |
| 36 | [Simple Agent Guardrails](36-simple-agent-guardrails.ts) | Mixed regex + custom guardrails on agents |
| 37 | [Fix Guardrail](37-fix-guardrail.ts) | Auto-correct output instead of retrying |
| 42 | [Security Testing](42-security-testing.ts) | Multi-agent security testing pipeline |
| 43 | [Data Security Pipeline](43-data-security-pipeline.ts) | Data-safety pipeline with guardrails |
| 44 | [Safety Guardrails](44-safety-guardrails.ts) | Safety guardrails pipeline |
| 62 | [CLI Tool Guardrails](62-cli-tool-guardrails.ts) | Safe command execution |
| 90 | [Guardrail E2E Tests](90-guardrail-e2e-tests.ts) | Full 3×3×3 matrix: position × type × onFail (27 tests) |

## Streaming & Execution Modes

| # | Example | What it demonstrates |
|---|---------|---------------------|
| 05 | [Streaming Basics](05-streaming.ts) | `runtime.stream()` with for-await-of and event type switching |
| 11 | [Streaming](11-streaming.ts) | Real-time event stream with `runtime.stream()` |
| 12 | [Long-Running](12-long-running.ts) | Async polling with `runtime.start()` |

## Memory & Context

| # | Example | What it demonstrates |
|---|---------|---------------------|
| 07 | [Memory](07-memory.ts) | `ConversationMemory` windowing + `SemanticMemory` similarity search |
| 25 | [Semantic Memory](25-semantic-memory.ts) | Long-term memory with similarity-based retrieval |
| 49 | [Include Contents](49-include-contents.ts) | Control conversation context passed to sub-agents |
| 68 | [Context Condensation](68-context-condensation.ts) | Stress test: server condenses long history automatically |

## Planning

| # | Example | What it demonstrates |
|---|---------|---------------------|
| 48 | [Planner](48-planner.ts) | Agent that plans before executing |
| 57 | [Plan (Dry Run)](57-plan-dry-run.ts) | Compile an agent without executing it |
| 108 | [Plan-Execute Refs](108-plan-execute-refs.ts) | Pipe whole step outputs downstream with `new Ref("step_id")` |
| 115 | [Plan-Execute Planner Context](115-plan-execute-planner-context.ts) | Inject domain-specific planning rules via `plannerContext` |

## Code Execution

| # | Example | What it demonstrates |
|---|---------|---------------------|
| 10 | [Code Execution](10-code-execution.ts) | `LocalCodeExecutor.asTool()` attached to an agent |
| 24 | [Code Executors](24-code-execution.ts) | Executor types: local subprocess vs Docker sandbox |
| 39 | [Local Code Execution](39-local-code-execution.ts) | Three config styles, incl. language/command restrictions |
| 39a | [Docker Code Execution](39a-docker-code-execution.ts) | Docker-sandboxed execution |
| 39b | [Jupyter Code Execution](39b-jupyter-code-execution.ts) | Jupyter kernel execution |
| 39c | [Serverless Code Execution](39c-serverless-code-execution.ts) | Serverless sandbox execution |

## Skills

| # | Example | What it demonstrates |
|---|---------|---------------------|
| 30 | [Skills: /dg Review](30-skills-dg-review.ts) | Load the /dg skill as a durable agent |
| 31 | [Skills: Conductor](31-skills-conductor.ts) | Load the conductor skill for workflow management |
| 32 | [Skills: Multi-Agent](32-skills-multi-agent.ts) | Skills as sub-agents in multi-agent workflows |

## Observability & Callbacks

| # | Example | What it demonstrates |
|---|---------|---------------------|
| 23 | [Token & Cost Tracking](23-token-tracking.ts) | Monitor LLM token usage per agent run |
| 26 | [OpenTelemetry Tracing](26-opentelemetry-tracing.ts) | Industry-standard observability |
| 47 | [Callbacks](47-callbacks.ts) | `CallbackHandler` hooks around LLM and tool calls |
| 53 | [Agent Lifecycle Callbacks](53-agent-lifecycle-callbacks.ts) | Composable handler classes, chained per position |

## Model & Provider Features

| # | Example | What it demonstrates |
|---|---------|---------------------|
| 28 | [GPT Assistant Agent](28-gpt-assistant-agent.ts) | Wrap the OpenAI Assistants API as a Conductor agent |
| 30 | [Multimodal Agent](30-multimodal-agent.ts) | Analyze images and video with vision-capable models |
| 40 | [Media Generation Agent](40-media-generation-agent.ts) | Generate media assets from an agent |
| 50 | [Thinking Config](50-thinking-config.ts) | Enable extended reasoning for complex tasks |

## Credentials

| # | Example | What it demonstrates |
|---|---------|---------------------|
| 08 | [Credentials](08-credentials.ts) | Server-side credential injection |
| 16 | [Isolated Tool](16-credentials-isolated-tool.ts) | Per-user secrets injected into isolated tool subprocesses |
| 16b | [Non-Isolated](16b-credentials-non-isolated.ts) | In-process tools using `getCredential()` |
| 16c | [CLI Tools](16c-credentials-cli-tools.ts) | CLI tools with explicit credential declarations |
| 16d | [GitHub CLI](16d-credentials-gh-cli.ts) | `gh` with automatic credential injection |
| 16e | [HTTP Tool](16e-credentials-http-tool.ts) | Server-side credential resolution in HTTP tool headers |
| 16f | [MCP Tool](16f-credentials-mcp-tool.ts) | Server-side credential resolution in MCP tool headers |
| 16g | [Framework Passthrough](16g-credentials-framework-passthrough.ts) | Credential injection into framework-wrapped agents |
| 16h | [External Worker](16h-credentials-external-worker.ts) | External worker credential resolution |
| 16i | [LangChain](16i-credentials-langchain.ts) | LangChain AgentExecutor with credential injection |
| 16j | [OpenAI SDK](16j-credentials-openai-sdk.ts) | OpenAI Agents SDK with credential injection |
| 16k | [Google ADK](16k-credentials-google-adk.ts) | Google ADK agent with credential injection |

## Deployment & Scheduling

| # | Example | What it demonstrates |
|---|---------|---------------------|
| 17 | [Scheduled Agent](17-scheduled-agent.ts) | Deploy an agent on a cron schedule |
| 63 | [Deploy](63-deploy.ts) | Register agent with the server |
| 63b | [Serve](63b-serve.ts) | Start a long-running worker |
| 63c | [Run by Name](63c-run-by-name.ts) | Execute a pre-deployed agent |
| 63d | [Serve from Package](63d-serve-from-package.ts) | Serve agents from a package |
| 63e | [Run Monitoring](63e-run-monitoring.ts) | Monitor running executions |

## End-to-End Use Cases

| # | Example | What it demonstrates |
|---|---------|---------------------|
| 54 | [Software Bug Assistant](54-software-bug-assistant.ts) | `agentTool` + `mcpTool` for bug triage |
| 55 | [ML Engineering](55-ml-engineering.ts) | Multi-agent ML pipeline |
| 56 | [RAG Agent](56-rag-agent.ts) | Vector search + document indexing |
| 59 | [Coding Agent](59-coding-agent.ts) | Write, review, and fix code with a QA tester |
| 60 | [GitHub Coding Agent](60-github-coding-agent.ts) | Pick an issue, code the fix, create a PR |
| 60a | [GitHub Coding Agent (Simple)](60a-github-coding-agent-simple.ts) | Simplified single-agent variant |
| 61 | [GitHub Coding Agent (Chained)](61-github-coding-agent-chained.ts) | Issue-to-PR pipeline |
| 70 | [CE Support Agent](70-ce-support-agent.ts) | Investigate a support ticket across Zendesk, JIRA, HubSpot, Notion, and GitHub |

## Framework Integrations

| Directory | Framework | Examples |
|-----------|-----------|----------|
| [adk/](adk/) | Google ADK | Agents, tools, streaming, planners, security |
| [langgraph/](langgraph/) | LangGraph | State graphs, react agents, memory, RAG |
| [openai/](openai/) | OpenAI Agents SDK | Agents, tools, handoffs, guardrails |
| [vercel-ai/](vercel-ai/) | Vercel AI SDK | Agents, tools, streaming, HITL |
| [quickstart/](quickstart/) | Agentspan Quickstart | Minimal getting-started guides |
