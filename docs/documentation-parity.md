# JS/Java/Python documentation parity

Java and Python follow a shared documentation architecture: a set of core
guides (server setup, quickstart, workflows, workers, lifecycle, testing), a
set of operations guides (schema client, schedules/events, reliability,
security, deployment, observability, debugging), and an agent doc tree split
into `agents/concepts/*`, `agents/reference/*`, and `agents/frameworks/*`.

The JS SDK's doc tree now follows the same structure for both halves. The
agent doc tree matches content topic-by-topic against Python's
`concepts/`/`reference/` files (four small doc-only gaps found and closed
earlier: memory usage guidance, the agent-schema wire-contract reference,
naming the crash-recovery pattern, and documenting the automatic
SSE-fallback behavior). The core/operations guide split is new short landing
pages that link into JS's existing deep content (root `README.md` sections,
`docs/api-reference/*.md`, `METRICS.md`, `LEASE_EXTENSION.md`) rather than
newly-authored deep reference material — the same relationship Python's own
thin guides have to its deeper `WORKFLOW.md`/`WORKER.md`/`TASK_MANAGEMENT.md`
pages.

| Java documentation capability | Python counterpart | JS current counterpart | Status |
|---|---|---|---|
| Server, connection, quickstart, workflows, workers, lifecycle, testing, message queue | [Core guides](https://github.com/conductor-oss/python-sdk/blob/main/docs/README.md#build) | [Core guides](README.md#start-here) — `server-setup.md`, `connection-authentication.md`, `core-quickstart.md`, `workflows.md`, `workflow-lifecycle.md`, `workers.md`, `workflow-testing.md`, `workflow-message-queue.md` | Matches Java/Python structurally. `workflow-testing.md` is a short landing page pointing at the runnable example, not a deep reference on Python's `WORKFLOW_TESTING.md` scale (999 lines) — same category as the operations-guide gap below |
| Schema client, schedules/events, reliability, security, deployment, observability, debugging | Operations guides | [Operations guides](README.md#operate) — `schema-client.md`, `schedules-events.md`, `reliability.md`, `security.md`, `deployment-scaling.md`, `observability.md`, `debugging.md` | Matches Java/Python structurally. `schema-client.md`/`security.md` are honest landing pages — `SchemaClient`/`SecretClient`/`AuthorizationClient`/`IntegrationClient` don't have dedicated API reference pages yet (see JS-only-by-design pages below); that's separate content-authoring work, not a structural gap |
| Agent concepts, runtime, API/client, definition contract | `docs/agents/{README,concepts/*,reference/*}` | `docs/agents/{README,getting-started,concepts/*,reference/*}` — same structure, content-checked topic by topic | Matches Java/Python. Old flat `advanced.md`/`api-reference.md`/`framework-agents.md`/`writing-agents.md` kept as redirect stubs (same pattern Python itself uses for its own superseded pages) |
| Framework bridges: Google ADK, LangChain4j, LangGraph4j (Java) / Google ADK, LangChain, LangGraph, OpenAI Agents, Claude Agent SDK (Python) | `agents/frameworks/*.md`, one file per bridge | `docs/agents/frameworks/{google-adk,langchain,langgraph,openai,vercel-ai}.md` | JS supports Google ADK, OpenAI Agents SDK, LangChain, and LangGraph — the same set Python has via detection — plus **Vercel AI** (JS/Node-ecosystem-specific, no Java/Python counterpart). The one real gap: no bridge for a native `@anthropic-ai/claude-agent-sdk` object (Python's `claude-agent-sdk.md`); JS instead has a differently-shaped `ClaudeCode(modelName?, permissionMode?)` model-string passthrough (see [API map](agents/reference/api.md#other-exports)), not an object-detection bridge, so it isn't a like-for-like substitute |
| Workflow-scoped `FileClient` | Not currently exposed as a public Python client | Also not currently exposed | Matches Python; not a JS-specific gap |
| Spring / Spring Boot integration | Not applicable (Java-specific) | Not applicable (Node ecosystem) | Matches Python; not applicable |

## Python's legacy deep-reference docs

Python's short landing pages mostly link into large, pre-existing legacy
reference docs rather than being deep content themselves. Every one of those
legacy docs maps to an existing or gap-tracked JS page — none are
unaccounted for:

| Python legacy doc | JS equivalent |
|---|---|
| `WORKER.md` | [README's Workers section](../README.md#workers) + [task-manager.md](api-reference/task-manager.md) |
| `WORKFLOW.md` | [workflow-executor.md](api-reference/workflow-executor.md) + [task-generators.md](api-reference/task-generators.md) |
| `TASK_MANAGEMENT.md` | [task-client.md](api-reference/task-client.md) + [task-manager.md](api-reference/task-manager.md) |
| `SCHEDULE.md` | [scheduler-client.md](api-reference/scheduler-client.md) |
| `METADATA.md` | [metadata-client.md](api-reference/metadata-client.md) |
| `LEASE_EXTENSION.md` | Same file, kept at JS's existing root path: [`LEASE_EXTENSION.md`](../LEASE_EXTENSION.md) |
| `workflow-message-queue.md` | [workflow-message-queue.md](workflow-message-queue.md) + [agents/concepts/tools.md](agents/concepts/tools.md#waitformessagetool--workflow-message-queue) |
| `SECRET_MANAGEMENT.md` | No dedicated reference page yet — `SecretClient` gap, see [security.md](security.md) |
| `AUTHORIZATION.md` | No dedicated reference page yet — `AuthorizationClient` gap, see [security.md](security.md) |
| `INTEGRATION.md` | No dedicated reference page yet — `IntegrationClient` gap, see [security.md](security.md) |
| `PROMPT.md` | No dedicated reference page yet — `PromptClient` gap |
| `WORKFLOW_TESTING.md` | `workflow-testing.md` landing page only — no deep reference yet, same gap category as the four rows above |

## Python-only internal design docs

`docs/design/{AGENT_SDK_PORTING_SPEC,event_driven_interceptor_system,
lease-extension,WORKER_DESIGN,WORKER_SDK_IMPLEMENTATION_GUIDE}.md` are
Python's own internal design/porting-spec records — maintainer-facing
history of how Python's SDK was built, not user-facing capability docs. JS
has the same kind of internal record in `docs/design/api_client.md` and
`docs/superpowers/**`. Neither side's internal design docs are meant to be
ported cross-SDK; they aren't tracked as gaps.

## JS-only-by-design pages

These exist only in the JS SDK and are intentional, not gaps against
Java/Python:

- `docs/api-reference/*.md` (11 files) — one reference page per client
  (`application-client.md`, `task-client.md`, `workflow-executor.md`, ...);
  JS's own reference-doc convention, predates this alignment effort. Five
  clients that exist in source (`AuthorizationClient`, `IntegrationClient`,
  `PromptClient`, `SchemaClient`, `SecretClient`) still have no reference
  page — `schema-client.md`/`security.md` link to their API-journey example
  scripts in the meantime. Authoring the five missing pages is content work,
  tracked separately from this alignment pass.
- `docs/design/api_client.md` — internal design rationale for the generated
  API client layer
- `docs/superpowers/**` — maintainer-facing plans/specs, not user docs
- Root comparison/dev docs: `API_CLIENT_COMPARISON.md`, `SDK_COMPARISON.md`,
  `SDK_DEVELOPMENT.md`, `SDK_NEW_LANGUAGE_GUIDE.md`,
  `WORKER_ARCHITECTURE_COMPARISON.md`, `WORKFLOW_BUILDER_COMPARISON.md`,
  `BREAKING_CHANGES.md`, `DECISIONS.md`, `METRICS.md`, `OPEN-API-README.md`,
  `REVIEW.md` — contributor-facing, predate the Java/Python doc architecture

## Maintenance rule

When JS gains a page or bridge from the tables above, update this map (and
[docs/README.md](README.md)) in the same change. Do not claim a Java/Python
guide, reference page, or framework bridge exists in JS before it actually
ships.
