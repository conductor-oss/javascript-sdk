# SDK New Language Implementation Guide

Comprehensive, language-agnostic guide for building a Conductor SDK in any language with full feature parity to the TypeScript reference implementation (`conductor-javascript`).

## Table of Contents

1. [Overview & Approach](#1-overview--approach)
2. [Quick Start: Minimal Viable SDK](#2-quick-start-minimal-viable-sdk)
3. [Architecture](#3-architecture)
4. [Implementation Phases](#4-implementation-phases)
5. [Feature Accounting Table](#5-feature-accounting-table)
6. [Validation Criteria](#6-validation-criteria)
7. [Appendix A: Key Design Decisions](#appendix-a-key-design-decisions)
8. [Appendix B: Server Behavior Quirks](#appendix-b-server-behavior-quirks)

---

## 1. Overview & Approach

### Purpose

Build a Conductor SDK in language X that provides:
- Full API coverage for all Conductor server endpoints
- A worker framework for executing tasks with polling, metrics, and lifecycle management
- A fluent builder DSL for defining workflows and tasks programmatically
- Feature parity with both the TypeScript and Python SDKs

### Reference Implementation

The TypeScript SDK (`conductor-javascript`) is the primary reference. It has full feature parity with the Python SDK and covers 272 API operations across 192 endpoints.

### Discovery Methodology

To extract requirements for your new SDK:

1. **OpenAPI Spec** — The server's `spec.json` defines all REST endpoints, request/response types, and operations. You can optionally generate types/client from this, but it is NOT required — the Java SDK hand-writes its HTTP layer. Use it as a reference regardless of approach.
2. **TypeScript SDK Source** — The reference for domain client methods, worker framework behavior, retry strategies, builder patterns, and error handling. Each client method maps to one or more REST operations with added error context.
3. **Python SDK** — Secondary reference for naming conventions and feature parity validation. The Python SDK uses snake_case equivalents of the TypeScript camelCase names.
4. **Conductor Server** — Some APIs are not in the OpenAPI spec (e.g., rate limit API). Some server behaviors differ between OSS and Enterprise. Test against a real server.

### OpenAPI Spec Location

- **In the TypeScript SDK:** `src/open-api/spec/spec.json`
- **From a running server:** `GET {serverUrl}/api/swagger.json` or `/api/openapi.json`
- **Regeneration (TS SDK):** Config at `openapi-ts.config.ts`, run `npm run generate-openapi-layer`
- **Coverage:** 272 operations across 192 endpoints. Some APIs (rate limits, V2 task update) are NOT in the spec — see Phase 4 for raw HTTP endpoints.

### Implementation Order

Each phase builds on the previous. The dependency chain is:

```
Phase 1 (Types) → Phase 2 (Transport) → Phase 3 (Factory) → Phase 4 (Clients)
                                                                  ↓
                                                    Phase 5 (Workers) + Phase 6 (Builders)
                                                                  ↓
                                              Phase 7 (Examples) + Phase 8 (Tests)
                                                                  ↓
                                                       Phase 9 (Packaging)
```

---

## 2. Quick Start: Minimal Viable SDK

Before building the full SDK, get a working end-to-end loop. These 3 milestones give you a functional SDK skeleton that you can expand into the full implementation.

### Milestone 1: First API Call

1. Set up project structure and build tooling for your language
2. Implement `OrkesApiConfig` with `serverUrl`, `keyId`, and `keySecret` fields
3. Implement token generation: `POST /api/token` with `{ keyId, keySecret }` → JWT response
4. Attach the token as `X-Authorization` header (NOT `Authorization`)
5. Make a raw HTTP call: `GET /api/workflow/{workflowId}` to retrieve a workflow
6. Verify you can successfully retrieve data from a running Conductor server

### Milestone 2: First Worker

1. Implement batch task polling: `GET /api/tasks/poll/batch/{taskType}?count=1&timeout=100`
2. Implement task result update: `POST /api/tasks` with `TaskResult` body
3. Write a simple poll loop: poll → execute user function → update result
4. Register a task definition via `POST /api/metadata/taskdefs`, start a workflow, watch your worker complete it
5. Verify the workflow completes with the expected output

### Milestone 3: First Builder

1. Implement `simpleTask(refName, taskDefName, inputParameters)` → `WorkflowTask` object
2. Implement `ConductorWorkflow.add(task)` and `toWorkflowDef()` → `WorkflowDef` object
3. Build a workflow programmatically, register it via `POST /api/metadata/workflow`, and execute it
4. Verify the builder-created workflow runs identically to a hand-crafted one

After these 3 milestones, proceed to the full implementation phases below.

---

## 3. Architecture

### Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Public API                         │
│  OrkesClients factory, createConductorClient, exports   │
├─────────────────────────────────────────────────────────┤
│                    Builders Layer                        │
│  ConductorWorkflow DSL, 41 task builders,               │
│  workflow() + taskDefinition() factories                 │
├─────────────────────────────────────────────────────────┤
│                  Worker Framework                        │
│  TaskHandler, @worker decorator, TaskRunner, Poller,     │
│  TaskContext, EventDispatcher, MetricsCollector          │
├─────────────────────────────────────────────────────────┤
│              Domain Clients (14 clients)                 │
│  WorkflowExecutor, TaskClient, MetadataClient,           │
│  SchedulerClient, AuthorizationClient, SecretClient,     │
│  SchemaClient, IntegrationClient, PromptClient,          │
│  ApplicationClient, EventClient, HumanExecutor,          │
│  TemplateClient, ServiceRegistryClient                   │
├─────────────────────────────────────────────────────────┤
│              HTTP Client Layer (Types + Transport)        │
│  API types, HTTP methods, auth token lifecycle,           │
│  retry with backoff + jitter, HTTP/2, TLS/mTLS, proxy    │
└─────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Responsibility | Dependencies |
|-------|---------------|--------------|
| **HTTP Client Layer** | Types, raw API calls, auth, retry, connection pooling, TLS, proxy, timeouts | None |
| **Domain Clients** | Typed wrappers with error context around HTTP calls | HTTP Client Layer |
| **Worker Framework** | Polling, execution, context, metrics, lifecycle | Domain Clients (TaskClient) |
| **Builders** | Fluent DSL for workflows and tasks | Domain Clients (WorkflowExecutor, MetadataClient) |
| **Public API** | Factory functions, re-exports, entry points | All layers |

---

## 4. Implementation Phases

Each phase builds on the previous. Implement in order.

### Phase 1: HTTP Client Layer (Types + Transport)

**Goal:** Build the foundation layer that all domain clients will use: API types, raw HTTP methods, authentication, retry, and connection management.

**Important:** OpenAPI code generation is one option, not a requirement. The TypeScript SDK uses OpenAPI-generated types and resource classes, but the Java SDK hand-writes its HTTP layer directly. Choose the approach that best fits your language:

| Approach | Pros | Cons | Used By |
|----------|------|------|---------|
| **OpenAPI code generation** | Fast bootstrapping, auto-generated types | Generated code can be rigid, may need workarounds for spec gaps | TypeScript SDK |
| **Hand-written HTTP client** | Full control, cleaner API surface, no generator quirks | More upfront work, must manually track API changes | Java SDK |
| **Hybrid** | Generate types only, hand-write HTTP calls | Balanced effort | — |

Regardless of approach, the HTTP client layer must cover:

**Scope:**
- 272 operations across 192 endpoints
- All request/response types (WorkflowDef, Task, TaskResult, etc.)
- Typed HTTP methods: GET, POST, PUT, DELETE with path params, query params, and request bodies
- Some APIs are NOT in the OpenAPI spec (e.g., rate limit API) — these require raw HTTP calls regardless

**Types to define (whether generated or hand-written):**

| Type | Variants / Fields | Purpose |
|------|-------------------|---------|
| `TaskType` enum | 28 task type variants | Builder `type` fields |
| `Consistency` enum | `EVENTUAL`, `STRONG` | Workflow execution consistency |
| `ReturnStrategy` enum | `ONLY_FIRST`, `ALL`, `FIRST_MATCHING` | Signal return strategies |
| `TaskResultStatusEnum` | `COMPLETED`, `FAILED`, `FAILED_WITH_TERMINAL_ERROR`, `IN_PROGRESS` | Task result statuses |
| `ExtendedRateLimitConfig` | Additional rate limit fields beyond spec | Rate limit API uses raw HTTP |
| Core domain types | `WorkflowDef`, `Task`, `TaskResult`, `TaskDef`, `Workflow`, etc. | Used by every layer above |

**If using OpenAPI generation:**
- Generated code should be isolated — never hand-edit generated files
- Create an extended types file for fields missing from the spec

**If hand-writing the HTTP client:**
- Use the TypeScript SDK's `spec.json` as the type reference
- Organize HTTP methods by resource (Workflow, Task, Metadata, etc.)
- Ensure all 272 operations have typed request/response wrappers

### Phase 2: HTTP Transport (Auth, Retry, Connection Management)

**Goal:** Layer authentication, retry, and connection management on top of the HTTP client from Phase 1. This can be built as middleware/interceptors wrapping the base HTTP client.

#### 2.1 Token Management and Authentication

This is the most nuanced part of the transport layer. Getting it wrong causes silent auth failures, token storms, or broken OSS compatibility. The SDK must handle three distinct scenarios: Orkes Enterprise (tokens required), Conductor OSS (no auth), and transient auth failures (token expired mid-session).

##### 2.1.1 Token Generation

**Endpoint:** `POST /api/token`

**Request body:**
```json
{
  "keyId": "your-key-id",
  "keySecret": "your-key-secret"
}
```

**Success response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**The token is a JWT.** It is sent on every subsequent API request via the `X-Authorization` header (NOT the standard `Authorization` header):

```
X-Authorization: eyJhbGciOiJIUzI1NiIs...
```

**When to skip auth entirely:** If `keyId` and `keySecret` are both absent from config and environment variables, do not attempt token generation at all. Create the HTTP client without auth headers. This supports local Conductor OSS instances that have no auth configured.

##### 2.1.2 OSS Conductor Detection (No Auth Required)

Conductor OSS does not have the `/api/token` endpoint. When the SDK attempts to generate a token and receives a **404 response**, this means:

1. **Set an `isOss` flag** to `true`
2. **Stop all future token generation/refresh** — no background refresh, no pre-request refresh
3. **Do not send the `X-Authorization` header** on any subsequent API request
4. **Log an informational message:** `"Conductor OSS detected (no /token endpoint), proceeding without auth"`
5. **Return the client normally** — all API calls proceed without authentication

```
Initial token request → POST /api/token (up to 3 attempts with backoff)
  ├─ 200 + token → Orkes Enterprise, proceed with auth
  ├─ 404         → Conductor OSS, disable auth entirely (no retry)
  └─ Other error → Retry up to 3 times with exponential backoff (1s, 2s), then throw ConductorSdkError
```

**Initial token retry:** The initial token request retries up to 3 times with the same exponential backoff as background refresh (2^(n-1) × 1s). This handles transient network failures during startup. A 404 (OSS detection) is never retried — it immediately disables auth.

**CRITICAL:** The 404 check must happen on the initial token request during client creation. If the initial request fails after all retries with anything other than 404 (e.g., 500, network error), it is a fatal error — throw immediately, do not silently disable auth.

##### 2.1.3 Token Caching and TTL

Once a token is obtained, cache it in memory with a timestamp:

```
token = "eyJhbG..."
tokenObtainedAt = now()
```

**Token TTL:** 45 minutes (`TOKEN_TTL_MS = 2,700,000ms`). The server-issued JWT has a longer lifetime, but the SDK proactively refreshes at 45 minutes to ensure the token is always valid when used.

**Pre-request check:** Before every API call, check if the token has expired:
```
if (now() - tokenObtainedAt >= TOKEN_TTL_MS):
    refresh the token before sending the request
```

This ensures that even if the background refresh has failed, the token is refreshed inline before it's used.

##### 2.1.4 Background Token Refresh

A periodic background task refreshes the token proactively so that API calls never block on token refresh:

```
effectiveInterval = min(configuredInterval, TOKEN_TTL_MS * 0.8)
// Default configuredInterval = 3,600,000ms (1 hour)
// TOKEN_TTL_MS * 0.8 = 2,160,000ms (36 minutes)
// So effective default = 2,160,000ms (36 minutes)

every effectiveInterval:
    if isOss: skip
    if shouldBackoff(): skip
    try:
        refreshToken()
        consecutiveFailures = 0
    catch:
        consecutiveFailures++
        lastFailureAt = now()
        if consecutiveFailures >= MAX_AUTH_FAILURES (5):
            log.error("Token refresh has failed N consecutive times")
        else:
            log.warn("Token refresh failed (attempt N/5), backing off Xms")
```

**The background refresh must be stoppable.** When the client is shut down (e.g., `stopWorkers()`), stop the background refresh timer to avoid leaked resources.

##### 2.1.5 Concurrent Refresh Mutex

When multiple concurrent API calls all discover an expired token simultaneously, only ONE should trigger a token refresh. Without this, N concurrent requests each fire a separate `POST /api/token`, causing N-1 redundant calls.

**Implementation (mutex / promise coalescing):**

```
refreshInFlight = null  // shared state

function refreshTokenGuarded():
    if refreshInFlight is not null:
        return await refreshInFlight   // coalesce onto existing request
    refreshInFlight = doRefresh()
    try:
        result = await refreshInFlight
        return result
    finally:
        refreshInFlight = null         // release for next caller
```

In thread-based languages (Java, Go), use a mutex/lock instead of promise coalescing:

```
mutex = new Mutex()

function refreshTokenGuarded():
    mutex.lock()
    try:
        if tokenIsStillFresh():   // double-check after acquiring lock
            return currentToken
        newToken = doRefresh()
        return newToken
    finally:
        mutex.unlock()
```

##### 2.1.6 Auth Failure Backoff

When token refresh fails repeatedly, use exponential backoff to avoid hammering the auth server:

```
backoffMs = min(2^(consecutiveFailures - 1) * 1000, MAX_AUTH_BACKOFF_MS)
```

| Consecutive Failures | Backoff Delay |
|---------------------|---------------|
| 1 | 1,000ms (1s) |
| 2 | 2,000ms (2s) |
| 3 | 4,000ms (4s) |
| 4 | 8,000ms (8s) |
| 5+ | 60,000ms (60s) — capped |

**Backoff check before refresh:**
```
function shouldBackoff():
    if consecutiveFailures == 0: return false
    backoffMs = getBackoffMs(consecutiveFailures)
    return (now() - lastFailureAt) < backoffMs
```

If in backoff, skip the refresh attempt and use the existing (possibly expired) token. The pre-request TTL check will try again on the next API call.

**On successful refresh:** Reset `consecutiveFailures` to 0 immediately.

**Fallback behavior:** If refresh fails, use the existing cached token. It may still be valid (server-side JWT lifetime is longer than the SDK's 45-minute TTL). This is better than having no token at all.

##### 2.1.7 Auth Retry on API Calls (401/403) — Token Errors vs Permission Errors

Separately from the background refresh, the fetch/retry layer handles auth failures on individual API calls. **Critically, not all 401/403 responses are token problems.** A 403 can also mean the user lacks permission for an operation. The SDK must distinguish these cases to avoid wasteful token refreshes.

**Server error codes in the response body:**

The Conductor server includes an error code in the JSON response body:

```json
{ "error": "EXPIRED_TOKEN", "message": "Token has expired" }
```

| HTTP Status | Error Code | Meaning | Action |
|-------------|-----------|---------|--------|
| 401 | `EXPIRED_TOKEN` | JWT has expired | Refresh token + retry |
| 403 | `INVALID_TOKEN` | JWT is malformed or revoked | Refresh token + retry |
| 401 | other / none | Generic unauthorized | **Do NOT retry** — credentials may be wrong |
| 403 | other / none | Insufficient permissions | **Do NOT retry** — refreshing won't help |

**Decision logic (matching Python SDK behavior):**

```
response = fetch(request)

if response.status in (401, 403):
    errorCode = parseJsonBody(response).error   // "EXPIRED_TOKEN", "INVALID_TOKEN", etc.

    if errorCode == "EXPIRED_TOKEN" or errorCode == "INVALID_TOKEN":
        // Token problem — refresh and retry
        newToken = await onAuthFailure()
        if newToken:
            retryRequest = clone(request)
            retryRequest.headers["X-Authorization"] = newToken
            return fetch(retryRequest)

    // Permission error or unrecognized error code — return as-is, do NOT refresh
    return response
```

**Fallback when response body is not JSON:**
- For 401 with unparseable body: treat as token error (attempt refresh). This is a safe default because most 401s from Conductor are token problems.
- For 403 with unparseable body: treat as permission error (do NOT refresh). 403 is more commonly a permission issue.

**Why this matters:**

Without this distinction, a permission-denied 403 causes:
1. An unnecessary `POST /api/token` call (wasteful)
2. A retry of the same request with the new token (will also 403)
3. Two wasted HTTP round-trips before the caller sees the error

With the distinction, a permission-denied 403 returns immediately to the caller — no delay, no wasted token refresh.

##### 2.1.8 Token Constants Summary

| Constant | Value | Purpose |
|----------|-------|---------|
| `TOKEN_TTL_MS` | 2,700,000 (45 min) | Refresh token when age exceeds this |
| `REFRESH_TOKEN_IN_MILLISECONDS` | 3,600,000 (1 hr) | Default background refresh interval (config) |
| `MAX_AUTH_FAILURES` | 5 | Stop logging errors after this many consecutive failures |
| `MAX_AUTH_BACKOFF_MS` | 60,000 (60s) | Cap on exponential backoff |
| Auth header name | `X-Authorization` | NOT `Authorization` — Conductor uses a custom header |

##### 2.1.9 Complete Token Lifecycle Diagram

```
Client Creation
  │
  ├─ keyId + keySecret provided?
  │     NO  → Create client without auth, no token management
  │     YES ↓
  │
  ├─ POST /api/token (initial)
  │     ├─ 200 + token → Cache token, record timestamp
  │     ├─ 404         → Set isOss=true, disable all auth, return client
  │     └─ Other error → THROW (fatal, cannot create client)
  │
  ├─ Set auth callback on HTTP client
  │     └─ Before each request: if token age >= 45min, refresh inline
  │
  ├─ Start background refresh timer
  │     └─ Every min(configuredInterval, 36min):
  │          ├─ Skip if isOss
  │          ├─ Skip if in backoff
  │          ├─ Refresh token (guarded by mutex)
  │          └─ On failure: increment failures, apply backoff
  │
  └─ Register onAuthFailure callback in fetch retry layer
        └─ On 401/403 from any API call:
             ├─ Parse error code from response body
             ├─ EXPIRED_TOKEN or INVALID_TOKEN?
             │     YES → Refresh token (guarded by mutex)
             │           Retry request once with new X-Authorization header
             │           If retry fails: return error response
             │     NO  → Return 401/403 immediately (permission error)
```

#### 2.2 Retry Strategies

Three independent retry layers, each wrapping the previous:

| Layer | Trigger | Max Retries | Backoff | Jitter |
|-------|---------|-------------|---------|--------|
| **Transport** | Network errors (not timeouts) | 3 | Linear: `delay * (attempt + 1)` | ±10% |
| **Rate Limit** | HTTP 429 | 5 | Exponential: `delay *= 2` | ±10% |
| **Auth** | HTTP 401/403 | 1 | Refresh token, retry once | None |

**Jitter formula:**
```
jitter = delay * 0.1 * (2 * random() - 1)
actual_delay = max(0, round(delay + jitter))
```

**Timeout errors are NOT retried** — they propagate immediately.

#### 2.3 Connection Management

- **HTTP/2** with connection pooling (optional, via Undici or language equivalent)
- **Max connections:** 10 (configurable via `CONDUCTOR_MAX_HTTP2_CONNECTIONS`)
- **TLS/mTLS:** Client cert + key + CA bundle support
- **Proxy:** HTTP/HTTPS proxy via `CONDUCTOR_PROXY_URL`
- **Connect timeout:** 10,000ms (matches Python SDK)
- **Request timeout:** 60,000ms per request

#### 2.4 Environment Variables

All 13 configuration variables. Env vars override config object values.

| Variable | Purpose | Default |
|----------|---------|---------|
| `CONDUCTOR_SERVER_URL` | Server URL (auto-strip trailing `/` and `/api`) | Required |
| `CONDUCTOR_AUTH_KEY` | API key ID | Required for auth |
| `CONDUCTOR_AUTH_SECRET` | API key secret | Required for auth |
| `CONDUCTOR_MAX_HTTP2_CONNECTIONS` | HTTP/2 connection pool size | 10 |
| `CONDUCTOR_REFRESH_TOKEN_INTERVAL` | Token refresh interval (ms) | 3,600,000 |
| `CONDUCTOR_REQUEST_TIMEOUT_MS` | Per-request timeout | 60,000 |
| `CONDUCTOR_CONNECT_TIMEOUT_MS` | Connection timeout | 10,000 |
| `CONDUCTOR_TLS_CERT_PATH` | Client TLS certificate path | — |
| `CONDUCTOR_TLS_KEY_PATH` | Client TLS private key path | — |
| `CONDUCTOR_TLS_CA_PATH` | CA bundle path | — |
| `CONDUCTOR_PROXY_URL` | HTTP/HTTPS proxy URL | — |
| `CONDUCTOR_TLS_INSECURE` | Disable TLS certificate verification (`true`/`1`) | `false` |
| `CONDUCTOR_DISABLE_HTTP2` | Force HTTP/1.1 instead of HTTP/2 (`true`/`1`) | `false` |

#### 2.5 Logger Interface

The SDK uses a pluggable logger interface so users can integrate with any logging framework (pino, winston, log4j, slog, etc.).

**Interface:**

```
ConductorLogger {
  debug(...args): void
  info(...args): void
  warn(...args): void
  error(...args): void
}
```

**Implementations to provide:**

| Implementation | Description |
|----------------|-------------|
| `DefaultLogger` | Console-based with configurable level (DEBUG, INFO, WARN, ERROR) and optional tags |
| `noopLogger` | Silent no-op — all methods are empty. Useful for tests and silent operation |

**Log levels:** DEBUG=10, INFO=30, WARN=40, ERROR=60. Only emit messages at or above the configured level.

**Usage:** Logger is passed via config to `createConductorClient` and propagated to all components (auth handler, workers, metrics). Users can substitute any compatible logger.

**Reference:** `src/sdk/helpers/logger.ts`

### Phase 3: Client Factory

**Goal:** Single entry point that creates one authenticated connection and provides access to all 14 domain clients.

#### 3.1 OrkesClients Factory

```
OrkesClients.from(config) → OrkesClients instance
  .getWorkflowClient()       → WorkflowExecutor
  .getTaskClient()            → TaskClient
  .getMetadataClient()        → MetadataClient
  .getSchedulerClient()       → SchedulerClient
  .getAuthorizationClient()   → AuthorizationClient
  .getSecretClient()          → SecretClient
  .getSchemaClient()          → SchemaClient
  .getIntegrationClient()     → IntegrationClient
  .getPromptClient()          → PromptClient
  .getApplicationClient()     → ApplicationClient
  .getEventClient()           → EventClient
  .getHumanClient()           → HumanExecutor
  .getTemplateClient()        → TemplateClient
  .getServiceRegistryClient() → ServiceRegistryClient
```

#### 3.2 createConductorClient

```
createConductorClient(config) → authenticated Client
```

Alias: `orkesConductorClient` (same function, used by convention in tests).

Both resolve config from env vars + config object, set up auth, retry, and optional HTTP/2.

### Phase 4: Domain Clients

**Goal:** 14 typed client classes wrapping OpenAPI operations with error context. 199 total public methods.

#### 4.1 Universal Client Method Pattern

Every client method follows this pattern:

```
function someMethod(args):
    try:
        response = OpenApiResource.apiCall(
            path: { id: args.id },
            query: { ... },
            body: ...,
            client: this.client,
            throwOnError: true
        )
        return response.data
    catch error:
        handleSdkError(error, "Failed to do X for '{args.id}'")
```

Rules:
- Every OpenAPI call sets `throwOnError: true`
- Every catch block calls `handleSdkError` with human-readable context including the resource ID
- The "throw" error strategy returns `never` (no return needed after catch)
- The "log" error strategy logs to stderr and continues

#### 4.2 Error Handling

**ConductorSdkError class:**
- Extends the language's base Error/Exception class
- Fields: `message` (string with combined context + original error), `cause` (original inner error)
- Name prefix: `"[Conductor SDK Error]"`

**handleSdkError function (two strategies):**

```
// Strategy 1: throw (default) — return type is `never`
handleSdkError(error, "Failed to get workflow 'abc'")
// → throws ConductorSdkError("Failed to get workflow 'abc': 404 Not Found")

// Strategy 2: log — return type is `void`
handleSdkError(error, "Failed to get workflow 'abc'", "log")
// → console.error("[Conductor SDK Error]: Failed to get workflow 'abc': 404 Not Found")
```

**Message composition:** `"${customMessage}: ${error.message}"` — the custom context is prepended to the original error message. If either part is absent, use whichever is available.

**NonRetryableException:** Separate exception class thrown from worker functions to mark a task as `FAILED_WITH_TERMINAL_ERROR`. Conductor will NOT retry the task regardless of the task definition's retry settings. Use for permanent failures (bad input, resource not found, business rule violations).

**Reference:** `src/sdk/helpers/errors.ts`

#### 4.3 Raw HTTP Endpoints (Not in OpenAPI Spec)

These APIs require direct HTTP calls — they are not in `spec.json` and cannot be generated from the OpenAPI spec:

| Operation | Method | Path | Body | Response |
|-----------|--------|------|------|----------|
| Set workflow rate limit | PUT | `/api/metadata/workflow/{name}/rateLimit` | `ExtendedRateLimitConfig` JSON | 200 OK |
| Get workflow rate limit | GET | `/api/metadata/workflow/{name}/rateLimit` | — | `ExtendedRateLimitConfig` or 404 |
| Remove workflow rate limit | DELETE | `/api/metadata/workflow/{name}/rateLimit` | — | 200 OK |
| V2 task update (with poll) | POST | `/api/tasks/{taskId}/v2` | TaskResult + poll params | Next task batch |

**ExtendedRateLimitConfig type:**
```json
{
  "rateLimitPerFrequency": 100,
  "rateLimitFrequencyInSeconds": 60,
  "concurrentExecLimit": 10
}
```

The V2 task update endpoint combines the task result update with the next poll in a single HTTP round-trip. See Phase 5 (Worker Framework) for how this is used.

#### 4.4 Human Task Lifecycle

Human tasks pause workflow execution until a human completes an action. The `HumanExecutor` client manages this lifecycle:

**Flow:**
```
Workflow reaches HUMAN task → task becomes PENDING in human task queue
  ├─ Search/poll for available tasks (getTasksByFilter, search, pollSearch)
  ├─ Claim the task (locks it to prevent others from claiming)
  │     ├─ claimTaskAsExternalUser(taskId, assignee) — for email-based external users
  │     └─ claimTaskAsConductorUser(taskId) — for authenticated Conductor users
  ├─ Review input, fill form, provide output (updateTaskOutput)
  └─ Complete the task (completeTask) → workflow resumes
```

**Release:** If a claimed task cannot be completed, call `releaseTask(taskId)` to return it to the queue for others.

**Templates:** Human tasks can reference form templates (via `TemplateClient.registerTemplate()`). Templates define the UI form structure for human task completion. Retrieve templates via `getTemplateByNameVersion()` or `getTemplateById()`.

**Poll-search pattern:** For building human task UIs, use `pollSearch()` which combines search + long-poll for real-time task availability updates without constant polling.

#### 4.5 Client Method Inventory (199 methods)

| Client | Methods | Key Operations |
|--------|---------|---------------|
| **WorkflowExecutor** | 28 | register, start, execute, pause, resume, terminate, retry, restart, reRun, signal, search, getWorkflow, getExecution, getWorkflowStatus, updateTask, updateTaskByRefName, updateTaskSync, updateState, updateVariables, deleteWorkflow, getByCorrelationIds, testWorkflow, goBackToTask, goBackToFirstTaskMatchingType, startWorkflowByName, skipTasksFromWorkflow, signalAsync, getTask |
| **TaskClient** | 8 | search, getTask, updateTaskResult, addTaskLog, getTaskLogs, getQueueSizeForTask, getTaskPollData, updateTaskSync |
| **MetadataClient** | 21 | registerTask, registerTasks, updateTask, getTask, unregisterTask, getAllTaskDefs, registerWorkflowDef, getWorkflowDef, unregisterWorkflow, getAllWorkflowDefs, add/delete/get/setWorkflowTag(s), add/delete/get/setTaskTag(s), set/get/removeWorkflowRateLimit |
| **SchedulerClient** | 14 | saveSchedule, search, getSchedule, pauseSchedule, resumeSchedule, deleteSchedule, getAllSchedules, getNextFewSchedules, pauseAllSchedules, resumeAllSchedules, requeueAllExecutionRecords, set/get/deleteSchedulerTags |
| **AuthorizationClient** | 19 | grantPermissions, getPermissions, removePermissions, upsertUser, getUser, listUsers, deleteUser, checkPermissions, getGrantedPermissionsForUser, upsertGroup, getGroup, listGroups, deleteGroup, addUserToGroup, addUsersToGroup, getUsersInGroup, removeUserFromGroup, removeUsersFromGroup, getGrantedPermissionsForGroup |
| **SecretClient** | 9 | putSecret, getSecret, deleteSecret, listAllSecretNames, listSecretsThatUserCanGrantAccessTo, secretExists, set/get/deleteSecretTags |
| **SchemaClient** | 6 | registerSchema, getSchema, getSchemaByName, getAllSchemas, deleteSchema, deleteSchemaByName |
| **IntegrationClient** | 20 | save/get/delete IntegrationProvider(s), save/get/delete IntegrationApi(s), getIntegrations, getIntegrationProviderDefs, getProvidersAndIntegrations, getIntegrationAvailableApis, associatePromptWithIntegration, getPromptsWithIntegration, set/get/delete IntegrationTags, set/get/delete ProviderTags |
| **PromptClient** | 9 | savePrompt, updatePrompt, getPrompt, getPrompts, deletePrompt, testPrompt, get/set/deletePromptTags |
| **ApplicationClient** | 17 | getAllApplications, createApplication, getAppByAccessKeyId, deleteAccessKey, toggleAccessKeyStatus, removeRoleFromApplicationUser, addApplicationRole, deleteApplication, getApplication, updateApplication, getAccessKeys, createAccessKey, delete/get/addApplicationTag(s) |
| **EventClient** | 22 | getAll/add/update/removeEventHandler(s), handleIncomingEvent, getEventHandlerByName, getEventHandlersForEvent, getAll/delete/get/putQueueConfig, get/put/deleteTagForEventHandler(s), testConnectivity, test, getAllActiveEventHandlers, getEventExecutions, getEventHandlersWithStats, getEventMessages |
| **HumanExecutor** | 11 | getTasksByFilter, search, pollSearch, getTaskById, claimTaskAsExternalUser, claimTaskAsConductorUser, releaseTask, getTemplateByNameVersion, getTemplateById, updateTaskOutput, completeTask |
| **TemplateClient** | 1 | registerTemplate |
| **ServiceRegistryClient** | 14 | getRegisteredServices, removeService, getService, open/closeCircuitBreaker, getCircuitBreakerStatus, addOrUpdateService, addOrUpdateServiceMethod, removeMethod, get/set/deleteProtoData, getAllProtos, discover |
| **Total** | **199** | |

### Phase 5: Worker Framework

**Goal:** Task polling, execution, metrics, and lifecycle management.

#### 5.1 Architecture

```
TaskHandler (orchestrator)
  ├── Discovers workers (decorator registry + manual list)
  ├── Creates TaskRunner per worker
  ├── Health monitor (optional auto-restart)
  └── Lifecycle: startWorkers() / stopWorkers()

TaskRunner (per worker)
  ├── Poller: concurrent queue with adaptive backoff
  ├── Execute: run worker function within TaskContext
  ├── Update: POST result via V2 endpoint (update + poll in one call)
  └── Events: dispatch to all registered listeners

EventDispatcher
  └── Publishes 8 event types to registered listeners

MetricsCollector (implements TaskRunnerEventsListener)
  └── Records 18 metric types, exposes Prometheus text format

MetricsServer
  └── HTTP server: GET /metrics (Prometheus) + GET /health (JSON)
```

#### 5.2 Poller — Adaptive Backoff

**Empty poll backoff (adaptive):**
```
delay = min(BASE_MS * 2^min(consecutive_empty_polls, MAX_EXPONENT), pollInterval)
```
- `BASE_MS`: 1ms
- `MAX_EXPONENT`: 10 (caps at 1024ms)
- Sequence: 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024ms
- Resets to 0 when tasks are received

**Auth failure backoff:**
```
delay = min(2^failures, 60) seconds
```
- Triggers on HTTP 401/403 from poll endpoint

**Poller constants:**
- `DEFAULT_POLL_INTERVAL`: 100ms
- `DEFAULT_CONCURRENCY`: 1
- `DEFAULT_BATCH_POLLING_TIMEOUT`: 100ms
- `MAX_RETRIES`: 4 (task update retries)

#### 5.3 TaskRunner — Execution Flow

```
Poll for tasks (batch)
  └─ For each task:
       ├─ Create TaskContext (AsyncLocalStorage / thread-local)
       ├─ Execute worker function within context
       ├─ Build TaskResult from return value
       │    ├─ Normal return → COMPLETED + outputData
       │    ├─ NonRetryableException → FAILED_WITH_TERMINAL_ERROR
       │    ├─ Other exception → FAILED + reasonForIncompletion
       │    └─ IN_PROGRESS return → callback after N seconds
       ├─ Update task via V2 endpoint (with retry — see 5.13)
       │    ├─ Success → Dispatch TaskUpdateCompleted event
       │    └─ All retries failed → Dispatch TaskUpdateFailure event (includes taskResult for recovery)
       └─ Dispatch events (execution completed/failed)
```

**V2 Task Update:** Uses `POST /tasks/{taskId}/v2` which combines task result update with the next poll in a single round-trip. This reduces latency for sequential task execution.

#### 5.4 TaskContext (MUST be Thread-Safe)

Per-task context accessible from any call depth (via AsyncLocalStorage, contextvars, thread-local, or language equivalent).

**CRITICAL: Thread Safety Requirement**

TaskContext **MUST** be thread-safe in any language with concurrent workers. Multiple workers execute tasks simultaneously (each worker can have `concurrency > 1`), meaning many TaskContext instances are active at the same time. Each task execution must see **only its own context**, never another task's.

The implementation strategy depends on your language's concurrency model:

| Language Model | Recommended Approach | How It Works |
|----------------|---------------------|--------------|
| **Async/event-loop** (JS/TS) | `AsyncLocalStorage` | Propagates context through async continuations automatically |
| **Thread-per-request** (Java) | `ThreadLocal<TaskContext>` | Each thread has its own storage; clean up after execution |
| **Green threads / coroutines** (Go) | `context.Context` parameter passing | Pass context explicitly through function calls |
| **Coroutines** (Python) | `contextvars.ContextVar` | Propagates through `async`/`await` chains |
| **Coroutines** (Kotlin) | `CoroutineContext` + `ThreadContextElement` | Flows through coroutine scope |
| **Actor model** (Erlang/Elixir) | Process dictionary | Each process is isolated by default |

**Common pitfalls:**
- **Thread pool reuse:** If using `ThreadLocal`, you MUST clear the context after task execution completes (in a `finally` block). Thread pools reuse threads, and a stale context from a previous task is a data leak / correctness bug.
- **Shared mutable state:** The `addLog()`, `setOutput()`, and `setCallbackAfter()` methods mutate context state. If your language allows concurrent access to the same context (e.g., if you spawn child threads from a worker), you need synchronization (mutex/lock) on the mutable fields.
- **Nested async calls:** Ensure your chosen mechanism propagates through the full async call chain. For example, Java's `ThreadLocal` does NOT propagate to `CompletableFuture.supplyAsync()` by default — you need `InheritableThreadLocal` or manual propagation.
- **Context cleanup:** Always wrap execution in try/finally to ensure context is removed even if the worker throws. Leaking a context reference causes memory leaks and incorrect behavior.

**Verification test:** Run 100 concurrent workers with `concurrency=5`, each writing its task ID to context. Assert that `getTaskContext().getTaskId()` always returns the correct ID for the current task, never another task's ID. This test catches thread-safety violations that are invisible at low concurrency.

**14 context methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `getTaskId()` | string? | Current task ID |
| `getWorkflowInstanceId()` | string? | Parent workflow ID |
| `getRetryCount()` | number | Current retry attempt |
| `getPollCount()` | number | How many times this task was polled |
| `getInput()` | map | Task input data |
| `getTaskDefName()` | string? | Task definition name |
| `getWorkflowTaskType()` | string? | Task type in workflow |
| `getTask()` | Task | Full task object |
| `addLog(message)` | void | Append execution log |
| `getLogs()` | list | Get all execution logs |
| `setCallbackAfter(seconds)` | void | Set async callback delay |
| `getCallbackAfterSeconds()` | number? | Get callback delay |
| `setOutput(data)` | void | Set output data |
| `getOutput()` | map? | Get current output data |

**Global accessor:** `getTaskContext()` — returns the context for the currently executing task, or undefined/null if called outside task execution.

#### 5.5 Event System

8 event types dispatched during the task lifecycle:

| Event | Fields | When |
|-------|--------|------|
| `PollStarted` | taskType, workerId, pollCount, timestamp | Before each poll |
| `PollCompleted` | taskType, durationMs, tasksReceived, timestamp | After successful poll |
| `PollFailure` | taskType, durationMs, cause, timestamp | After failed poll |
| `TaskExecutionStarted` | taskType, taskId, workerId, workflowInstanceId?, timestamp | Before worker function runs |
| `TaskExecutionCompleted` | taskType, taskId, workerId, workflowInstanceId?, durationMs, outputSizeBytes?, timestamp | After successful execution |
| `TaskExecutionFailure` | taskType, taskId, workerId, workflowInstanceId?, cause, durationMs, timestamp | After failed execution |
| `TaskUpdateCompleted` | taskType, taskId, workerId, workflowInstanceId?, durationMs, timestamp | After successful result update |
| `TaskUpdateFailure` | taskType, taskId, workerId, workflowInstanceId?, cause, retryCount, taskResult, timestamp | After failed result update |

**Dispatch rules:**
- Each listener method is optional (no-op if not implemented)
- Listener errors are caught and logged, never propagated to the task execution path
- Zero overhead when no listeners are registered

#### 5.6 Metrics Collector

Implements `TaskRunnerEventsListener`. Records 18 metric types.

**Counter metrics (cumulative):**

| Metric | Key | Description |
|--------|-----|-------------|
| `pollTotal` | taskType | Total polls by task type |
| `pollErrorTotal` | taskType | Failed polls by task type |
| `taskExecutionTotal` | taskType | Total task executions |
| `taskExecutionErrorTotal` | taskType:exceptionName | Execution errors by type + exception |
| `taskUpdateFailureTotal` | taskType | Failed result updates |
| `taskAckErrorTotal` | taskType | Acknowledgement errors |
| `taskExecutionQueueFullTotal` | taskType | Queue full rejections |
| `taskPausedTotal` | taskType | Pause events |
| `externalPayloadUsedTotal` | payloadType | External payload usage |
| `uncaughtExceptionTotal` | (global) | Uncaught exceptions |
| `workerRestartTotal` | (global) | Worker restarts |
| `workflowStartErrorTotal` | (global) | Workflow start errors |

**Histogram metrics (sliding window of observations):**

| Metric | Key | Description |
|--------|-----|-------------|
| `pollDurationMs` | taskType | Poll duration in milliseconds |
| `executionDurationMs` | taskType | Worker function execution time |
| `updateDurationMs` | taskType | Task result update time |
| `outputSizeBytes` | taskType | Output payload size |
| `workflowInputSizeBytes` | workflowType | Workflow input size |
| `apiRequestDurationMs` | method:uri:status | API request durations |

**Prometheus exposition:** `toPrometheusText(prefix?)` outputs Prometheus text format with quantiles (p50, p90, p99) computed from a sliding window (default 1000 observations).

**Optional `prom-client` bridge:** If the language has a Prometheus client library, provide an optional adapter for native registry integration. Ensure all summary keys emitted by the collector are registered in the adapter — missing registrations cause silent data loss.

**File output:** When writing metrics to a file periodically, perform an immediate first write on initialization (before the first interval fires), then use a periodic timer for subsequent writes. This avoids a startup delay where the metrics file is empty.

**Documentation:** Each SDK should maintain a `METRICS.md` file documenting all metrics with their Prometheus names, types, labels, and descriptions. See the TypeScript SDK's [METRICS.md](./METRICS.md) for the reference format.

#### 5.7 Worker Configuration via Environment Variables

Workers MUST support external configuration through environment variables, allowing operators to tune worker behavior without code changes. This is essential for Kubernetes deployments where the same container image runs with different configurations per environment.

**Configuration Hierarchy (highest priority wins):**

1. **Worker-specific env var (uppercase):** `CONDUCTOR_WORKER_<WORKER_NAME>_<PROPERTY>`
2. **Worker-specific env var (dotted):** `conductor.worker.<worker_name>.<property>`
3. **Global env var (uppercase):** `CONDUCTOR_WORKER_ALL_<PROPERTY>`
4. **Global env var (dotted):** `conductor.worker.all.<property>`
5. **Code-level** (decorator parameters / constructor options)
6. **System defaults**

**Configurable Properties:**

| Property | Env Var Suffix | Type | Default | Description |
|----------|---------------|------|---------|-------------|
| `pollInterval` | `POLL_INTERVAL` | number | 100 (ms) | How often to poll for tasks |
| `domain` | `DOMAIN` | string | undefined | Task domain for routing |
| `workerId` | `WORKER_ID` | string | auto | Unique worker identifier |
| `concurrency` | `CONCURRENCY` | number | 1 | Max parallel task executions |
| `registerTaskDef` | `REGISTER_TASK_DEF` | boolean | false | Auto-register task definition |
| `pollTimeout` | `POLL_TIMEOUT` | number | 100 (ms) | Server-side long poll timeout |
| `paused` | `PAUSED` | boolean | false | Start in paused state |
| `overwriteTaskDef` | `OVERWRITE_TASK_DEF` | boolean | true | Overwrite existing task defs |
| `strictSchema` | `STRICT_SCHEMA` | boolean | false | Enforce JSON schema |

**Property name conversion:** CamelCase to UPPER_SNAKE_CASE for env vars. `pollInterval` becomes `POLL_INTERVAL`.

**Boolean parsing:** Accept `"true"`, `"1"`, `"yes"`, `"on"` (case-insensitive) as truthy. Everything else is falsy.

**Number parsing:** Use standard number parsing. Log a warning and fall through to the next priority level if the value is not a valid number.

**Example: Kubernetes Deployment**

A single worker image deployed across staging and production with different configurations:

```yaml
# k8s/staging/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: conductor-workers
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: worker
        image: myorg/conductor-workers:latest
        env:
        # Global: all workers poll every 500ms in staging
        - name: CONDUCTOR_WORKER_ALL_POLL_INTERVAL
          value: "500"
        # Global: all workers use staging domain
        - name: CONDUCTOR_WORKER_ALL_DOMAIN
          value: "staging"
        # Per-worker: payment processor needs higher concurrency
        - name: CONDUCTOR_WORKER_PAYMENT_PROCESSOR_CONCURRENCY
          value: "10"
        # Per-worker: email sender uses its own domain
        - name: CONDUCTOR_WORKER_SEND_EMAIL_DOMAIN
          value: "email_staging"
        # Connection config
        - name: CONDUCTOR_SERVER_URL
          value: "https://conductor-staging.internal"
        - name: CONDUCTOR_AUTH_KEY
          valueFrom:
            secretRef:
              name: conductor-creds
              key: auth-key
        - name: CONDUCTOR_AUTH_SECRET
          valueFrom:
            secretRef:
              name: conductor-creds
              key: auth-secret
```

```yaml
# k8s/production/deployment.yaml — same image, different env vars
spec:
  replicas: 10
  template:
    spec:
      containers:
      - name: worker
        env:
        - name: CONDUCTOR_WORKER_ALL_POLL_INTERVAL
          value: "100"
        - name: CONDUCTOR_WORKER_ALL_DOMAIN
          value: "production"
        - name: CONDUCTOR_WORKER_ALL_CONCURRENCY
          value: "5"
        - name: CONDUCTOR_WORKER_PAYMENT_PROCESSOR_CONCURRENCY
          value: "20"
```

**Example: Docker Compose**

```yaml
services:
  workers:
    image: myorg/conductor-workers:latest
    environment:
      CONDUCTOR_SERVER_URL: http://conductor:8080
      CONDUCTOR_WORKER_ALL_POLL_INTERVAL: "200"
      CONDUCTOR_WORKER_ALL_DOMAIN: "local"
      CONDUCTOR_WORKER_PROCESS_ORDER_CONCURRENCY: "3"
```

**Example: Local Development (shell)**

```bash
# Override all workers to use a test domain
export CONDUCTOR_WORKER_ALL_DOMAIN=dev_local

# Override just one worker's poll interval for debugging
export CONDUCTOR_WORKER_SLOW_TASK_POLL_INTERVAL=5000

# Run the application — code-level @worker config is overridden
node dist/workers.js
```

**Resolution function pseudocode:**

```
function resolveWorkerConfig(workerName, codeDefaults):
    for each configurable property:
        value = checkEnv("CONDUCTOR_WORKER_{WORKER_NAME}_{PROPERTY}")  // worker-specific uppercase
              ?? checkEnv("conductor.worker.{worker_name}.{property}")  // worker-specific dotted
              ?? checkEnv("CONDUCTOR_WORKER_ALL_{PROPERTY}")            // global uppercase
              ?? checkEnv("conductor.worker.all.{property}")            // global dotted
              ?? codeDefaults[property]                                 // decorator/constructor
              ?? systemDefaults[property]                               // built-in defaults
        result[property] = parseValue(value, expectedType)
    return result
```

#### 5.8 Task Domains

Task domains allow routing tasks to specific worker pools. When a workflow task specifies `domain: "payments"`, only workers polling with `domain: "payments"` will receive those tasks. This is used for environment isolation (staging/production), tenant isolation, and specialized hardware routing.

**How domains flow through the system:**

```
@worker({ taskDefName: "process_order", domain: "payments" })
    │
    ▼
Worker Registry (key = "process_order:payments")
    │
    ▼
TaskRunner → Poller → HTTP GET /tasks/poll/batch/process_order?domain=payments
    │
    ▼
Server returns only tasks queued with domain "payments"
```

**Domain precedence in poll requests:**
1. Worker-level domain (from `@worker({ domain: "..." })` or env var)
2. TaskHandler-level domain (from `options.domain`)
3. `undefined` — no domain filtering (polls the default queue)

**CRITICAL: Empty String vs Null/Undefined Handling**

This is a subtle but high-severity bug source. The Conductor server treats `domain=""` (empty string) differently from `domain` being absent:
- `domain=undefined` or `domain` not sent → polls the **default queue** (no domain)
- `domain=""` (empty string) → polls for tasks with domain `""`, which is almost certainly **wrong** — tasks are queued with a real domain or no domain, never an empty string

**Your SDK MUST normalize empty strings to null/undefined before sending the poll request.** This prevents a class of bugs where:
- An environment variable is set to an empty string (`CONDUCTOR_WORKER_ALL_DOMAIN=""`)
- A config file has `domain: ""` instead of omitting the key
- Code passes `domain: ""` by accident

**Implementation rule:**
```
// In the poll request construction:
domain = (worker.domain ?? options.domain) || null
// The `|| null` converts "" to null, which is then omitted from the query string
```

**Registry keying:** Use `taskDefName + domain` as the registry key so the same task def name can have multiple workers with different domains:
- `"process_order:payments"` — worker for payments domain
- `"process_order:staging"` — worker for staging domain
- `"process_order:"` — worker for default (no domain)

**Same normalization applies to registry keys:** `undefined` and `""` should both resolve to the same key for the default (no-domain) worker.

**Example: Multi-domain workers**

```
// Same task type, different domains — each polls its own queue
@worker({ taskDefName: "send_email", domain: "us_east" })
function sendEmailUsEast(task) { ... }

@worker({ taskDefName: "send_email", domain: "eu_west" })
function sendEmailEuWest(task) { ... }

@worker({ taskDefName: "send_email" })  // No domain — polls default queue
function sendEmailDefault(task) { ... }

// All three workers run simultaneously, each polling different queues
handler = TaskHandler({ client, scanForDecorated: true })
handler.startWorkers()  // Starts 3 TaskRunners
```

**Example: Domain via environment variable (Kubernetes)**

```yaml
# Same container image, different domains per region
# us-east deployment
env:
  - name: CONDUCTOR_WORKER_ALL_DOMAIN
    value: "us_east"

# eu-west deployment
env:
  - name: CONDUCTOR_WORKER_ALL_DOMAIN
    value: "eu_west"
```

**Required E2E tests for task domains:**

These tests are critical because domain bugs are extremely difficult to debug — tasks silently sit in the wrong queue and are never picked up, with no error messages.

1. **Worker with domain polls only its domain's tasks:**
   - Register a worker with `domain: "test_domain"`
   - Start a workflow where the task is queued with `domain: "test_domain"`
   - Verify the worker picks up and completes the task
   - Start another workflow where the task has NO domain — verify it is NOT picked up by this worker

2. **Worker without domain polls only the default queue:**
   - Register a worker with no domain
   - Start a workflow with no task domain — verify the worker picks it up
   - Start a workflow with `domain: "some_domain"` — verify the worker does NOT pick it up

3. **Multiple workers with same task name but different domains:**
   - Register workers for `"shared_task"` with domains `"domain1"`, `"domain2"`, and no domain
   - Start 3 workflows, each queuing `"shared_task"` with the corresponding domain
   - Verify each worker picks up only its own domain's tasks

4. **Empty string domain treated as no domain:**
   - Register a worker with `domain: ""`
   - Verify it polls the default queue (same as `domain: undefined`)
   - This test catches the empty-string normalization bug

5. **Domain via environment variable override:**
   - Register a worker with `domain: "code_domain"` in code
   - Set `CONDUCTOR_WORKER_<NAME>_DOMAIN=env_domain` environment variable
   - Verify the worker polls with `domain: "env_domain"` (env overrides code)

#### 5.9 Worker Decorator / Registration

**Decorator pattern:**
```
@worker({
    taskDefName: "my_task",
    concurrency: 5,
    pollInterval: 100,
    domain: "staging",
    registerTaskDef: false,
    inputSchema: { ... },
    outputSchema: { ... }
})
function myWorker(task: Task) → TaskResult
```

**Global registry functions:**
- `registerWorker(worker)` — add to global registry
- `getRegisteredWorkers()` — list all registered workers
- `getRegisteredWorker(taskDefName, domain?)` — find specific worker
- `clearWorkerRegistry()` — clear all (for testing)
- `getWorkerCount()` — count registered workers

#### 5.10 TaskHandler — Lifecycle Management

```
handler = TaskHandler.create({
    client: authenticatedClient,
    workers: [manualWorkers],         // optional
    scanForDecorated: true,            // discover @worker functions
    eventListeners: [metricsCollector],
    healthMonitor: { enabled: true }
})

handler.startWorkers()   // start all TaskRunners
handler.stopWorkers()    // graceful shutdown
handler.isHealthy()      // all workers healthy?
handler.getWorkerStatus() // detailed per-worker status
handler.workerCount       // total registered
handler.runningWorkerCount // currently running
```

**Health Monitor:**
- Periodic health check (default 5000ms interval)
- Auto-restart failed workers with exponential backoff (1s base, 60s cap)
- Configurable max restart attempts (0 = unlimited)

#### 5.11 NonRetryableException

Throw from a worker function to mark the task as `FAILED_WITH_TERMINAL_ERROR`. Conductor will not retry the task regardless of the task definition's retry settings.

```
throw NonRetryableException("Order not found - permanent failure")
```

#### 5.12 Schema Validation

Workers can define JSON schemas for input/output validation, enabling compile-time-like safety for task data contracts.

**Decorator-based schema:**
```
@worker({
    taskDefName: "my_task",
    inputSchema: { type: "object", properties: { orderId: { type: "string" } }, required: ["orderId"] },
    outputSchema: { type: "object", properties: { status: { type: "string" } } }
})
function myWorker(task: Task) → TaskResult
```

**Auto-generated schema:** Use a `@schemaField()` decorator (or language equivalent annotation) to auto-generate JSON schemas from typed class properties. This avoids manual schema writing.

**Strict mode:** When `strictSchema: true`, the SDK validates task input against the schema before executing the worker function. Invalid input causes the task to fail immediately with a validation error, without running the worker code.

**Task definition registration:** When `registerTaskDef: true` (or `overwriteTaskDef: true` by default), the SDK updates the task definition on the server with the input/output schema from the decorator on worker startup. This keeps schema definitions in code as the source of truth.

**Reference:** `src/sdk/worker/schema/generateJsonSchema.ts`, `src/sdk/worker/schema/decorators.ts`

#### 5.13 Task Update Failure Handling

When a worker executes a task successfully but the result update to the server fails (network error, server down, timeout), the task result is at risk of being lost. The SDK MUST provide a robust failure handling pipeline with retry, event notification, and user-extensible recovery.

**Update Failure Pipeline:**

```
Worker executes task → Build TaskResult
  │
  ├─ POST /tasks/{taskId}/v2 (attempt 1)
  │     ├─ Success → Publish TaskUpdateCompleted event, continue
  │     └─ Failure ↓
  │
  ├─ Retry with backoff (attempts 2..MAX_RETRIES)
  │     ├─ Backoff: retryCount * 10,000ms (10s, 20s, 30s, 40s)
  │     ├─ Success on any retry → Publish TaskUpdateCompleted, continue
  │     └─ All retries exhausted ↓
  │
  ├─ Publish TaskUpdateFailure event (INCLUDES full taskResult for recovery)
  ├─ Call onError callback (if registered)
  ├─ Increment taskUpdateFailureTotal metric
  └─ Log critical error and continue polling
```

**MAX_RETRIES:** 4 (configurable via TaskRunner constructor). Backoff formula: `retryCount * 10_000ms`.

**CRITICAL: The TaskUpdateFailure event MUST include the full `taskResult` payload.** This is the only way for users to recover from a permanent update failure. Without the payload, the task result is irrecoverably lost — the worker did the work, but the server never received the result.

**TaskUpdateFailure event fields:**

| Field | Type | Description |
|-------|------|-------------|
| `taskType` | string | Task definition name |
| `taskId` | string | Task ID that failed to update |
| `workerId` | string | Worker that executed the task |
| `workflowInstanceId` | string? | Parent workflow ID |
| `cause` | Error | The error from the last retry attempt |
| `retryCount` | number | Total retry attempts made |
| `taskResult` | TaskResult | **The full result payload** — enables recovery |
| `timestamp` | Date | When the final failure occurred |

**User-facing hooks (two levels):**

1. **Event listener (full context):** Register a `TaskRunnerEventsListener` with an `onTaskUpdateFailure()` method. Receives the complete `TaskUpdateFailure` event including the `taskResult`. Use this for recovery (persist to DB, dead-letter queue, replay later).

2. **Error callback (lightweight):** Register an `onError` callback on `TaskHandler`. Receives `(error, task)` but NOT the `taskResult`. Use this for logging/alerting only, not recovery.

**Registration:**
```
listener = {
    onTaskUpdateFailure(event):
        // Handle the failure — persist result, alert, retry externally
        persistToDatabase(event.taskId, event.taskResult)
        alertOps("Task update failed", event)
}

handler = TaskHandler({
    client,
    eventListeners: [listener],   // Receives TaskUpdateFailure with full payload
    onError: (error, task) => {   // Lightweight — no taskResult, just error + task
        log.error("Worker error", error, task?.taskId)
    }
})
```

**Recovery patterns:**

```
// Pattern 1: Persist to database for manual recovery
onTaskUpdateFailure(event):
    db.insert({
        taskId: event.taskId,
        workflowId: event.workflowInstanceId,
        result: event.taskResult,    // Full payload for replay
        error: event.cause.message,
        timestamp: event.timestamp
    })
    alertOps("Task update failed permanently", event)

// Pattern 2: Write to local file (simple, no external deps)
onTaskUpdateFailure(event):
    appendToFile("/var/conductor/failed-updates.jsonl",
        JSON.stringify({ taskId: event.taskId, result: event.taskResult }))

// Pattern 3: Push to dead-letter queue for automated replay
onTaskUpdateFailure(event):
    deadLetterQueue.push({
        endpoint: "/tasks/" + event.taskId,
        body: event.taskResult,
        retryAfter: 60_000  // Retry in 1 minute
    })
```

**Why this matters in production:**

Without update failure handling, a network blip between your worker and the Conductor server causes:
1. Worker executed the task (possibly with side effects like sending an email)
2. Result never reaches the server → server thinks the task is still in progress
3. Server eventually times out the task → schedules it for retry
4. Worker executes the task AGAIN → duplicate side effects (double email)

With proper handling:
1. Worker executes the task
2. Update fails → SDK retries 4 times with backoff
3. Still failing → `TaskUpdateFailure` event fires with the full result
4. Your listener persists the result → ops team or automation can replay it
5. No duplicate execution needed

**Reference:** `src/sdk/clients/worker/TaskRunner.ts` (updateTaskWithRetry), `src/sdk/clients/worker/events/types.ts` (TaskUpdateFailure)

### Phase 6: Builders

**Goal:** Fluent DSL for constructing workflows and tasks programmatically.

#### 6.1 ConductorWorkflow Builder

Fluent builder with 26 methods:

| Method | Description |
|--------|-------------|
| `constructor(executor, name, version?, description?)` | Create workflow |
| `getName()` | Get workflow name |
| `getVersion()` | Get workflow version |
| `add(task)` | Append task(s) sequentially |
| `fork(branches)` | Add parallel fork with auto-generated join |
| `toSubWorkflowTask(refName)` | Convert to SUB_WORKFLOW task |
| `description(desc)` | Set description |
| `version(v)` | Set version number |
| `timeoutPolicy(policy)` | TIME_OUT_WF or ALERT_ONLY |
| `timeoutSeconds(n)` | Set timeout |
| `ownerEmail(email)` | Set owner |
| `failureWorkflow(name)` | Set failure workflow |
| `restartable(val)` | Set restartable flag |
| `inputParameters(params)` | Set input parameter names |
| `inputTemplate(template)` | Set input defaults |
| `workflowInput(input)` | Alias for inputTemplate |
| `outputParameters(params)` | Set all output params |
| `outputParameter(key, value)` | Set single output param |
| `variables(vars)` | Set workflow variables |
| `enableStatusListener(sink)` | Enable status listener |
| `disableStatusListener()` | Disable status listener |
| `input(jsonPath)` | Get `${workflow.input.field}` expression |
| `output(jsonPath?)` | Get `${workflow.output.field}` expression |
| `toWorkflowDef()` | Convert to WorkflowDef object |
| `register(overwrite?)` | Register with server (default overwrite=true) |
| `execute(input?, waitUntilTaskRef?, requestId?, ...)` | Execute synchronously |
| `startWorkflow(input?, correlationId?, ...)` | Start asynchronously |

**Important:** `ConductorWorkflow.register()` defaults to `overwrite=true`, but `MetadataClient.registerWorkflowDef()` defaults to `overwrite=false`.

#### 6.2 Core Task Builders (26 functions from 21 files)

All builders follow the convention: **first argument is always `taskReferenceName`**.

| Builder | Signature |
|---------|-----------|
| `simpleTask` | `(refName, taskDefName, inputParameters, optional?)` |
| `httpTask` | `(refName, inputParameters, asyncComplete?, optional?)` |
| `httpPollTask` | `(refName, inputParameters, optional?)` |
| `inlineTask` | `(refName, script, evaluatorType?, optional?)` |
| `subWorkflowTask` | `(refName, workflowName, version?, optional?)` |
| `switchTask` | `(refName, expression, decisionCases?, defaultCase?, optional?)` |
| `forkTask` | `(refName, forkTasks)` |
| `forkTaskJoin` | `(refName, forkTasks, optional?)` → returns `[ForkJoinTask, JoinTask]` |
| `joinTask` | `(refName, joinOn, optional?)` |
| `dynamicTask` | `(refName, dynamicTaskName, dynamicTaskParam?, optional?)` |
| `dynamicForkTask` | `(refName, preForkTasks?, dynamicTasksInput?, optional?)` |
| `doWhileTask` | `(refName, terminationCondition, tasks, optional?)` |
| `newLoopTask` | `(refName, iterations, tasks, optional?)` |
| `waitTaskDuration` | `(refName, duration, optional?)` |
| `waitTaskUntil` | `(refName, until, optional?)` |
| `waitForWebhookTask` | `(refName, options?)` |
| `setVariableTask` | `(refName, inputParameters, optional?)` |
| `terminateTask` | `(refName, status, terminationReason?)` |
| `eventTask` | `(refName, eventPrefix, eventSuffix, optional?)` |
| `sqsEventTask` | `(refName, queueName, optional?)` |
| `conductorEventTask` | `(refName, eventName, optional?)` |
| `humanTask` | `(refName, options?)` |
| `startWorkflowTask` | `(refName, workflowName, input?, version?, correlationId?, optional?)` |
| `kafkaPublishTask` | `(refName, kafka_request, optional?)` |
| `jsonJqTask` | `(refName, script, optional?)` |
| `getDocumentTask` | `(refName, url, options?)` |

#### 6.3 LLM Task Builders (15 functions)

| Builder | Signature |
|---------|-----------|
| `llmChatCompleteTask` | `(refName, provider, model, options?)` |
| `llmTextCompleteTask` | `(refName, provider, model, promptName, options?)` |
| `llmGenerateEmbeddingsTask` | `(refName, provider, model, text, options?)` |
| `llmIndexTextTask` | `(refName, vectorDb, index, embeddingModel, text, docId, options?)` |
| `llmIndexDocumentTask` | `(refName, vectorDb, index, embeddingModel, url, mediaType, options?)` |
| `llmSearchIndexTask` | `(refName, vectorDb, index, embeddingModel, query, options?)` |
| `llmSearchEmbeddingsTask` | `(refName, vectorDb, index, embeddings, options?)` |
| `llmStoreEmbeddingsTask` | `(refName, vectorDb, index, embeddings, options?)` |
| `llmQueryEmbeddingsTask` | `(refName, vectorDb, index, embeddings, options?)` |
| `generateImageTask` | `(refName, provider, model, prompt, options?)` |
| `generateAudioTask` | `(refName, provider, model, options?)` |
| `callMcpToolTask` | `(refName, mcpServer, method, options?)` |
| `listMcpToolsTask` | `(refName, mcpServer, options?)` |
| `withPromptVariable` | `(task, variable, value)` — helper |
| `withPromptVariables` | `(task, variables)` — helper |

#### 6.4 Factory Functions

| Function | Description |
|----------|-------------|
| `workflow(name, tasks)` | Create a minimal WorkflowDef |
| `taskDefinition(config)` | Create a TaskDef with sensible defaults |

#### 6.5 Workflow Expression Syntax

Conductor uses `${...}` expressions (dollar-brace, NOT JavaScript template literals) to reference data within workflow definitions:

| Expression | Meaning |
|------------|---------|
| `${workflow.input.fieldName}` | Workflow input parameter |
| `${workflow.output.fieldName}` | Workflow output parameter |
| `${taskRefName.output.fieldName}` | Output from a completed task |
| `${taskRefName.input.fieldName}` | Input that was passed to a task |

**Builder helpers on ConductorWorkflow:**
- `workflow.input("fieldName")` → returns the string `"${workflow.input.fieldName}"`
- `workflow.output("fieldName")` → returns the string `"${workflow.output.fieldName}"`

These helpers prevent typos in expression strings and make workflow definitions more readable.

**Usage in task input parameters:**
```
const wf = new ConductorWorkflow(executor, "my_workflow")
  .add(simpleTask("step1", "process_order", {
    orderId: wf.input("orderId"),       // → "${workflow.input.orderId}"
    config: wf.input("config")          // → "${workflow.input.config}"
  }))
  .add(simpleTask("step2", "send_email", {
    result: "${step1.output.result}"     // Reference previous task output
  }))
```

### Phase 7: Examples

**Goal:** 36 runnable example files demonstrating all SDK features.

#### 7.1 Core Examples (14 files)

| File | Demonstrates |
|------|-------------|
| `helloworld.ts` | Minimal worker + workflow |
| `quickstart.ts` | Getting started pattern |
| `kitchensink.ts` | All task types in one workflow |
| `dynamic-workflow.ts` | Programmatic workflow builder |
| `workflow-ops.ts` | Lifecycle: pause, resume, terminate, retry, restart |
| `workers-e2e.ts` | Multiple workers chained |
| `worker-configuration.ts` | Worker options and settings |
| `task-configure.ts` | Task definition configuration |
| `task-context.ts` | TaskContext usage |
| `metrics.ts` | MetricsCollector + Prometheus |
| `event-listeners.ts` | Event system usage |
| `express-worker-service.ts` | HTTP server + workers |
| `perf-test.ts` | Performance / throughput test |
| `test-workflows.ts` | Workflow testing patterns |

#### 7.2 Advanced Examples (8 files)

| File | Demonstrates |
|------|-------------|
| `advanced/fork-join.ts` | Parallel execution pattern |
| `advanced/sub-workflows.ts` | Sub-workflow composition |
| `advanced/rag-workflow.ts` | RAG pipeline with embeddings |
| `advanced/vector-db.ts` | Vector database operations |
| `advanced/http-poll.ts` | HTTP polling tasks |
| `advanced/sync-updates.ts` | Synchronous task updates |
| `advanced/wait-for-webhook.ts` | Webhook wait pattern |
| `advanced/human-tasks.ts` | Human-in-the-loop workflow |

#### 7.3 Agentic / AI Examples (5 files)

| File | Demonstrates |
|------|-------------|
| `agentic-workflows/function-calling.ts` | LLM tool/function calling |
| `agentic-workflows/multiagent-chat.ts` | Multi-agent debate |
| `agentic-workflows/llm-chat.ts` | LLM chat completion |
| `agentic-workflows/llm-chat-human-in-loop.ts` | Human-in-the-loop AI |
| `agentic-workflows/mcp-weather-agent.ts` | MCP tool integration |

#### 7.4 API Journey Examples (9 files)

One per domain area, demonstrating complete CRUD lifecycle:

| File | Domain |
|------|--------|
| `api-journeys/authorization.ts` | Users, groups, permissions |
| `api-journeys/metadata.ts` | Task defs, workflow defs, tags |
| `api-journeys/prompts.ts` | Prompt CRUD + testing |
| `api-journeys/schedules.ts` | Schedule lifecycle |
| `api-journeys/secrets.ts` | Secret management |
| `api-journeys/integrations.ts` | Integration providers + APIs |
| `api-journeys/schemas.ts` | Schema registration + versioning |
| `api-journeys/applications.ts` | Applications, access keys, roles |
| `api-journeys/event-handlers.ts` | Event handlers, queues, tags |

#### 7.5 Example Conventions

- **Self-contained:** Each file connects via `OrkesClients.from()`, creates resources, runs logic, cleans up
- **Env vars:** `CONDUCTOR_SERVER_URL` (required), `CONDUCTOR_AUTH_KEY`/`CONDUCTOR_AUTH_SECRET` (optional for OSS)
- **AI examples:** `LLM_PROVIDER` and `LLM_MODEL` env vars with defaults
- **Cleanup:** Try/finally blocks to delete created resources
- **Naming:** Language-idiomatic file naming (kebab-case for JS, snake_case for Python, etc.)

### Phase 8: Tests

**Goal:** Comprehensive test coverage at unit, integration, and performance levels.

#### 8.1 Unit Tests

Co-located with source code in `__tests__/` directories. Target ~470+ test cases covering:

| Area | Test Files | Focus |
|------|-----------|-------|
| Builders | factory.test, newBuilders.test, ConductorWorkflow.test, llmBuilders.test | All builder functions produce correct WorkflowTask objects |
| Transport | createConductorClient.test, handleAuth.test, fetchWithRetry.test, resolveOrkesConfig.test, resolveFetchFn.test | Auth lifecycle, retry, config resolution |
| Worker | TaskRunner.test, Poller.test, Poller.adaptive.test, helpers.test | Polling, backoff, execution |
| Decorators | worker.test | @worker decorator registration |
| Context | TaskContext.test | All 14 context methods |
| Metrics | MetricsCollector.test, MetricsCollector.prometheus.test, MetricsServer.test, PrometheusRegistry.test | All 18 metrics, Prometheus format |
| Events | EventDispatcher.test | All 8 event types |
| Schema | generateJsonSchema.test, decorators.test | JSON Schema generation |
| Clients | MetadataClient.test, MetadataClient.rateLimit.test | Client method behavior |
| Config | WorkerConfig.test | Worker configuration resolution |

#### 8.2 Integration Tests

Against a real Conductor server. 22 test files:

| Test File | Client / Feature |
|-----------|-----------------|
| WorkflowExecutor.test | Core workflow operations |
| WorkflowExecutor.complete.test | Extended workflow operations |
| TaskClient.complete.test | All task client methods |
| MetadataClient.test | Metadata operations |
| MetadataClient.complete.test | Extended metadata + rate limits |
| SchedulerClient.test | Schedule lifecycle |
| AuthorizationClient.test | Users, groups, permissions |
| SecretClient.test | Secret CRUD |
| SchemaClient.test | Schema registration |
| IntegrationClient.test | Integration providers |
| PromptClient.test | Prompt CRUD + test |
| ApplicationClient.test | Application management |
| EventClient.test | Event handlers |
| ServiceRegistryClient.test | Service registry |
| ConductorWorkflow.test | DSL builder E2E |
| TaskRunner.test | Worker execution E2E |
| TaskManager.test | Task management |
| WorkerRegistration.test | Decorator discovery |
| WorkerAdvanced.test | Advanced worker features |
| WorkflowResourceService.test | Resource service |
| E2EFiveTaskWorkflow.test | Multi-task pipeline |
| readme.test | README examples verification |

#### 8.3 Performance Tests

- **Throughput:** Measure tasks/second at various concurrency levels
- **Latency:** p50, p90, p99 for poll → execute → update cycle
- **Connection pooling:** HTTP/2 vs HTTP/1.1 comparison

#### 8.4 Testing Conventions

- Resource names: `sdktest_thing_{timestamp}` (lowercase, underscores, unique suffix)
- Cleanup: Individual try/catch per resource in afterAll/teardown
- Timeouts: 60s minimum per test
- Worker tests: Clear global registry after each test
- Version gating: Skip tests for features not available on the server version
- Error paths: Every client gets negative tests (not-found, invalid input)

#### 8.5 CI/CD Setup

**Test environments:**
- **Unit tests:** Run locally, no server needed (mock HTTP calls)
- **Integration tests:** Require a running Conductor server
  - Env var `CONDUCTOR_SERVER_URL` for server address
  - Env var `ORKES_BACKEND_VERSION` for version-gated tests (v4 vs v5)

**CI pipeline stages:**
1. Lint — static analysis and code style
2. Unit tests — all `__tests__/` directories
3. Build — compile and bundle
4. Integration tests — against test server (may run in a separate pipeline)
5. Publish — on release tags (npm, PyPI, Maven Central, etc.)

**Resource naming in tests:** Use `sdktest_{thing}_{timestamp}` pattern (lowercase, underscores) for all created resources. The timestamp suffix prevents collisions when tests run in parallel or when cleanup from a previous run failed.

**Cleanup pattern:** In teardown/afterAll, wrap each resource deletion in an individual try/catch so one failed deletion doesn't prevent cleanup of remaining resources:

```
afterAll:
    try: deleteWorkflow(wfName)       catch: log warning
    try: deleteTaskDef(taskName)      catch: log warning
    try: deleteSchedule(schedName)    catch: log warning
    // Each deletion is independent
```

### Phase 9: Packaging & Distribution

**Goal:** Prepare the SDK for publication and consumption.

#### 9.1 Module Structure

- **Public API surface:** Single entry point (index file) re-exporting all clients, builders, types, worker utilities, and factory functions
- **Internal modules:** HTTP layer, OpenAPI-generated code, and transport internals should NOT be part of the public API. Users should interact only through domain clients and builders
- **Type exports:** All request/response types, enums, config interfaces, and error classes must be importable by users

#### 9.2 Build Targets

- Provide both ESM and CommonJS output (or your language's equivalent dual-format) if applicable
- Target the minimum supported version of your language runtime (e.g., Node 18+, Python 3.9+, Java 11+)
- Include source maps / debug symbols for development builds
- Minification is generally NOT recommended for SDK packages — readability of stack traces matters

#### 9.3 Documentation

| Document | Purpose |
|----------|---------|
| `README.md` | Quick start, installation, basic usage examples |
| `METRICS.md` | All Prometheus metrics with names, types, labels, and descriptions |
| `CHANGELOG.md` | Version history with breaking changes highlighted |
| API reference | Auto-generated from source (TypeDoc, Sphinx, Javadoc, etc.) |

#### 9.4 Versioning

Follow semantic versioning (semver). Breaking changes to the public API require a major version bump. New client methods, builders, or configuration options are minor version bumps.

---

## 5. Feature Accounting Table

Track implementation progress with this checklist. Mark each feature as: `[ ]` Not started, `[~]` In progress, `[x]` Complete.

### 5.1 HTTP Client Layer + Transport

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| T1 | Token generation (POST /api/token) | [ ] | keyId + keySecret → JWT |
| T2 | X-Authorization header (not Authorization) | [ ] | Custom header name |
| T3 | Skip auth when keyId/keySecret absent | [ ] | No token fetch, no header |
| T4 | OSS detection: 404 on /api/token → disable auth | [ ] | Set isOss flag, no header, no refresh |
| T5 | OSS: log info message on detection | [ ] | |
| T6 | Fatal error if initial /token fails (non-404) | [ ] | Throw, do not silently disable |
| T7 | Token caching with timestamp | [ ] | token + tokenObtainedAt |
| T8 | Token TTL check (45 min) | [ ] | Pre-request inline refresh |
| T9 | Background token refresh timer | [ ] | min(configured, TTL*0.8) |
| T10 | Background refresh stoppable (cleanup) | [ ] | clearInterval on shutdown |
| T11 | Concurrent refresh mutex / promise coalescing | [ ] | Prevent N concurrent refreshes |
| T12 | Auth failure exponential backoff | [ ] | 2^(n-1)*1s, cap 60s |
| T13 | Backoff skip check (shouldBackoff) | [ ] | Skip refresh if in backoff window |
| T14 | Fallback to existing token on refresh failure | [ ] | Better than no token |
| T15 | consecutiveFailures counter + reset on success | [ ] | |
| T16 | Log escalation: warn → error at MAX_AUTH_FAILURES | [ ] | |
| T17 | Auth retry: parse error code from 401/403 response body | [ ] | `{ "error": "EXPIRED_TOKEN" }` |
| T18 | Auth retry: ONLY retry for EXPIRED_TOKEN or INVALID_TOKEN | [ ] | Match Python SDK behavior |
| T19 | Auth retry: do NOT retry permission errors (other 401/403) | [ ] | Return immediately |
| T20 | Auth retry: replace X-Authorization on retry | [ ] | Clone request with new header |
| T20a | Auth retry: no loop (retry exactly once) | [ ] | |
| T20b | Auth retry: 401 with non-JSON body → treat as token error | [ ] | Safe default |
| T20c | Auth retry: 403 with non-JSON body → treat as permission error | [ ] | Safe default |
| T21 | Transport retry (3x, linear backoff) | [ ] | Network errors only |
| T22 | Rate limit retry (5x, exponential) | [ ] | HTTP 429 |
| T23 | Jitter on all retries (±10%) | [ ] | Thundering herd prevention |
| T24 | Timeout errors NOT retried | [ ] | Propagate immediately |
| T25 | HTTP/2 with connection pooling | [ ] | Optional |
| T26 | TLS/mTLS client certificates | [ ] | |
| T27 | Proxy support | [ ] | |
| T28 | Per-request timeout (60s default) | [ ] | |
| T29 | Connect timeout (10s default) | [ ] | |
| T30 | 11 environment variables | [ ] | See table in Phase 2 |
| T31 | Config object overrides env vars | [ ] | |
| T32 | Server URL normalization (strip / and /api) | [ ] | |
| T33 | Logger interface (ConductorLogger) | [ ] | debug, info, warn, error |
| T34 | DefaultLogger + noopLogger implementations | [ ] | |

### 5.2 Client Factory

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| F1 | `OrkesClients.from(config)` | [ ] | |
| F2 | `createConductorClient(config)` | [ ] | |
| F3 | `orkesConductorClient` alias | [ ] | Convention for tests |
| F4 | 14 domain client getters on OrkesClients | [ ] | |

### 5.3 Domain Clients — WorkflowExecutor (28 methods)

| # | Method | Status | Notes |
|---|--------|--------|-------|
| WE1 | `registerWorkflow(override, workflow)` | [ ] | |
| WE2 | `startWorkflow(workflowRequest)` | [ ] | |
| WE3 | `executeWorkflow(request, name, version, requestId, waitUntilTaskRef?)` | [ ] | Synchronous execution |
| WE4 | `goBackToTask(workflowId, taskFinderPredicate, overrides?)` | [ ] | |
| WE5 | `goBackToFirstTaskMatchingType(workflowId, taskType)` | [ ] | |
| WE6 | `getWorkflow(workflowId, includeTasks, retry?)` | [ ] | Built-in retry on 500/404/403 |
| WE7 | `getWorkflowStatus(workflowId, includeOutput, includeVariables)` | [ ] | Lighter response |
| WE8 | `getExecution(workflowId, includeTasks?)` | [ ] | No retry |
| WE9 | `pause(workflowId)` | [ ] | |
| WE10 | `reRun(workflowId, rerunRequest?)` | [ ] | |
| WE11 | `restart(workflowId, useLatestDefinitions)` | [ ] | |
| WE12 | `resume(workflowId)` | [ ] | |
| WE13 | `retry(workflowId, resumeSubworkflowTasks)` | [ ] | |
| WE14 | `search(start, size, query, freeText, sort?, skipCache?)` | [ ] | |
| WE15 | `skipTasksFromWorkflow(workflowId, taskRefName, skipRequest)` | [ ] | |
| WE16 | `terminate(workflowId, reason)` | [ ] | |
| WE17 | `updateTask(taskId, workflowId, taskStatus, outputData)` | [ ] | |
| WE18 | `updateTaskByRefName(taskRefName, workflowId, status, taskOutput)` | [ ] | |
| WE19 | `getTask(taskId)` | [ ] | |
| WE20 | `updateTaskSync(taskRefName, workflowId, status, taskOutput, workerId?)` | [ ] | |
| WE21 | `signal(workflowId, status, taskOutput, returnStrategy?)` | [ ] | All 4 return strategies |
| WE22 | `signalAsync(workflowId, status, taskOutput)` | [ ] | |
| WE23 | `deleteWorkflow(workflowId, archiveWorkflow?)` | [ ] | |
| WE24 | `getByCorrelationIds(request, includeClosed?, includeTasks?)` | [ ] | |
| WE25 | `testWorkflow(testRequest)` | [ ] | |
| WE26 | `updateVariables(workflowId, variables)` | [ ] | |
| WE27 | `updateState(workflowId, updateRequest, requestId, waitUntilTaskRef?, waitForSeconds?)` | [ ] | |
| WE28 | `startWorkflowByName(name, input, version?, correlationId?, priority?)` | [ ] | |

### 5.4 Domain Clients — TaskClient (8 methods)

| # | Method | Status | Notes |
|---|--------|--------|-------|
| TC1 | `search(start, size, sort?, freeText, query)` | [ ] | |
| TC2 | `getTask(taskId)` | [ ] | |
| TC3 | `updateTaskResult(workflowId, taskRefName, status, outputData)` | [ ] | |
| TC4 | `addTaskLog(taskId, message)` | [ ] | |
| TC5 | `getTaskLogs(taskId)` | [ ] | |
| TC6 | `getQueueSizeForTask(taskType?)` | [ ] | |
| TC7 | `getTaskPollData(taskType)` | [ ] | |
| TC8 | `updateTaskSync(workflowId, taskRefName, status, output, workerId?)` | [ ] | |

### 5.5 Domain Clients — MetadataClient (21 methods)

| # | Method | Status | Notes |
|---|--------|--------|-------|
| MC1 | `unregisterTask(name)` | [ ] | |
| MC2 | `registerTask(taskDef)` | [ ] | |
| MC3 | `registerTasks(taskDefs)` | [ ] | |
| MC4 | `updateTask(taskDef)` | [ ] | |
| MC5 | `getTask(taskName)` | [ ] | |
| MC6 | `registerWorkflowDef(workflowDef, overwrite?)` | [ ] | Default overwrite=false |
| MC7 | `getWorkflowDef(name, version?, metadata?)` | [ ] | |
| MC8 | `unregisterWorkflow(workflowName, version?)` | [ ] | |
| MC9 | `getAllTaskDefs()` | [ ] | |
| MC10 | `getAllWorkflowDefs()` | [ ] | |
| MC11 | `addWorkflowTag(tag, name)` | [ ] | |
| MC12 | `deleteWorkflowTag(tag, name)` | [ ] | |
| MC13 | `getWorkflowTags(name)` | [ ] | |
| MC14 | `setWorkflowTags(tags, name)` | [ ] | |
| MC15 | `addTaskTag(tag, taskName)` | [ ] | |
| MC16 | `deleteTaskTag(tag, taskName)` | [ ] | |
| MC17 | `getTaskTags(taskName)` | [ ] | |
| MC18 | `setTaskTags(tags, taskName)` | [ ] | |
| MC19 | `setWorkflowRateLimit(rateLimitConfig, name)` | [ ] | Raw HTTP — not in OpenAPI spec |
| MC20 | `getWorkflowRateLimit(name)` | [ ] | Raw HTTP |
| MC21 | `removeWorkflowRateLimit(name)` | [ ] | Raw HTTP |

### 5.6 Domain Clients — SchedulerClient (14 methods)

| # | Method | Status | Notes |
|---|--------|--------|-------|
| SC1 | `saveSchedule(param)` | [ ] | |
| SC2 | `search(start, size?, sort?, freeText?, query?)` | [ ] | |
| SC3 | `getSchedule(name)` | [ ] | |
| SC4 | `pauseSchedule(name)` | [ ] | |
| SC5 | `resumeSchedule(name)` | [ ] | |
| SC6 | `deleteSchedule(name)` | [ ] | |
| SC7 | `getAllSchedules(workflowName?)` | [ ] | |
| SC8 | `getNextFewSchedules(cron, start?, end?, limit?)` | [ ] | |
| SC9 | `pauseAllSchedules()` | [ ] | |
| SC10 | `requeueAllExecutionRecords()` | [ ] | |
| SC11 | `resumeAllSchedules()` | [ ] | |
| SC12 | `setSchedulerTags(tags, name)` | [ ] | |
| SC13 | `getSchedulerTags(name)` | [ ] | |
| SC14 | `deleteSchedulerTags(tags, name)` | [ ] | |

### 5.7 Domain Clients — AuthorizationClient (19 methods)

| # | Method | Status | Notes |
|---|--------|--------|-------|
| AC1 | `grantPermissions(request)` | [ ] | |
| AC2 | `getPermissions(type, id)` | [ ] | |
| AC3 | `removePermissions(request)` | [ ] | |
| AC4 | `upsertUser(id, request)` | [ ] | Server lowercases ID |
| AC5 | `getUser(id)` | [ ] | |
| AC6 | `listUsers(apps?)` | [ ] | |
| AC7 | `deleteUser(id)` | [ ] | |
| AC8 | `checkPermissions(userId, type, id)` | [ ] | |
| AC9 | `getGrantedPermissionsForUser(userId)` | [ ] | |
| AC10 | `upsertGroup(id, request)` | [ ] | |
| AC11 | `getGroup(id)` | [ ] | |
| AC12 | `listGroups()` | [ ] | |
| AC13 | `deleteGroup(id)` | [ ] | |
| AC14 | `addUserToGroup(groupId, userId)` | [ ] | |
| AC15 | `addUsersToGroup(groupId, userIds)` | [ ] | |
| AC16 | `getUsersInGroup(id)` | [ ] | |
| AC17 | `removeUserFromGroup(groupId, userId)` | [ ] | |
| AC18 | `removeUsersFromGroup(groupId, userIds)` | [ ] | |
| AC19 | `getGrantedPermissionsForGroup(groupId)` | [ ] | |

### 5.8 Domain Clients — SecretClient (9 methods)

| # | Method | Status | Notes |
|---|--------|--------|-------|
| SE1 | `putSecret(key, value)` | [ ] | |
| SE2 | `getSecret(key)` | [ ] | |
| SE3 | `deleteSecret(key)` | [ ] | |
| SE4 | `listAllSecretNames()` | [ ] | |
| SE5 | `listSecretsThatUserCanGrantAccessTo()` | [ ] | |
| SE6 | `secretExists(key)` | [ ] | |
| SE7 | `setSecretTags(tags, key)` | [ ] | |
| SE8 | `getSecretTags(key)` | [ ] | |
| SE9 | `deleteSecretTags(tags, key)` | [ ] | |

### 5.9 Domain Clients — SchemaClient (6 methods)

| # | Method | Status | Notes |
|---|--------|--------|-------|
| SH1 | `registerSchema(schemas, newVersion?)` | [ ] | |
| SH2 | `getSchema(name, version)` | [ ] | |
| SH3 | `getSchemaByName(name)` | [ ] | |
| SH4 | `getAllSchemas()` | [ ] | |
| SH5 | `deleteSchema(name, version)` | [ ] | |
| SH6 | `deleteSchemaByName(name)` | [ ] | |

### 5.10 Domain Clients — IntegrationClient (20 methods)

| # | Method | Status | Notes |
|---|--------|--------|-------|
| IC1 | `saveIntegrationProvider(name, integration)` | [ ] | |
| IC2 | `getIntegrationProvider(name)` | [ ] | |
| IC3 | `getIntegrationProviders()` | [ ] | |
| IC4 | `deleteIntegrationProvider(name)` | [ ] | |
| IC5 | `saveIntegrationApi(providerName, integrationName, api)` | [ ] | |
| IC6 | `getIntegrationApi(providerName, integrationName)` | [ ] | |
| IC7 | `getIntegrationApis(providerName)` | [ ] | |
| IC8 | `deleteIntegrationApi(providerName, integrationName)` | [ ] | |
| IC9 | `getIntegrations(category?, activeOnly?)` | [ ] | |
| IC10 | `getIntegrationProviderDefs()` | [ ] | |
| IC11 | `getProvidersAndIntegrations(type?, activeOnly?)` | [ ] | |
| IC12 | `getIntegrationAvailableApis(providerName)` | [ ] | |
| IC13 | `associatePromptWithIntegration(provider, integration, prompt)` | [ ] | |
| IC14 | `getPromptsWithIntegration(provider, integration)` | [ ] | |
| IC15 | `setIntegrationTags(provider, integration, tags)` | [ ] | |
| IC16 | `getIntegrationTags(provider, integration)` | [ ] | |
| IC17 | `deleteIntegrationTags(provider, integration, tags)` | [ ] | |
| IC18 | `setProviderTags(provider, tags)` | [ ] | |
| IC19 | `getProviderTags(provider)` | [ ] | |
| IC20 | `deleteProviderTags(provider, tags)` | [ ] | |

### 5.11 Domain Clients — PromptClient (9 methods)

| # | Method | Status | Notes |
|---|--------|--------|-------|
| PC1 | `savePrompt(name, description, template, models?)` | [ ] | |
| PC2 | `updatePrompt(name, description, template, models?)` | [ ] | |
| PC3 | `getPrompt(name)` | [ ] | |
| PC4 | `getPrompts()` | [ ] | |
| PC5 | `deletePrompt(name)` | [ ] | |
| PC6 | `testPrompt(testRequest)` | [ ] | |
| PC7 | `getPromptTags(name)` | [ ] | |
| PC8 | `setPromptTags(name, tags)` | [ ] | |
| PC9 | `deletePromptTags(name, tags)` | [ ] | |

### 5.12 Domain Clients — ApplicationClient (17 methods)

| # | Method | Status | Notes |
|---|--------|--------|-------|
| AP1 | `getAllApplications()` | [ ] | |
| AP2 | `createApplication(applicationName)` | [ ] | |
| AP3 | `getAppByAccessKeyId(accessKeyId)` | [ ] | |
| AP4 | `deleteAccessKey(applicationId, keyId)` | [ ] | |
| AP5 | `toggleAccessKeyStatus(applicationId, keyId)` | [ ] | |
| AP6 | `removeRoleFromApplicationUser(applicationId, role)` | [ ] | |
| AP7 | `addApplicationRole(applicationId, role)` | [ ] | |
| AP8 | `deleteApplication(applicationId)` | [ ] | |
| AP9 | `getApplication(applicationId)` | [ ] | |
| AP10 | `updateApplication(applicationId, newName)` | [ ] | |
| AP11 | `getAccessKeys(applicationId)` | [ ] | |
| AP12 | `createAccessKey(applicationId)` | [ ] | |
| AP13 | `deleteApplicationTags(applicationId, tags)` | [ ] | |
| AP14 | `deleteApplicationTag(applicationId, tag)` | [ ] | |
| AP15 | `getApplicationTags(applicationId)` | [ ] | |
| AP16 | `addApplicationTags(applicationId, tags)` | [ ] | |
| AP17 | `addApplicationTag(applicationId, tag)` | [ ] | |

### 5.13 Domain Clients — EventClient (22 methods)

| # | Method | Status | Notes |
|---|--------|--------|-------|
| EC1 | `getAllEventHandlers()` | [ ] | |
| EC2 | `addEventHandlers(eventHandlers)` | [ ] | |
| EC3 | `addEventHandler(eventHandler)` | [ ] | |
| EC4 | `updateEventHandler(eventHandler)` | [ ] | |
| EC5 | `handleIncomingEvent(data)` | [ ] | |
| EC6 | `getEventHandlerByName(eventHandlerName)` | [ ] | |
| EC7 | `getAllQueueConfigs()` | [ ] | |
| EC8 | `deleteQueueConfig(queueType, queueName)` | [ ] | |
| EC9 | `getQueueConfig(queueType, queueName)` | [ ] | |
| EC10 | `getEventHandlersForEvent(event, activeOnly?)` | [ ] | |
| EC11 | `removeEventHandler(name)` | [ ] | |
| EC12 | `getTagsForEventHandler(name)` | [ ] | |
| EC13 | `putTagForEventHandler(name, tags)` | [ ] | |
| EC14 | `deleteTagsForEventHandler(name, tags)` | [ ] | |
| EC15 | `deleteTagForEventHandler(name, tag)` | [ ] | |
| EC16 | `testConnectivity(input)` | [ ] | |
| EC17 | `putQueueConfig(queueType, queueName, config)` | [ ] | |
| EC18 | `test()` | [ ] | |
| EC19 | `getAllActiveEventHandlers()` | [ ] | |
| EC20 | `getEventExecutions(eventHandlerName, from?)` | [ ] | |
| EC21 | `getEventHandlersWithStats(from?)` | [ ] | |
| EC22 | `getEventMessages(event, from?)` | [ ] | |

### 5.14 Domain Clients — HumanExecutor (11 methods)

| # | Method | Status | Notes |
|---|--------|--------|-------|
| HE1 | `getTasksByFilter(state, assignee?, assigneeType?, claimedBy?, taskName?, inputQuery?, outputQuery?)` | [ ] | |
| HE2 | `search(searchParams)` | [ ] | |
| HE3 | `pollSearch(searchParams, options?)` | [ ] | |
| HE4 | `getTaskById(taskId)` | [ ] | |
| HE5 | `claimTaskAsExternalUser(taskId, assignee, options?)` | [ ] | |
| HE6 | `claimTaskAsConductorUser(taskId, options?)` | [ ] | |
| HE7 | `releaseTask(taskId)` | [ ] | |
| HE8 | `getTemplateByNameVersion(name, version)` | [ ] | |
| HE9 | `getTemplateById(templateNameVersionOne)` | [ ] | |
| HE10 | `updateTaskOutput(taskId, requestBody)` | [ ] | |
| HE11 | `completeTask(taskId, requestBody?)` | [ ] | |

### 5.15 Domain Clients — TemplateClient (1 method)

| # | Method | Status | Notes |
|---|--------|--------|-------|
| TM1 | `registerTemplate(template, asNewVersion?)` | [ ] | |

### 5.16 Domain Clients — ServiceRegistryClient (14 methods)

| # | Method | Status | Notes |
|---|--------|--------|-------|
| SR1 | `getRegisteredServices()` | [ ] | |
| SR2 | `removeService(name)` | [ ] | |
| SR3 | `getService(name)` | [ ] | |
| SR4 | `openCircuitBreaker(name)` | [ ] | |
| SR5 | `closeCircuitBreaker(name)` | [ ] | |
| SR6 | `getCircuitBreakerStatus(name)` | [ ] | |
| SR7 | `addOrUpdateService(serviceRegistry)` | [ ] | |
| SR8 | `addOrUpdateServiceMethod(registryName, method)` | [ ] | |
| SR9 | `removeMethod(registryName, serviceName, method, methodType)` | [ ] | |
| SR10 | `getProtoData(registryName, filename)` | [ ] | |
| SR11 | `setProtoData(registryName, filename, data)` | [ ] | |
| SR12 | `deleteProto(registryName, filename)` | [ ] | |
| SR13 | `getAllProtos(registryName)` | [ ] | |
| SR14 | `discover(name, create?)` | [ ] | |

### 5.17 Worker Framework

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| W1 | TaskHandler lifecycle (start/stop) | [ ] | |
| W2 | TaskHandler.create() async factory | [ ] | |
| W3 | Worker discovery (decorator scan) | [ ] | |
| W4 | Worker discovery (manual list) | [ ] | |
| W5 | TaskRunner (poll → execute → update) | [ ] | |
| W6 | V2 task update (update + poll in one call) | [ ] | |
| W7 | Poller adaptive backoff (2^n, cap 1024ms) | [ ] | |
| W8 | Poller auth failure backoff | [ ] | |
| W9 | Poller concurrency management | [ ] | |
| W10 | TaskContext (14 methods) | [ ] | MUST be thread-safe (see 5.4) |
| W11 | getTaskContext() global accessor | [ ] | Thread/coroutine-local |
| W11a | TaskContext thread-safety verification test | [ ] | 100 concurrent workers, assert isolation |
| W12 | NonRetryableException | [ ] | FAILED_WITH_TERMINAL_ERROR |
| W13 | IN_PROGRESS return with callbackAfterSeconds | [ ] | |
| W14 | Worker decorator/annotation | [ ] | |
| W15 | Global worker registry (5 functions) | [ ] | |
| W16 | Health monitor with auto-restart | [ ] | |
| W17 | Graceful shutdown (stopWorkers) | [ ] | |
| W18 | Worker pause/unpause | [ ] | |
| W19 | isHealthy() / getWorkerStatus() | [ ] | |
| W20 | Task result update retries (MAX_RETRIES=4) | [ ] | |
| W21 | Worker config via env vars (9 properties) | [ ] | See 5.7 for hierarchy |
| W22 | Worker-specific env override (`CONDUCTOR_WORKER_<NAME>_<PROP>`) | [ ] | |
| W23 | Global env override (`CONDUCTOR_WORKER_ALL_<PROP>`) | [ ] | |
| W24 | Env var boolean parsing (true/1/yes/on) | [ ] | Case-insensitive |
| W25 | Env var number parsing with fallback | [ ] | Log warning on invalid |
| W26 | Task domain support in poll request | [ ] | `?domain=X` query param |
| W27 | Empty string domain → null normalization | [ ] | CRITICAL — see 5.8 |
| W28 | Multi-domain workers (same taskDefName, different domains) | [ ] | Registry keyed by name:domain |
| W29 | Domain via env var (`CONDUCTOR_WORKER_<NAME>_DOMAIN`) | [ ] | |
| W30 | Schema validation (input/output) | [ ] | See 5.12 |
| W31 | Strict schema enforcement mode | [ ] | |
| W32 | Task update retry with backoff (MAX_RETRIES=4, 10s intervals) | [ ] | See 5.13 |
| W33 | TaskUpdateFailure event includes full taskResult payload | [ ] | CRITICAL for recovery |
| W34 | onError callback on TaskHandler | [ ] | Lightweight error notification |
| W35 | Recovery pattern: persist failed results for replay | [ ] | Via event listener |

### 5.18 Event System

| # | Event Type | Status | Notes |
|---|-----------|--------|-------|
| EV1 | PollStarted | [ ] | |
| EV2 | PollCompleted | [ ] | |
| EV3 | PollFailure | [ ] | |
| EV4 | TaskExecutionStarted | [ ] | |
| EV5 | TaskExecutionCompleted | [ ] | |
| EV6 | TaskExecutionFailure | [ ] | |
| EV7 | TaskUpdateCompleted | [ ] | |
| EV8 | TaskUpdateFailure | [ ] | |
| EV9 | EventDispatcher (register/unregister/publish) | [ ] | |
| EV10 | Isolated dispatch (errors caught, not propagated) | [ ] | |

### 5.19 Metrics

| # | Metric | Type | Status | Notes |
|---|--------|------|--------|-------|
| M1 | pollTotal | Counter | [ ] | |
| M2 | pollErrorTotal | Counter | [ ] | |
| M3 | taskExecutionTotal | Counter | [ ] | |
| M4 | taskExecutionErrorTotal | Counter | [ ] | Keyed by taskType:exception |
| M5 | taskUpdateFailureTotal | Counter | [ ] | |
| M6 | taskAckErrorTotal | Counter | [ ] | |
| M7 | taskExecutionQueueFullTotal | Counter | [ ] | |
| M8 | taskPausedTotal | Counter | [ ] | |
| M9 | externalPayloadUsedTotal | Counter | [ ] | |
| M10 | uncaughtExceptionTotal | Counter | [ ] | Global |
| M11 | workerRestartTotal | Counter | [ ] | Global |
| M12 | workflowStartErrorTotal | Counter | [ ] | Global |
| M13 | pollDurationMs | Histogram | [ ] | |
| M14 | executionDurationMs | Histogram | [ ] | |
| M15 | updateDurationMs | Histogram | [ ] | |
| M16 | outputSizeBytes | Histogram | [ ] | |
| M17 | workflowInputSizeBytes | Histogram | [ ] | |
| M18 | apiRequestDurationMs | Histogram | [ ] | |
| M19 | toPrometheusText() exposition | — | [ ] | p50, p90, p99 quantiles |
| M20 | MetricsServer (/metrics + /health) | — | [ ] | |
| M21 | Optional prom-client bridge | — | [ ] | Language-specific |
| M22 | Sliding window (default 1000) | — | [ ] | |

### 5.20 Builders — ConductorWorkflow

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| B1 | Constructor (executor, name, version?, description?) | [ ] | |
| B2 | add(task) — sequential append | [ ] | |
| B3 | fork(branches) — parallel with auto-join | [ ] | |
| B4 | toSubWorkflowTask(refName) | [ ] | |
| B5 | Fluent setters (description, version, timeout, etc.) | [ ] | |
| B6 | inputParameters / inputTemplate / workflowInput | [ ] | |
| B7 | outputParameters / outputParameter | [ ] | |
| B8 | variables() | [ ] | |
| B9 | enableStatusListener / disableStatusListener | [ ] | |
| B10 | input(jsonPath) / output(jsonPath) expression helpers | [ ] | |
| B11 | toWorkflowDef() | [ ] | |
| B12 | register(overwrite?) — default true | [ ] | |
| B13 | execute(input?, ...) — synchronous | [ ] | |
| B14 | startWorkflow(input?, ...) — asynchronous | [ ] | |

### 5.21 Builders — Core Tasks

| # | Builder | Status | Notes |
|---|---------|--------|-------|
| BT1 | simpleTask | [ ] | |
| BT2 | httpTask | [ ] | |
| BT3 | httpPollTask | [ ] | |
| BT4 | inlineTask | [ ] | |
| BT5 | subWorkflowTask | [ ] | |
| BT6 | switchTask | [ ] | |
| BT7 | forkTask | [ ] | |
| BT8 | forkTaskJoin | [ ] | Returns tuple |
| BT9 | joinTask | [ ] | |
| BT10 | dynamicTask | [ ] | |
| BT11 | dynamicForkTask | [ ] | |
| BT12 | doWhileTask | [ ] | |
| BT13 | newLoopTask | [ ] | |
| BT14 | waitTaskDuration | [ ] | |
| BT15 | waitTaskUntil | [ ] | |
| BT16 | waitForWebhookTask | [ ] | |
| BT17 | setVariableTask | [ ] | |
| BT18 | terminateTask | [ ] | |
| BT19 | eventTask | [ ] | |
| BT20 | sqsEventTask | [ ] | |
| BT21 | conductorEventTask | [ ] | |
| BT22 | humanTask | [ ] | |
| BT23 | startWorkflowTask | [ ] | |
| BT24 | kafkaPublishTask | [ ] | |
| BT25 | jsonJqTask | [ ] | |
| BT26 | getDocumentTask | [ ] | |

### 5.22 Builders — LLM Tasks

| # | Builder | Status | Notes |
|---|---------|--------|-------|
| BL1 | llmChatCompleteTask | [ ] | |
| BL2 | llmTextCompleteTask | [ ] | |
| BL3 | llmGenerateEmbeddingsTask | [ ] | |
| BL4 | llmIndexTextTask | [ ] | |
| BL5 | llmIndexDocumentTask | [ ] | |
| BL6 | llmSearchIndexTask | [ ] | |
| BL7 | llmSearchEmbeddingsTask | [ ] | |
| BL8 | llmStoreEmbeddingsTask | [ ] | |
| BL9 | llmQueryEmbeddingsTask | [ ] | |
| BL10 | generateImageTask | [ ] | |
| BL11 | generateAudioTask | [ ] | |
| BL12 | callMcpToolTask | [ ] | |
| BL13 | listMcpToolsTask | [ ] | |
| BL14 | withPromptVariable (helper) | [ ] | |
| BL15 | withPromptVariables (helper) | [ ] | |

### 5.23 Builders — Factories

| # | Builder | Status | Notes |
|---|---------|--------|-------|
| BF1 | workflow(name, tasks) | [ ] | |
| BF2 | taskDefinition(config) | [ ] | |

### 5.24 Examples

| # | Example | Status | Notes |
|---|---------|--------|-------|
| EX1 | helloworld | [ ] | |
| EX2 | quickstart | [ ] | |
| EX3 | kitchensink | [ ] | All task types |
| EX4 | dynamic-workflow | [ ] | |
| EX5 | workflow-ops | [ ] | |
| EX6 | workers-e2e | [ ] | |
| EX7 | worker-configuration | [ ] | |
| EX8 | task-configure | [ ] | |
| EX9 | task-context | [ ] | |
| EX10 | metrics | [ ] | |
| EX11 | event-listeners | [ ] | |
| EX12 | express-worker-service | [ ] | HTTP server + workers |
| EX13 | perf-test | [ ] | |
| EX14 | test-workflows | [ ] | |
| EX15 | advanced/fork-join | [ ] | |
| EX16 | advanced/sub-workflows | [ ] | |
| EX17 | advanced/rag-workflow | [ ] | |
| EX18 | advanced/vector-db | [ ] | |
| EX19 | advanced/http-poll | [ ] | |
| EX20 | advanced/sync-updates | [ ] | |
| EX21 | advanced/wait-for-webhook | [ ] | |
| EX22 | agentic/function-calling | [ ] | |
| EX23 | agentic/multiagent-chat | [ ] | |
| EX24 | agentic/llm-chat | [ ] | |
| EX25 | agentic/llm-chat-human-in-loop | [ ] | |
| EX26 | agentic/mcp-weather-agent | [ ] | |
| EX27 | api-journeys/authorization | [ ] | |
| EX28 | api-journeys/metadata | [ ] | |
| EX29 | api-journeys/prompts | [ ] | |
| EX30 | api-journeys/schedules | [ ] | |
| EX31 | api-journeys/secrets | [ ] | |
| EX32 | api-journeys/integrations | [ ] | |
| EX33 | api-journeys/schemas | [ ] | |
| EX34 | advanced/human-tasks | [ ] | Human-in-the-loop |
| EX35 | api-journeys/applications | [ ] | Applications, access keys, roles |
| EX36 | api-journeys/event-handlers | [ ] | Event handlers, queues, tags |

### 5.25 Tests

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| TS1 | Unit tests for all builders | [ ] | |
| TS2 | Unit tests for HTTP transport | [ ] | Auth, retry, config |
| TS3 | Unit tests for worker framework | [ ] | Poller, TaskRunner, events |
| TS4 | Unit tests for TaskContext | [ ] | All 14 methods |
| TS5 | Unit tests for MetricsCollector | [ ] | All 18 metrics + Prometheus |
| TS6 | Unit tests for EventDispatcher | [ ] | All 8 events |
| TS7 | Integration tests per client | [ ] | 14 clients |
| TS8 | Integration test for ConductorWorkflow DSL | [ ] | |
| TS9 | Integration test for TaskRunner E2E | [ ] | |
| TS10 | Integration test for worker registration | [ ] | |
| TS11 | Error path tests (not-found, invalid) | [ ] | Every client |
| TS12 | Performance tests (throughput, latency) | [ ] | |
| TS13 | Task domain E2E: worker polls only its domain | [ ] | See 5.8 test #1 |
| TS14 | Task domain E2E: no-domain worker polls default queue | [ ] | See 5.8 test #2 |
| TS15 | Task domain E2E: multi-domain isolation | [ ] | See 5.8 test #3 |
| TS16 | Task domain E2E: empty string → null normalization | [ ] | See 5.8 test #4 |
| TS17 | Task domain E2E: env var domain override | [ ] | See 5.8 test #5 |
| TS18 | Worker env var config: global override | [ ] | |
| TS19 | Worker env var config: per-worker override | [ ] | |
| TS20 | Worker env var config: precedence hierarchy | [ ] | |
| TS21 | TaskContext thread-safety under concurrency | [ ] | |

### Summary Count

| Category | Items |
|----------|-------|
| HTTP client + transport + token management + logger | 36 |
| Client factory | 4 |
| Domain client methods | 199 |
| Worker framework features (incl. config, domains, schema, update failure) | 35 |
| Event types + dispatcher | 10 |
| Metrics | 22 |
| ConductorWorkflow methods | 14 |
| Core task builders | 26 |
| LLM task builders | 15 |
| Factory functions | 2 |
| Examples | 36 |
| Test categories (incl. domain + config + thread-safety) | 21 |
| **Total trackable items** | **420** |

---

## 6. Validation Criteria

### 6.1 Unit Test Coverage

Before release, the SDK must have unit tests for:
- All task builder functions produce correct WorkflowTask structures
- HTTP transport: auth lifecycle, retry logic, config resolution, jitter
- Worker framework: poller backoff, task execution, context propagation
- Metrics: all 18 metric types recorded correctly, Prometheus text format valid
- Events: all 8 event types dispatched to listeners

**Target:** ~470+ unit test cases (matching TypeScript SDK)

### 6.2 Integration Test Coverage

Against a real Conductor server:
- Every domain client method called successfully (199 methods)
- ConductorWorkflow: build, register, execute, verify
- Worker E2E: poll, execute, update, verify output
- Error paths: not-found, invalid input, permission denied

**Target:** ~190+ integration test cases across 22+ test files

### 6.3 Example Verification

Every example must:
- Run successfully against a Conductor server
- Clean up created resources
- Handle missing environment variables gracefully

**Minimum for release:** Core examples (14) + at least 2 advanced + 2 agentic + 4 API journeys

### 6.4 Python SDK Parity

| Feature | Python | Your SDK | Match? |
|---------|--------|----------|--------|
| OrkesClients factory | `OrkesClients` | | |
| 14 domain clients | All | | |
| ~199 client methods | All | | |
| ConductorWorkflow DSL | `ConductorWorkflow` | | |
| Worker decorator | `@worker_task` | | |
| Task context | `get_task_context()` | | |
| MetricsCollector (18 types) | Yes | | |
| MetricsServer | HTTP endpoint | | |
| NonRetryableException | `NonRetryableError` | | |
| 13 LLM builders | Yes | | |
| Schema generation | `@input_schema` | | |
| Health monitor | Auto-restart | | |
| HTTP/2 | Optional | | |
| Signal API (4 strategies) | Yes | | |
| Rate limits (raw HTTP) | Yes | | |
| V2 task update | Yes | | |

### 6.5 Performance Baselines

Measure and document:
- **Poll-to-completion latency:** p50 < 10ms, p99 < 50ms (for no-op workers)
- **Throughput:** > 1000 tasks/sec at concurrency 10 (single worker type)
- **Memory:** Stable under sustained load (no unbounded growth)
- **Connection pooling:** HTTP/2 should show measurable improvement over HTTP/1.1

---

## Appendix A: Key Design Decisions

These document the reasoning behind specific implementation choices. Reference these when making trade-offs in your language.

### A.1 V2 Task Update with Chaining

The Conductor server supports a V2 task update endpoint (`POST /tasks/{taskId}/v2`) that combines the task result update with the next poll in a single HTTP round-trip. This is critical for worker throughput — instead of update + poll being two serial requests, they become one.

**Implementation:** After executing a task, the TaskRunner posts the result to the V2 endpoint. The response includes the next batch of tasks to execute, eliminating the separate poll call.

### A.2 Adaptive Backoff

When no tasks are available, the poller uses exponential backoff (1ms → 1024ms) to reduce server load. This matches the Python SDK's behavior and prevents unnecessary polling during idle periods. The backoff resets immediately when tasks are received.

### A.3 Retry Jitter

All retry delays include ±10% jitter to prevent thundering herd. When many workers retry simultaneously after a server hiccup, jitter spreads the retry attempts across time, preventing a second overload.

### A.4 Event System Design

The event system uses optional interface methods (not required) so listeners can subscribe to only the events they care about. Event dispatch errors are caught and logged — they never affect task execution. When no listeners are registered, dispatch is a no-op with zero overhead.

### A.5 Metrics with Sliding-Window Quantiles

Histogram metrics (duration, size) maintain a sliding window of the last N observations (default 1000). Quantiles (p50, p90, p99) are computed from this window on-demand when `toPrometheusText()` is called, rather than using reservoir sampling. This gives accurate recent percentiles without unbounded memory growth.

### A.6 Auth Token Mutex

The token refresh uses a mutex/promise-coalescing pattern so that concurrent requests that all discover an expired token only trigger one refresh. Without this, N concurrent requests would each try to refresh, causing N-1 redundant token API calls. In async/event-loop languages (JS, Python), use promise coalescing (a shared in-flight promise). In thread-based languages (Java, Go), use a mutex with a double-check pattern. See Phase 2, section 2.1.5 for implementation details in both models.

### A.7 Error Wrapping

Every domain client method wraps errors with human-readable context: `"Failed to get workflow 'abc': 404 Not Found"`. This chains the original error as the cause, preserving the stack trace while adding domain context. The dual-strategy design (`throw` vs `log`) lets callers choose between strict error propagation and lenient logging.

---

## Appendix B: Server Behavior Quirks

These are behaviors discovered during TypeScript SDK development that apply to all language implementations:

| Behavior | Detail |
|----------|--------|
| User IDs lowercased | `upsertUser("MyUser")` → server stores `"myuser"` |
| Schedule names | Alphanumeric + underscores only. Hyphens rejected. |
| Cron expressions | 6 fields with seconds: `"0 0 0 1 1 *"` (not 5-field) |
| Empty task lists | `tasks: []` in WorkflowDef is rejected |
| SIMPLE task state | Without a running worker, tasks stay `SCHEDULED` forever |
| Not-found responses | Some APIs return 200/empty instead of 404 |
| Prompt models format | `"provider:model"` format: `["openai:gpt-4o"]` |
| Integration config | Needs `api_key` field. Use server-supported types. |
| Rate limit API | Raw HTTP PUT/GET/DELETE — not in OpenAPI spec |
| Workflow expressions | `${workflow.input.fieldName}` — dollar-brace, not template literals |
| Schema types | Case-sensitive: `"JSON"` not `"json"` |
