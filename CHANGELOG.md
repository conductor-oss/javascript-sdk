# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Durable AI agents** -- the Agentspan TypeScript SDK (`@conductor-oss/conductor-agent-sdk`) is merged into this package as new subpath exports: `@io-orkes/conductor-javascript/agents` (core: `Agent`, `AgentRuntime`, `tool`, guardrails, handoffs, memory, schedules, streaming, HITL), `/agents/testing`, and framework wrappers `/agents/vercel-ai`, `/agents/langgraph`, `/agents/langchain`. The agent clients are also first-class citizens of the root export (`AgentClient`, `WorkflowClient`, `Schedule`, `ScheduleInfo`, schedule errors) — the root surface grows additively (minor). Docs at [docs/agents/](docs/agents/README.md); 60+ examples at [examples/agents/](examples/agents/).
  - **Migration for `@conductor-oss/conductor-agent-sdk` users:** install `@io-orkes/conductor-javascript` and rewrite import specifiers -- `@conductor-oss/conductor-agent-sdk` becomes `@io-orkes/conductor-javascript/agents`, and the wrapper subpaths gain the `/agents` prefix (e.g. `.../vercel-ai` becomes `.../agents/vercel-ai`). APIs, behavior, and `AGENTSPAN_*` env vars are unchanged.
  - New optional peer dependencies (all lazily resolved, install only what you use): `zod`, `zod-to-json-schema`, `ai`, `@langchain/core`, `@langchain/langgraph`. `dotenv` becomes a runtime dependency (the agent entry points load it at import time; the package `sideEffects` field allowlists `dist/agents/**` so bundlers keep that bootstrap).
- **Agent clients in `sdk/clients`** -- `AgentClient` and the agent-flavored `WorkflowClient` moved to `src/sdk/clients/agent/` and are exposed by the factory: `OrkesClients.getAgentClient()` / `getAgentWorkflowClient()`. `AgentClient` accepts an optional pre-built client (`new AgentClient({ client })`) to reuse one Conductor client across surfaces. Naming note: `getWorkflowClient()` returns the general-purpose `WorkflowExecutor`; the agent `WorkflowClient` adds the agent-execution 404 fallback and token-usage rollup.
- **`SchedulerClient` pause/resume works on both server families** -- per-schedule pause/resume verbs differ by Conductor family (OSS/embedded map them PUT-only, Orkes GET-only). `pauseSchedule`/`resumeSchedule` now issue PUT first and retry via GET only on HTTP 405 (stateless per call; the new optional `reason` on pause survives the fallback). Previously the GET-only calls failed against OSS/embedded servers. Admin bulk endpoints are unchanged.
- **`SchedulerClient` typed agent-schedule lifecycle** -- absorbed from the deleted agent `ScheduleClient` (below): `save`/`get`/`listForAgent`/`pause`/`resume`/`delete`/`runNow`/`previewNext`/`reconcile` operating on `Schedule`/`ScheduleInfo` with `${agent}-${name}` wire-name prefixing and typed errors (`ScheduleNotFound`, `ScheduleNameConflict`, `InvalidCronExpression`). The constructor also accepts `PromiseLike<Client>` for callers with async client construction.
- **Canonical metrics** -- opt-in harmonized metric surface via `WORKER_CANONICAL_METRICS=true`. See [METRICS.md](METRICS.md) for the full catalog, configuration, and migration guide.
- Bounded `uri` label on `http_api_client_request_seconds`: canonical mode uses path templates (e.g. `/workflow/{workflowId}`) instead of fully-resolved paths, preventing metric cardinality explosion from dynamic IDs.
- `TaskPaused` event type and `PollerOptions.onPaused` callback: emitted when a poll cycle is skipped because the worker is paused. Canonical mode records `task_paused_total`; legacy mode does not (see Implementation Notes in METRICS.md).
- `measurePayloadSize` option in `MetricsCollectorConfig`: controls whether `workflow_input_size_bytes` is recorded via `JSON.stringify` on each `startWorkflow` call. Defaults to `true` for canonical, `false` for legacy.
- `retryServerErrors` option in `OrkesApiConfig` / `RetryFetchOptions` and `CONDUCTOR_RETRY_SERVER_ERRORS` env var: opt-in retry of HTTP 502/503/504 for idempotent methods (GET, HEAD, OPTIONS, PUT, DELETE). Default `false`; set to `true` to enable.
- `WorkflowStatusProbe` in harness: opt-in probe (via `HARNESS_PROBE_RATE_PER_SEC`) that exercises UUID-bearing endpoints to validate template URI metrics.
- `WORKER_LEGACY_METRICS` is reserved for future use. Once canonical metrics become the default, setting `WORKER_LEGACY_METRICS=true` will re-activate the legacy surface. It is not read by the current implementation.

### Changed

- Legacy metrics emit unchanged when constructing `LegacyMetricsCollector` directly (the pre-existing pattern). Using `createMetricsCollector()` additionally enables automatic HTTP request timing via OpenAPI interceptors for both legacy and canonical modes; no other action required for existing deployments.
- `MetricsCollector.ts` renamed to `LegacyMetricsCollector.ts`; the public symbol is preserved via re-export so existing imports keep working.
- `http_api_client_request` timing is now recorded automatically by `wrapFetchWithRetry` when a metrics collector is active (via `createMetricsCollector()` or `setHttpMetricsObserver`), covering both successful responses and network-error fallback paths. A lightweight request interceptor captures OpenAPI path templates so the canonical `uri` label uses bounded-cardinality templates in all cases. Previously, `recordApiRequestTime` existed but was not wired into the HTTP pipeline -- [details](METRICS.md#implementation-notes).
- Added optional `durationMs` field to `TaskUpdateFailure` event, recording the duration of the last update attempt. Declared optional so existing event listener implementations are unaffected.

### Removed

- **Agent `ScheduleClient` and `SchedulerFetcher`** (agents subpath; never released, no backward compatibility) -- schedules now ride the SDK `SchedulerClient`, re-exported from `@io-orkes/conductor-javascript/agents`. Method names and signatures are unchanged; migration is the import/type rename only (`ScheduleClient` -> `SchedulerClient`). The `schedules.*` namespace, `runtime.schedulesClient()`, `deploy({ schedules })` and `AgentClient.schedule()` are untouched.

### Deprecated

- Legacy metric names remain the default during the transition period. Migration guidance is in [METRICS.md](METRICS.md#migrating-from-legacy-to-canonical).
