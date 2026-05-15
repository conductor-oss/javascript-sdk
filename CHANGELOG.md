# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Metrics harmonization** - canonical metric surface aligned with the cross-SDK catalog, opt-in via `WORKER_CANONICAL_METRICS=true`
  - New `CanonicalMetricsCollector` and optional `CanonicalPrometheusRegistry` (prom-client adapter) emit the harmonized cross-SDK catalog: 12 counters (e.g. `task_poll_total`, `task_execution_started_total`, `task_paused_total`, `external_payload_used_total{entityName,operation,payloadType}`, `workflow_start_error_total{workflowType,exception}`), 4 time histograms (`task_poll_time_seconds`, `task_execute_time_seconds`, `task_update_time_seconds`, `http_api_client_request_seconds{method,uri,status}`) with buckets `0.001…10s`, 2 size histograms (`task_result_size_bytes`, `workflow_input_size_bytes{workflowType,version}`) with buckets `100…10_000_000` bytes, and `active_workers` gauge. Labels are camelCase; names are unprefixed.
  - `createMetricsCollector()` factory selects `LegacyMetricsCollector` (default) or `CanonicalMetricsCollector` based on `WORKER_CANONICAL_METRICS` (truthy: `true`, `1`, `yes`, case-insensitive). `WORKER_LEGACY_METRICS` is also recognized; canonical wins when both are set.
  - `HttpMetricsObserver` plus `fetchWithRetry` instrumentation records `http_api_client_request_seconds`; `WorkflowExecutor` records `workflow_input_size_bytes` and `workflow_start_error_total`.
  - `Poller`, `TaskRunner`, and `EventDispatcher` emit a new `taskPaused` event when a poll cycle is skipped because the worker is paused.
  - `fetchWithRetry` now retries HTTP 502/503/504 for idempotent methods (GET, HEAD, OPTIONS, PUT, DELETE).
  - Harness deployment manifest sets `WORKER_CANONICAL_METRICS=true`; `harness/main.ts` logs which collector is active.

### Changed

- **Metrics harmonization** - defaults preserved; legacy metrics emit unchanged when `WORKER_CANONICAL_METRICS` is unset
  - `src/sdk/worker/metrics/MetricsCollector.ts` was renamed to `LegacyMetricsCollector.ts`. The public symbol is preserved via `export { LegacyMetricsCollector as MetricsCollector }` in `src/sdk/worker/metrics/index.ts`, so existing imports keep working.
  - Default behavior is unchanged: with no env var set, the metric names, labels, and `conductor_worker_*` prefix from `v3.0.3` are preserved byte-for-byte.
  - Rewrote `METRICS.md` with both surfaces, the env-var gate, side-by-side migration table with PromQL replacements, and troubleshooting.
  - Updated `README.md`, `AGENTS.md`, `SDK_DEVELOPMENT.md`, `SDK_COMPARISON.md`, and `WORKER_ARCHITECTURE_COMPARISON.md` to reference `createMetricsCollector()` and the env var.
