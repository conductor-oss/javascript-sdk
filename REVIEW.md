# Conductor OSS JavaScript/TypeScript SDK - Code Review

## Overview

This is the official TypeScript/JavaScript SDK (`@io-orkes/conductor-javascript` v3.0.0) for [Conductor OSS](https://github.com/conductor-oss/conductor), an open-source workflow orchestration platform. The SDK enables developers to define workflows, register task/workflow metadata, poll and execute worker tasks, schedule workflows, manage events, handle human tasks, and interact with a service registry -- all from Node.js (>=18) or browser environments.

Licensed under Apache-2.0. Published as both CJS and ESM via `tsup`.

---

## Architecture

The SDK follows a **layered architecture** with three distinct layers:

```
index.ts
  ├── src/open-api/          ← Layer 1: Auto-generated OpenAPI client (DO NOT MODIFY)
  └── src/sdk/               ← Layer 2 & 3: SDK abstractions and high-level clients
        ├── createConductorClient/   ← Client factory (auth, fetch, config)
        ├── clients/                 ← High-level domain clients
        ├── builders/                ← Workflow/task definition builders
        ├── generators/              ← Task definition test generators
        ├── worker/                  ← @worker decorator & TaskHandler system
        ├── helpers/                 ← Logger, error handling
        └── types.ts                 ← Core SDK types (OrkesApiConfig, etc.)
```

### Layer 1: OpenAPI Generated Code (`src/open-api/generated/`)

- Auto-generated using [`@hey-api/openapi-ts`](https://github.com/hey-api/openapi-ts) from the Conductor server's OpenAPI spec.
- Provides typed resource classes (e.g., `WorkflowResource`, `TaskResource`, `MetadataResource`, `SchedulerResource`, `EventResource`, `ServiceRegistryResource`, `HumanTask`, etc.) that map directly to REST API endpoints.
- **Must not be modified directly** -- regenerated from `src/open-api/spec/spec.json`.
- The `src/open-api/types.ts` file extends generated types to fix OpenAPI spec gaps (e.g., `ExtendedTaskDef`, `SignalResponse`, `AccessKey`, `ApplicationRole`).
- Legacy/deprecated types are re-exported from `src/open-api/deprecated-types.ts` for backward compatibility.

### Layer 2: Client Factory (`src/sdk/createConductorClient/`)

The `createConductorClient()` async function is the main entry point for creating an authenticated SDK client:

```typescript
const client = await createConductorClient({
  serverUrl: "https://my-conductor.example.com",
  keyId: "my-key",
  keySecret: "my-secret",
});
```

Internally it:

1. **Resolves configuration** (`resolveOrkesConfig`): Merges code-provided config with environment variables (`CONDUCTOR_SERVER_URL`, `CONDUCTOR_AUTH_KEY`, `CONDUCTOR_AUTH_SECRET`, `CONDUCTOR_MAX_HTTP2_CONNECTIONS`, `CONDUCTOR_REQUEST_TIMEOUT_MS`). Numeric env vars are parsed with explicit NaN checks so `0` is a valid value.
2. **Resolves fetch function** (`resolveFetchFn`): Prefers user-provided custom fetch, otherwise attempts undici-based HTTP/2 fetch (optional dependency), falls back to native `fetch`.
3. **Wraps with retry** (`wrapFetchWithRetry`): Automatically retries on:
   - **HTTP 429** (rate limit) with exponential backoff (up to 5 retries)
   - **HTTP 401/403** (auth failure) with token refresh and single retry
   - **Transport errors** (ECONNRESET, etc.) with linear backoff (up to 3 retries)
   - **Request timeouts** via `AbortSignal.timeout()` (default 60s, configurable)
4. **Handles authentication** (`handleAuth`): Token management with:
   - Pre-request TTL check (inline refresh if token older than 45 minutes)
   - Background refresh on interval (capped at 80% of token TTL)
   - Exponential backoff on consecutive failures (2^n seconds, capped at 60s)
   - OSS auto-detection (404 on `/api/token` disables auth gracefully)
   - `stopBackgroundRefresh()` for cleanup
5. **Adds backward compatibility** (`addResourcesBackwardCompatibility`): Attaches legacy resource-based methods (e.g., `client.workflowResource.startWorkflow()`) that emit deprecation warnings, maintaining v2 API compatibility.

### Layer 3: High-Level Domain Clients (`src/sdk/clients/`)

These provide ergonomic, typed wrappers around the generated OpenAPI resource classes. Each client takes a `Client` (the OpenAPI client) in its constructor and provides domain-specific methods with consistent error handling via `handleSdkError()`.

---

## Domain Clients

### WorkflowExecutor (`src/sdk/clients/workflow/WorkflowExecutor.ts`)

The primary class for workflow lifecycle management:

| Method | Description |
|--------|-------------|
| `registerWorkflow(override, workflowDef)` | Register/update a workflow definition |
| `startWorkflow(request)` | Start a workflow, returns instance ID |
| `executeWorkflow(request, name, version, requestId, ...)` | Execute workflow synchronously (overloaded: basic or with return strategy) |
| `startWorkflows(requests)` | Start multiple workflows in parallel |
| `getWorkflow(id, includeTasks, retry)` | Get workflow execution with retry logic |
| `getWorkflowStatus(id, includeOutput, includeVariables)` | Get workflow status summary |
| `getExecution(id, includeTasks)` | Get full execution details |
| `pause(id)` / `resume(id)` | Pause/resume a workflow |
| `reRun(id, request)` | Re-run a workflow |
| `restart(id, useLatestDefinitions)` | Restart a workflow |
| `retry(id, resumeSubworkflowTasks)` | Retry from last failure |
| `terminate(id, reason)` | Terminate a workflow |
| `search(start, size, query, freeText, sort, skipCache)` | Search workflows |
| `skipTasksFromWorkflow(id, taskRefName, request)` | Skip a task |
| `updateTask(taskId, workflowId, status, output)` | Update a task result |
| `updateTaskByRefName(refName, workflowId, status, output)` | Update task by reference name |
| `updateTaskSync(refName, workflowId, status, output, workerId)` | Synchronous task update |
| `signal(workflowId, status, output, returnStrategy)` | Signal a workflow task (sync) |
| `signalAsync(workflowId, status, output)` | Signal a workflow task (fire-and-forget) |
| `goBackToTask(workflowId, predicate, overrides)` | Re-run from a specific previous task |
| `goBackToFirstTaskMatchingType(workflowId, taskType)` | Re-run from first task of given type |
| `getTask(taskId)` | Get task details |

Supports `ReturnStrategy` (`TARGET_WORKFLOW`, `BLOCKING_WORKFLOW`, `BLOCKING_TASK`, `BLOCKING_TASK_INPUT`) and `Consistency` (`SYNCHRONOUS`, `DURABLE`, `REGION_DURABLE`) modes for `executeWorkflow`.

### MetadataClient (`src/sdk/clients/metadata/MetadataClient.ts`)

Task and workflow definition CRUD:

- `registerTask(taskDef)` / `registerTasks(taskDefs)` / `updateTask(taskDef)` / `unregisterTask(name)` / `getTask(name)`
- `registerWorkflowDef(workflowDef, overwrite)` / `getWorkflowDef(name, version, metadata)` / `unregisterWorkflow(name, version)`

### TaskClient (`src/sdk/clients/task/TaskClient.ts`)

Task search and update:

- `search(start, size, sort, freeText, query)`
- `getTask(taskId)`
- `updateTaskResult(workflowId, taskRefName, status, outputData)`

### SchedulerClient (`src/sdk/clients/scheduler/SchedulerClient.ts`)

Cron-based workflow scheduling:

- `saveSchedule(request)` / `getSchedule(name)` / `deleteSchedule(name)`
- `pauseSchedule(name)` / `resumeSchedule(name)`
- `getAllSchedules(workflowName?)` / `search(start, size, sort, freeText, query)`
- `getNextFewSchedules(cronExpression, start?, end?, limit)`
- `pauseAllSchedules()` / `resumeAllSchedules()` / `requeueAllExecutionRecords()`

### EventClient (`src/sdk/clients/event/EventClient.ts`)

Event handler and queue management:

- Event handlers: `getAllEventHandlers()`, `addEventHandler(handler)`, `updateEventHandler(handler)`, `getEventHandlerByName(name)`, `getEventHandlersForEvent(event, activeOnly)`, `removeEventHandler(name)`, `handleIncomingEvent(data)`
- Queue configs: `getAllQueueConfigs()`, `getQueueConfig(type, name)`, `putQueueConfig(type, name, config)`, `deleteQueueConfig(type, name)`
- Tags: `getTagsForEventHandler(name)`, `putTagForEventHandler(name, tags)`, `deleteTagsForEventHandler(name, tags)`
- Event executions & messages: `getAllActiveEventHandlers()`, `getEventExecutions(handlerName, from)`, `getEventHandlersWithStats(from)`, `getEventMessages(event, from)`
- Connectivity: `testConnectivity(input)`

### ApplicationClient (`src/sdk/clients/application/ApplicationClient.ts`)

Application and access key management (for Orkes-specific access control):

- Applications: `getAllApplications()`, `createApplication(name)`, `getApplication(id)`, `updateApplication(id, name)`, `deleteApplication(id)`, `getAppByAccessKeyId(keyId)`
- Access keys: `createAccessKey(appId)`, `getAccessKeys(appId)`, `deleteAccessKey(appId, keyId)`, `toggleAccessKeyStatus(appId, keyId)`
- Roles: `addApplicationRole(appId, role)`, `removeRoleFromApplicationUser(appId, role)`
- Tags: `addApplicationTags(appId, tags)`, `getApplicationTags(appId)`, `deleteApplicationTags(appId, tags)`

### ServiceRegistryClient (`src/sdk/clients/service-registry/ServiceRegistryClient.ts`)

Service registry for HTTP, gRPC, and MCP remote services:

- Services: `getRegisteredServices()`, `getService(name)`, `addOrUpdateService(registry)`, `removeService(name)`, `discover(name, create)`
- Methods: `addOrUpdateServiceMethod(registryName, method)`, `removeMethod(registryName, serviceName, method, methodType)`
- Circuit breaker: `openCircuitBreaker(name)`, `closeCircuitBreaker(name)`, `getCircuitBreakerStatus(name)`
- Proto files: `getProtoData(registryName, filename)`, `setProtoData(registryName, filename, data)`, `deleteProto(registryName, filename)`, `getAllProtos(registryName)`

### HumanExecutor (`src/sdk/clients/human/HumanExecutor.ts`)

Human-in-the-loop task management:

- `search(searchParams)` / `pollSearch(searchParams, pollOptions)`
- `getTaskById(taskId)` / `getTasksByFilter(state, assignee, ...)` (deprecated)
- `claimTaskAsExternalUser(taskId, assignee, options)` / `claimTaskAsConductorUser(taskId, options)`
- `releaseTask(taskId)` / `updateTaskOutput(taskId, body)` / `completeTask(taskId, body)`
- `getTemplateByNameVersion(name, version)` / `getTemplateById(name)` (deprecated)

### TemplateClient (`src/sdk/clients/template/TemplateClient.ts`)

- `registerTemplate(template, asNewVersion)`

---

## Worker System

The SDK provides two approaches for worker implementation:

### 1. SDK-Style: `@worker` Decorator + `TaskHandler` (Recommended)

Inspired by the Python SDK's `@worker_task` pattern:

```typescript
import { worker, TaskHandler, createConductorClient } from "@io-orkes/conductor-javascript";

@worker({ taskDefName: "process_order", concurrency: 5, pollInterval: 200 })
async function processOrder(task: Task): Promise<TaskResult> {
  return { status: "COMPLETED", outputData: { processed: true } };
}

const client = await createConductorClient({ serverUrl: "..." });
const handler = new TaskHandler({ client, scanForDecorated: true });
handler.startWorkers();
```

**Components:**

- **`@worker` decorator** (`src/sdk/worker/decorators/worker.ts`): Registers functions in a global `WorkerRegistry` singleton.
- **`WorkerRegistry`** (`src/sdk/worker/decorators/registry.ts`): Global Map-based registry keyed by `taskDefName:domain`. Provides `getRegisteredWorkers()`, `getRegisteredWorker()`, `clearWorkerRegistry()`.
- **`TaskHandler`** (`src/sdk/worker/core/TaskHandler.ts`): Orchestrator that auto-discovers decorated workers, creates `TaskRunner` instances, and manages their lifecycle. Supports `TaskHandler.create()` for async module imports. Implements `Symbol.asyncDispose` for cleanup.
- **`WorkerConfig`** (`src/sdk/worker/config/WorkerConfig.ts`): Hierarchical configuration resolution with environment variable override support:
  1. Worker-specific env: `CONDUCTOR_WORKER_<NAME>_<PROPERTY>` or `conductor.worker.<name>.<property>`
  2. Global env: `CONDUCTOR_WORKER_ALL_<PROPERTY>` or `conductor.worker.all.<property>`
  3. Code-level defaults (decorator parameters)
  4. System defaults

### 2. Legacy: `TaskManager` + `ConductorWorker` Interface

```typescript
const manager = new TaskManager(client, [
  { taskDefName: "my_task", execute: async (task) => ({ status: "COMPLETED", outputData: {} }) }
], { options: { concurrency: 5 } });
manager.startPolling();
```

**Components:**

- **`TaskManager`** (`src/sdk/clients/worker/TaskManager.ts`): Creates and manages `TaskRunner` instances per worker. Validates no duplicate `taskDefName`. Supports dynamic option updates.
- **`TaskRunner`** (`src/sdk/clients/worker/TaskRunner.ts`): The core poll-execute-update loop for a single task type.
- **`Poller`** (`src/sdk/clients/worker/Poller.ts`): Generic poller with concurrency control. Polls for available capacity (`concurrency - tasksInProcess`), dispatches work without waiting (fire-and-forget), and uses `setTimeout`-based intervals.

### Task Execution Flow

```
Poller.poll() → TaskRunner.batchPoll() → TaskResource.batchPoll() → Conductor Server
    ↓
Poller.performWork() → TaskRunner.executeTask()
    ↓
worker.execute(task) → user function
    ↓
TaskRunner.updateTaskWithRetry() → TaskResource.updateTask() → Conductor Server
```

**Error Handling:**
- **`NonRetryableException`**: Marks task as `FAILED_WITH_TERMINAL_ERROR` (no retry).
- Regular exceptions: Marks task as `FAILED` (retryable per task definition).
- Task update retries: Exponential backoff (10s, 20s, 30s, 40s) up to `MAX_RETRIES` (4 attempts, matching Python SDK).

### Event System

The `EventDispatcher` publishes lifecycle events to registered `TaskRunnerEventsListener` instances:

| Event | When |
|-------|------|
| `PollStarted` | Before each batch poll |
| `PollCompleted` | After successful poll (includes `tasksReceived` count, `durationMs`) |
| `PollFailure` | When poll fails |
| `TaskExecutionStarted` | Before worker execute function runs |
| `TaskExecutionCompleted` | After successful execution (includes `durationMs`, `outputSizeBytes`) |
| `TaskExecutionFailure` | When worker execute throws |
| `TaskUpdateFailure` | **CRITICAL**: When task result update fails after all retries |

Listener failures are isolated via `Promise.allSettled` and logged to `console.error`.

---

## Builders & Generators

### Task Builders (`src/sdk/builders/tasks/`)

Factory functions for creating typed workflow task definitions:

`simpleTask`, `httpTask`, `inlineTask`, `switchTask`, `forkJoinTask`, `joinTask`, `dynamicForkTask`, `doWhileTask`, `subWorkflowTask`, `eventTask`, `kafkaPublishTask`, `jsonJqTask`, `setVariableTask`, `terminateTask`, `waitTask`

### Workflow Builder (`src/sdk/builders/workflow.ts`)

```typescript
const wf = workflow("my_workflow", [simpleTask("ref", "taskName", {})]);
```

### Task Definition Builder (`src/sdk/builders/taskDefinition.ts`)

Helper to create `ExtendedTaskDef` objects for task registration.

### Generators (`src/sdk/generators/`)

Test data generators for each task type (useful for testing), e.g., `generateSimpleTask()`, `generateHTTPTask()`, etc.

---

## Type System

### Core Types (`src/open-api/types.ts`)

Defines strong TypeScript types for all task types:

- `TaskType` enum: `SIMPLE`, `HTTP`, `INLINE`, `SWITCH`, `FORK_JOIN`, `FORK_JOIN_DYNAMIC`, `DO_WHILE`, `SUB_WORKFLOW`, `EVENT`, `WAIT`, `KAFKA_PUBLISH`, `JSON_JQ_TRANSFORM`, `SET_VARIABLE`, `TERMINATE`, `JOIN`, etc.
- `TaskResultStatusEnum`: `IN_PROGRESS`, `FAILED`, `FAILED_WITH_TERMINAL_ERROR`, `COMPLETED`
- `Consistency` enum: `SYNCHRONOUS`, `DURABLE`, `REGION_DURABLE`
- `ReturnStrategy` enum: `TARGET_WORKFLOW`, `BLOCKING_WORKFLOW`, `BLOCKING_TASK`, `BLOCKING_TASK_INPUT`
- `ServiceType` enum: `HTTP`, `MCP_REMOTE`, `gRPC`
- Per-task-type interfaces: `SimpleTaskDef`, `HttpTaskDef`, `InlineTaskDef`, `SwitchTaskDef`, `ForkJoinTaskDef`, `DoWhileTaskDef`, `SubWorkflowTaskDef`, etc.
- Extended types to fix OpenAPI spec gaps: `ExtendedTaskDef`, `SignalResponse`, `AccessKey`, `AccessKeyInfo`, `ApplicationRole`, `ExtendedConductorApplication`

### SDK Types (`src/sdk/types.ts`)

- `OrkesApiConfig`: `{ serverUrl, keyId, keySecret, refreshTokenInterval, maxHttp2Connections, logger, requestTimeoutMs }`
- `TaskResultStatus`, `TaskResultOutputData`

---

## Error Handling

### `ConductorSdkError` (`src/sdk/helpers/errors.ts`)

Custom error class wrapping inner errors with descriptive messages:

```typescript
throw new ConductorSdkError("Failed to start workflow: Connection refused", innerError);
```

### `handleSdkError(error, message, strategy)`

Overloaded helper:
- `strategy: "throw"` (default): Wraps and throws `ConductorSdkError`
- `strategy: "log"`: Logs to `console.error` without throwing

Used consistently across all client methods for uniform error wrapping.

---

## Logging

### `ConductorLogger` Interface

```typescript
interface ConductorLogger {
  info(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
  warn?(...args: unknown[]): void;  // optional to not break existing custom loggers
}
```

### Implementations

- **`DefaultLogger`**: Configurable log level (`DEBUG`, `INFO`, `WARN`, `ERROR`), supports tags, outputs via `console.log`.
- **`noopLogger`**: Silent logger for when logging is not needed.
- Users can inject any compatible logger (e.g., pino, winston) via `OrkesApiConfig.logger` or TaskHandler/TaskRunner config.

---

## HTTP Layer

### Authentication

JWT-based via `keyId`/`keySecret` → `TokenResource.generateToken()`:

- **Auth callback**: Token is provided per-request via the OpenAPI client's `auth` callback, ensuring freshness is checked before every request.
- **Pre-request TTL check**: If the token is older than `TOKEN_TTL_MS` (45 min), the auth callback refreshes inline before the request proceeds.
- **Background refresh**: Runs on an interval capped at `min(configuredInterval, TOKEN_TTL_MS * 0.8)` (~36 min by default) to proactively refresh before expiry.
- **Exponential backoff**: On consecutive refresh failures, backoff increases as `2^(failures-1)` seconds, capped at 60s. Both background and inline refreshes respect backoff.
- **OSS auto-detection**: If `/api/token` returns 404, auth is disabled and the SDK operates without authentication (for Conductor OSS without the token endpoint).
- **Concurrent refresh mutex**: If a refresh is already in flight (e.g., background + inline at the same time), callers coalesce onto the same promise instead of firing duplicate API calls.
- **Cleanup**: `HandleAuthResult.stopBackgroundRefresh()` stops the background interval.

### Retry & Resilience

The fetch wrapper (`wrapFetchWithRetry`) provides layered retry:

| Condition | Strategy | Max retries | Backoff |
|-----------|----------|-------------|---------|
| HTTP 429 (rate limit) | Exponential | 5 | 1s, 2s, 4s, 8s, 16s |
| HTTP 401/403 (auth) | Token refresh + single retry | 1 | Immediate |
| Transport errors (ECONNRESET, etc.) | Linear | 3 | 1s, 2s, 3s |
| Timeout/AbortError | No retry | 0 | N/A |

### Timeouts

- Per-request timeout via `AbortSignal.timeout()` (default 60s, configurable via `requestTimeoutMs` or `CONDUCTOR_REQUEST_TIMEOUT_MS`)
- Combines with existing abort signals using `AbortSignal.any()` (Node 20+) or manual controller (Node 18 fallback)

### Connection Pooling

- **HTTP/2 support**: Uses `undici` (optional dependency) for HTTP/2 connections. Falls back to native `fetch` if unavailable.
- **Pool size**: `MAX_HTTP2_CONNECTIONS = 10` (configurable via `maxHttp2Connections` or `CONDUCTOR_MAX_HTTP2_CONNECTIONS`)
- Custom fetch: Users can provide their own fetch function for custom networking requirements.

---

## Backward Compatibility

The SDK maintains extensive backward compatibility with the v2 API through `addResourcesBackwardCompatibility()`. This function attaches legacy resource objects (`client.workflowResource`, `client.taskResource`, `client.metadataResource`, etc.) that:

- Mirror the old OpenAPI-generated client's API surface
- Map to new generated methods internally
- Emit deprecation warnings on each call
- Are fully deprecated in favor of the higher-level clients (`WorkflowExecutor`, `MetadataClient`, etc.) or direct `Resource` class usage

---

## Testing

### Unit Tests (`src/sdk/*/__tests__/`)

- `handleAuth.test.ts` (23 tests): Token TTL, OSS detection, exponential backoff, background refresh resilience, stopBackgroundRefresh, inline refresh with backoff, concurrent refresh mutex
- `fetchWithRetry.test.ts` (29 tests): 429/401/403 retry, transport error retry, timeout signals, applyTimeout, signal combining, interaction tests
- `resolveOrkesConfig.test.ts` (15 tests): Server URL normalization, numeric env var parsing (including `0` edge case), defaults, config passthrough
- `Poller.test.ts`, `TaskRunner.test.ts`, `helpers.test.ts`
- `EventDispatcher.test.ts`
- `WorkerConfig.test.ts`, `TaskHandler.test.ts`
- `factory.test.ts` (task builders), `generators.test.ts`
- `resolveFetchFn.test.ts`
- `worker.test.ts` (decorator tests)

### Integration Tests

- `createConductorClient.test.ts` (11 tests): Full wiring of auth flow, OSS detection, 401/transport/429 retry through the real client, config resolution from env vars
- `src/integration-tests/` (against a running Conductor instance):
  - `WorkflowExecutor.test.ts`, `WorkflowResourceService.test.ts`
  - `TaskManager.test.ts`, `TaskRunner.test.ts`, `WorkerRegistration.test.ts`
  - `MetadataClient.test.ts`, `SchedulerClient.test.ts`, `EventClient.test.ts`
  - `ApplicationClient.test.ts`, `ServiceRegistryClient.test.ts`
  - `readme.test.ts` (validates README examples work)

Supports two backend versions via environment variable: `ORKES_BACKEND_VERSION=4` or `ORKES_BACKEND_VERSION=5`.

### Test Infrastructure

- Jest 30.x with `ts-jest`
- `jest-junit` reporter for CI
- Custom helpers: `waitForWorkflowCompletion`, `waitForWorkflowStatus`, `executeWorkflowWithRetry`, `customJestDescribe` (for version-gated tests)

---

## Python SDK Parity Assessment

### Achieved

| Feature | Status | Implementation |
|---------|--------|----------------|
| Pre-request TTL check | Done | Auth callback checks `Date.now() - tokenObtainedAt >= TOKEN_TTL_MS` |
| 401/403 retry | Done | `fetchWithRetry` refreshes token and retries once |
| OSS auto-detection | Done | 404 on `/api/token` sets `isOss = true`, disables auth |
| Exponential backoff on refresh failures | Done | `2^(n-1)` seconds capped at 60s (`MAX_AUTH_BACKOFF_MS`) |
| Background refresh resilience | Done | Never stops interval on failure (unlike old `clearInterval`) |
| Transport error retry | Done | 3 retries with linear backoff |
| Request timeouts | Done | `AbortSignal.timeout()` with configurable ms |
| Task update retry count | Done | `MAX_RETRIES = 4` (was 3) |
| Connection pool headroom | Done | `MAX_HTTP2_CONNECTIONS = 10` (was 1) |

### Remaining Gaps (future work)

| Feature | Priority | Notes |
|---------|----------|-------|
| Adaptive backoff for empty polls | LOW | Python SDK backs off exponentially when polls return no tasks |
| mTLS support | LOW | Python SDK supports client certificates |

---

## Build & Publish

- **Build tool**: `tsup` targeting Node 18
- **Output formats**: ESM (`.mjs`) and CJS (`.js`) with source maps and `.d.ts` type declarations
- **Entry point**: `index.ts` → re-exports from `src/sdk` and `src/open-api`
- **Exports map**: Supports `import`, `require`, and `types` conditions
- **OpenAPI codegen**: `npm run generate-openapi-layer` via `@hey-api/openapi-ts` (config in `openapi-ts.config.ts`)

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `CONDUCTOR_SERVER_URL` | Conductor server base URL |
| `CONDUCTOR_AUTH_KEY` | Authentication key ID |
| `CONDUCTOR_AUTH_SECRET` | Authentication key secret |
| `CONDUCTOR_MAX_HTTP2_CONNECTIONS` | Max HTTP/2 connections (default: 10) |
| `CONDUCTOR_REFRESH_TOKEN_INTERVAL` | Token refresh interval in ms |
| `CONDUCTOR_REQUEST_TIMEOUT_MS` | Per-request timeout in ms (default: 60000) |
| `CONDUCTOR_WORKER_ALL_<PROPERTY>` | Global worker config override |
| `CONDUCTOR_WORKER_<NAME>_<PROPERTY>` | Per-worker config override |
| `conductor.worker.all.<property>` | Global worker config (dotted notation) |
| `conductor.worker.<name>.<property>` | Per-worker config (dotted notation) |
| `ORKES_BACKEND_VERSION` | Backend version for tests (4 or 5) |

---

## Constants Reference

### Client Factory (`src/sdk/createConductorClient/constants.ts`)

| Constant | Value | Purpose |
|----------|-------|---------|
| `REFRESH_TOKEN_IN_MILLISECONDS` | 3,600,000 (1hr) | Default configured refresh interval |
| `MAX_HTTP2_CONNECTIONS` | 10 | Default HTTP/2 connection pool size |
| `TOKEN_TTL_MS` | 2,700,000 (45min) | Token considered stale after this age |
| `MAX_AUTH_FAILURES` | 5 | Error-level logging threshold |
| `MAX_AUTH_BACKOFF_MS` | 60,000 (60s) | Cap on exponential backoff |
| `MAX_TRANSPORT_RETRIES` | 3 | Fetch transport error retries |
| `DEFAULT_REQUEST_TIMEOUT_MS` | 60,000 (60s) | Default per-request timeout |

### Worker (`src/sdk/clients/worker/constants.ts`)

| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_RETRIES` | 4 | Task update retry attempts |
| `DEFAULT_POLL_INTERVAL` | 100ms | Default polling interval |
| `DEFAULT_CONCURRENCY` | 1 | Default concurrent task executions |
| `DEFAULT_BATCH_POLLING_TIMEOUT` | 100ms | Batch poll long-poll timeout |

---

## Key Design Decisions

1. **CJS + ESM dual publish**: Maintains backward compatibility while supporting modern ESM consumers.
2. **`jest` for testing**: Balances simplicity and feature-set.
3. **`tsup` for bundling**: Simplifies TypeScript publication.
4. **`undici` for HTTP/2**: Optional dependency; native fetch fallback for broader compatibility.
5. **OpenAPI code generation**: Generated code is never modified directly; all customizations live in upper layers.
6. **Layered architecture**: Clean separation between generated API, SDK abstractions, and domain clients.
7. **Consistent error handling**: All client methods use `handleSdkError()` for uniform `ConductorSdkError` wrapping.
8. **Decorator-based workers**: The `@worker` pattern provides Python SDK parity with TypeScript ergonomics.
9. **Auth as callback**: Token is provided per-request via the OpenAPI client's `auth` callback, enabling inline TTL checks without modifying the generated client.
10. **`warn` is optional on ConductorLogger**: Avoids breaking existing custom logger implementations that only provide `info`/`error`/`debug`.

---

## File Count Summary

| Directory | Purpose | Approximate File Count |
|-----------|---------|----------------------|
| `src/open-api/generated/` | Auto-generated OpenAPI client & types | ~15 |
| `src/open-api/` | Type extensions, exports, deprecated types | ~5 |
| `src/sdk/clients/` | Domain client classes (10 domains) | ~35 |
| `src/sdk/builders/` | Workflow & task builders | ~18 |
| `src/sdk/generators/` | Test data generators | ~17 |
| `src/sdk/worker/` | Decorator system, TaskHandler, config | ~10 |
| `src/sdk/createConductorClient/` | Client factory & helpers | ~8 |
| `src/sdk/helpers/` | Logger, errors | ~2 |
| `src/integration-tests/` | Integration test suites | ~15 |
