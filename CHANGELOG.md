# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Canonical metrics: opt-in harmonized metric surface via `WORKER_CANONICAL_METRICS=true` -- see [METRICS.md](METRICS.md) for the full catalog, configuration, and migration guide
- Bounded `uri` label on `http_api_client_request_seconds`: canonical mode uses path templates (e.g. `/workflow/{workflowId}`) instead of fully-resolved paths, preventing metric cardinality explosion from dynamic IDs
- `WorkflowStatusProbe` in harness: opt-in probe (via `HARNESS_PROBE_RATE_PER_SEC`) that exercises UUID-bearing endpoints to validate template URI metrics
- `fetchWithRetry` now retries HTTP 502/503/504 for idempotent methods (GET, HEAD, OPTIONS, PUT, DELETE)

### Changed

- Legacy metrics emit unchanged by default; no action required for existing deployments
- `MetricsCollector.ts` renamed to `LegacyMetricsCollector.ts`; the public symbol is preserved via re-export so existing imports keep working
- HTTP metrics recording moved from `fetchWithRetry` to OpenAPI client interceptors -- [details](METRICS.md#detailed-technical-notes----unreleased)

### Deprecated

- Legacy metric names remain the default. Migration guidance is in [METRICS.md](METRICS.md#migrating-from-legacy-to-canonical).
