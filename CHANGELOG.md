# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
- `http_api_client_request` timing is now recorded automatically via OpenAPI client request/response interceptors when a metrics collector is active (via `createMetricsCollector()` or `setHttpMetricsObserver`). Previously, `recordApiRequestTime` existed but was not wired into the HTTP pipeline -- [details](METRICS.md#implementation-notes).
- Added optional `durationMs` field to `TaskUpdateFailure` event, recording the duration of the last update attempt. Declared optional so existing event listener implementations are unaffected.

### Deprecated

- Legacy metric names remain the default during the transition period. Migration guidance is in [METRICS.md](METRICS.md#migrating-from-legacy-to-canonical).
