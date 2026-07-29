# JS/Java/Python documentation parity

Java and Python already follow a shared documentation architecture: a set of
core guides (server setup, quickstart, workflows, workers, lifecycle,
testing), a set of operations guides (schema client, schedules/events,
reliability, security, deployment, observability, debugging), and an agent
doc tree split into `agents/concepts/*`, `agents/reference/*`, and
`agents/frameworks/*`.

The JS SDK's agent doc tree now follows the same structure and, per a
topic-by-topic content check against Python's `concepts/`/`reference/` files,
the same content (four small doc-only gaps found and closed: memory usage
guidance, the agent-schema wire-contract reference, naming the crash-recovery
pattern, and documenting the automatic SSE-fallback behavior). The
core/operations guide split (below) remains unplanned structural work — a
separate, larger content-authoring effort.

| Java documentation capability | Python counterpart | JS current counterpart | Status |
|---|---|---|---|
| Server, connection, quickstart, workflows, workers, lifecycle, testing | [Core guides](https://github.com/conductor-oss/python-sdk/blob/main/docs/README.md#build) | Covered informally across root `README.md`, `AGENTS.md`, `SDK_DEVELOPMENT.md` — no dedicated core-guide files | Gap — not yet split into core guides; unplanned structural work |
| Schema client, schedules/events, reliability, security, deployment, observability, debugging | Operations guides | No equivalent standalone guides; partial coverage in `METRICS.md` (observability) and `LEASE_EXTENSION.md` (reliability) | Gap — same unplanned scope |
| Agent concepts, runtime, API/client, definition contract | `docs/agents/{README,concepts/*,reference/*}` | `docs/agents/{README,getting-started,concepts/*,reference/*}` — same structure, content-checked topic by topic | Matches Java/Python. Old flat `advanced.md`/`api-reference.md`/`framework-agents.md`/`writing-agents.md` kept as redirect stubs (same pattern Python itself uses for its own superseded pages) |
| Framework bridges: Google ADK, LangChain4j, LangGraph4j (Java) / Google ADK, LangChain, LangGraph, OpenAI Agents, Claude Agent SDK (Python) | `agents/frameworks/*.md`, one file per bridge | `docs/agents/frameworks/{google-adk,langchain,langgraph,openai,vercel-ai}.md` | JS supports Google ADK, OpenAI Agents SDK, LangChain, and LangGraph — the same set Python has via detection — plus **Vercel AI** (JS/Node-ecosystem-specific, no Java/Python counterpart). The one real gap: no bridge for a native `@anthropic-ai/claude-agent-sdk` object (Python's `claude-agent-sdk.md`); JS instead has a differently-shaped `ClaudeCode(modelName?, permissionMode?)` model-string passthrough (see [API map](agents/reference/api.md#other-exports)), not an object-detection bridge, so it isn't a like-for-like substitute |
| Workflow-scoped `FileClient` | Not currently exposed as a public Python client | Also not currently exposed | Matches Python; not a JS-specific gap |
| Spring / Spring Boot integration | Not applicable (Java-specific) | Not applicable (Node ecosystem) | Matches Python; not applicable |

> **Correction (this pass):** an earlier version of this map claimed JS
> lacked Google ADK and OpenAI Agents SDK bridges entirely. That was wrong —
> both are supported via the same duck-typing `detectFramework()` mechanism
> Python uses its own detection for; `docs/agents/frameworks/google-adk.md`
> and `openai.md` document them. Verified directly against
> `src/agents/frameworks/detect.ts`, not just prior doc text.

## JS-only-by-design pages

These exist only in the JS SDK and are intentional, not gaps against
Java/Python:

- `docs/api-reference/*.md` (11 files) — one reference page per client
  (`application-client.md`, `task-client.md`, `workflow-executor.md`, ...);
  JS's own reference-doc convention, predates this alignment effort. Five
  clients that exist in source (`AuthorizationClient`, `IntegrationClient`,
  `PromptClient`, `SchemaClient`, `SecretClient`) have no reference page yet —
  the root `README.md` table used to link to these five as if they did
  (broken links, found via the new link-check CI guard, fixed by removing
  the dead links). Authoring the five missing pages is content work, tracked
  separately from this alignment pass.
- `docs/design/api_client.md` — internal design rationale for the generated
  API client layer
- `docs/superpowers/**` — maintainer-facing plans/specs, not user docs
- Root comparison/dev docs: `API_CLIENT_COMPARISON.md`, `SDK_COMPARISON.md`,
  `SDK_DEVELOPMENT.md`, `SDK_NEW_LANGUAGE_GUIDE.md`,
  `WORKER_ARCHITECTURE_COMPARISON.md`, `WORKFLOW_BUILDER_COMPARISON.md`,
  `BREAKING_CHANGES.md`, `DECISIONS.md`, `METRICS.md`, `OPEN-API-README.md`,
  `REVIEW.md` — contributor-facing, predate the Java/Python doc architecture

## One shared loose end: `LEASE_EXTENSION.md`

Both JS (repo root) and Python (`docs/LEASE_EXTENSION.md`) still carry a
standalone lease-extension/heartbeat guide that predates their respective
`reliability.md`/`workers.md` guides. In Python it's reachable only from the
legacy `docs/WORKER.md`, not from the new documentation hub. JS has no
`reliability.md`/`workers.md` yet at all, so [docs/README.md](README.md)
below links directly to `LEASE_EXTENSION.md` to avoid an orphaned page. This
is a cross-SDK loose end, not a JS-specific gap; folding its content into
`workers.md`/`reliability.md` is unplanned future work, contingent on those
guides existing first.

## Maintenance rule

When JS gains one of the guides listed above as a gap, update this map (and
[docs/README.md](README.md)) in the same change. Do not claim a Java/Python
guide or framework bridge exists in JS before the page or bridge actually
ships.
