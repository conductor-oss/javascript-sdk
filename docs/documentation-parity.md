# JS/Java/Python documentation parity

Java and Python already follow a shared documentation architecture: a set of
core guides (server setup, quickstart, workflows, workers, lifecycle,
testing), a set of operations guides (schema client, schedules/events,
reliability, security, deployment, observability, debugging), and an agent
doc tree split into `agents/concepts/*`, `agents/reference/*`, and
`agents/frameworks/*`.

The JS SDK has the same agent-layer *content* — `Agent`, `AgentRuntime`,
tools, guardrails, handoffs, memory, schedules, streaming, HITL are all
present and documented — but not yet the same *structure*. This page records
that gap honestly rather than implying parity that doesn't exist yet.

| Java documentation capability | Python counterpart | JS current counterpart | Status |
|---|---|---|---|
| Server, connection, quickstart, workflows, workers, lifecycle, testing | [Core guides](https://github.com/conductor-oss/python-sdk/blob/main/docs/README.md#build) | Covered informally across root `README.md`, `AGENTS.md`, `SDK_DEVELOPMENT.md` — no dedicated core-guide files | Gap — not yet split into core guides; unplanned structural work |
| Schema client, schedules/events, reliability, security, deployment, observability, debugging | Operations guides | No equivalent standalone guides; partial coverage in `METRICS.md` (observability) and `LEASE_EXTENSION.md` (reliability) | Gap — same unplanned scope |
| Agent concepts, runtime, API/client, definition contract | `docs/agents/{README,concepts/*,reference/*}` | `docs/agents/{README,getting-started,advanced,api-reference,writing-agents}.md` — same content, flat structure | Content parity, structural gap |
| Framework bridges: Google ADK, LangChain4j, LangGraph4j (Java) / Google ADK, LangChain, LangGraph, OpenAI Agents, Claude Agent SDK (Python) | `agents/frameworks/*.md`, one file per bridge | LangChain, LangGraph, and **Vercel AI** (JS/Node-ecosystem-specific — no Java/Python counterpart), documented together in one combined `docs/agents/framework-agents.md` | JS supports a different, smaller framework set (no Google ADK, OpenAI Agents, or Claude Agent SDK bridge) plus one JS-only bridge. For the bridges that do exist: still flat, not per-framework files |
| Workflow-scoped `FileClient` | Not currently exposed as a public Python client | Also not currently exposed | Matches Python; not a JS-specific gap |
| Spring / Spring Boot integration | Not applicable (Java-specific) | Not applicable (Node ecosystem) | Matches Python; not applicable |

## JS-only-by-design pages

These exist only in the JS SDK and are intentional, not gaps against
Java/Python:

- `docs/api-reference/*.md` (11 files) — one reference page per client
  (`application-client.md`, `task-client.md`, `workflow-executor.md`, ...);
  JS's own reference-doc convention, predates this alignment effort
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
