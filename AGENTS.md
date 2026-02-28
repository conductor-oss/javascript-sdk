# AGENTS.md

Instructions for AI agents working on the Conductor JavaScript SDK.

## Project Context

This is the official JavaScript/TypeScript SDK for [Conductor](https://github.com/conductor-oss/conductor), an open-source workflow orchestration engine. Published as `@io-orkes/conductor-javascript` on npm.

The SDK was brought to full feature parity with the [Python SDK](https://github.com/conductor-sdk/conductor-python) in the v3.x release.

**Read [SDK_DEVELOPMENT.md](./SDK_DEVELOPMENT.md)** for full architecture, patterns, pitfalls, and conventions.

## Repository Layout

```
src/sdk/                         # Main SDK source
  index.ts                       # Public API surface (all exports flow through here)
  OrkesClients.ts                # Factory class - single client -> 14 domain getters
  types.ts                       # OrkesApiConfig, TaskResultStatus
  helpers/errors.ts              # ConductorSdkError, handleSdkError
  helpers/logger.ts              # ConductorLogger, DefaultLogger, noopLogger
  createConductorClient/         # Auth, retry, HTTP/2, TLS, proxy
  clients/                       # 14 domain client classes
  builders/                      # Task builders + ConductorWorkflow DSL
    tasks/                       # simpleTask, httpTask, waitTaskDuration, etc.
    tasks/llm/                   # 13 LLM task builders
    ConductorWorkflow.ts         # Fluent workflow builder
    workflow.ts                  # Simple workflow({ name, tasks }) factory
    taskDefinition.ts            # taskDefinition({ name, ... }) factory
  worker/                        # Worker framework
    core/TaskHandler.ts          # Discovers and manages worker lifecycle
    decorators/worker.ts         # @worker decorator + dual-mode support
    decorators/registry.ts       # Global registry (register/get/clear)
    context/TaskContext.ts        # AsyncLocalStorage per-task context
    metrics/                     # MetricsCollector, MetricsServer, PrometheusRegistry
    schema/                      # jsonSchema, schemaField decorators
  generators/                    # Legacy generators (pre-v3, still exported for compat)
src/open-api/                    # OpenAPI layer
  generated/                     # AUTO-GENERATED - never edit these files
  types.ts                       # Extended types - add custom fields here
src/integration-tests/           # E2E tests against real Conductor server
  utils/                         # waitForWorkflowStatus, executeWorkflowWithRetry, etc.
```

## Commands

```bash
npm test                           # Unit tests (469 tests)
npm run build                      # tsup (ESM + CJS dual output)
npm run lint                       # ESLint
npm run generate-openapi-layer     # Regenerate from OpenAPI spec

# Integration tests (requires running Conductor server)
CONDUCTOR_SERVER_URL=http://localhost:8080 \
CONDUCTOR_AUTH_KEY=key CONDUCTOR_AUTH_SECRET=secret \
ORKES_BACKEND_VERSION=5 \
npm run test:integration:orkes-v5
```

## Post-Change Verification (Required)

After every code change, you **must** run the following before considering the work complete:

1. **Lint** — fix all lint errors in files you changed:
   ```bash
   npm run lint                          # Check all files
   npx eslint --fix src/path/to/file.ts  # Auto-fix a specific file
   ```
   You must fix all lint errors in files you modified. Do not introduce new lint violations.

2. **Unit tests** — all must pass:
   ```bash
   npm test
   ```

3. **All examples** — each must complete successfully (requires a running Conductor server and `.env` credentials):
   ```bash
   export $(cat .env | xargs)
   npx ts-node -P tsconfig.json --transpile-only examples/helloworld.ts
   npx ts-node -P tsconfig.json --transpile-only examples/quickstart.ts
   npx ts-node -P tsconfig.json --transpile-only examples/kitchensink.ts
   npx ts-node -P tsconfig.json --transpile-only examples/dynamic-workflow.ts
   npx ts-node -P tsconfig.json --transpile-only examples/task-configure.ts
   npx ts-node -P tsconfig.json --transpile-only examples/task-context.ts
   npx ts-node -P tsconfig.json --transpile-only examples/worker-configuration.ts
   npx ts-node -P tsconfig.json --transpile-only examples/workflow-ops.ts
   npx ts-node -P tsconfig.json --transpile-only examples/workers-e2e.ts
   npx ts-node -P tsconfig.json --transpile-only examples/perf-test.ts
   ```

Do not skip any example. If an example fails for reasons unrelated to your change (e.g., server down), note it explicitly.

## Critical Pitfalls

These are real bugs that caused test failures during SDK development. Read before writing any code.

### Task builder argument order is backwards from what you expect

`simpleTask(taskReferenceName, name, inputParameters)` - the **ref name is first**, task def name is second. Every builder follows this pattern. Getting it backwards silently creates broken workflows.

```typescript
// CORRECT - ref name first, then task def name
simpleTask("my_ref", "my_task_def", { key: "val" })

// WRONG - swapped, causes "taskReferenceName should be unique" errors
simpleTask("my_task_def", "my_ref", { key: "val" })
```

Also: the function is `setVariableTask` (not `setVariable`), `waitTaskDuration` (not `waitTask`).

### `orkesConductorClient` is just an alias for `createConductorClient`

Both exported from the SDK. Same function. Tests use `orkesConductorClient()` by convention.

### `handleSdkError` return type is `never` for `"throw"` strategy

This is why client methods compile without a return statement after the catch block. The TypeScript overload signatures are:
- `handleSdkError(err, msg)` -> `never` (default, throws)
- `handleSdkError(err, msg, "log")` -> `void` (logs, continues)

If you add a new client method and TypeScript complains about missing return, you forgot the `handleSdkError` call in the catch.

### OpenAPI generated types have quirks

| Type | Issue | Fix |
|------|-------|-----|
| `TargetRef.id` | Literal string type in spec | Cast with `as never` |
| `UpsertUserRequest.roles` | Single string, not array | `roles: "USER"` not `["USER"]` |
| `TaskResult` | `taskId` + `workflowInstanceId` required | Always provide both |
| `TaskMock` | Array of `{ status, output }` objects | Not `{ COMPLETED: { data } }` |
| `RateLimitConfig` | Only `concurrentExecLimit` + `rateLimitKey` | Use `ExtendedRateLimitConfig` or raw HTTP for richer fields |
| `Task.taskType` | Returns the task def name for SIMPLE tasks | Not the literal `"SIMPLE"` |
| `SchemaDef.type` | Must be `"JSON" \| "AVRO" \| "PROTOBUF"` | String literal, not free-form |

### Server behavior varies between OSS and Enterprise

| Behavior | Detail |
|----------|--------|
| **User IDs lowercased** | `upsertUser("MyUser")` creates `"myuser"`. Use lowercase always. |
| **Schedule names** | Alphanumeric + underscores only. Hyphens rejected. |
| **Cron expressions** | 6 fields (with seconds): `"0 0 0 1 1 *"` not `"0 0 1 1 *"` |
| **Empty task lists** | `tasks: []` in workflow defs is rejected. |
| **SIMPLE task state** | Without a running worker, SIMPLE tasks stay `SCHEDULED` forever. Use WAIT tasks in tests if you need IN_PROGRESS without a worker. |
| **Not-found behavior** | Some APIs return 200/empty instead of 404. Error tests must accept both. |
| **Prompt models** | `savePrompt` with models needs `"provider:model"`: `["openai:gpt-4o"]` |
| **Integration types** | `"custom"` may not exist. Use server types like `"openai"`. Integrations need `api_key` in configuration. |
| **Rate limit API** | Raw HTTP (not in OpenAPI spec). May not exist on all servers. |

### `ConductorWorkflow.register()` defaults to overwrite=true

But `MetadataClient.registerWorkflowDef()` defaults to overwrite=false. This catches people who switch between the two APIs.

### `getWorkflow()` vs `getExecution()` on WorkflowExecutor

Both return `Workflow`, both call the same API. But `getWorkflow(id, includeTasks, retry)` has built-in retry on 500/404/403 errors, while `getExecution(id, includeTasks=true)` does not. Use `getWorkflow` when you need resilience, `getExecution` for simple one-shot fetches.

### Dynamic imports break in Jest

`MetricsCollector` uses `await import("./MetricsServer.js")` internally. The `.js` extension doesn't resolve under Jest's TypeScript transform. **Test `MetricsServer` by importing it directly**, not via `MetricsCollector`'s `httpPort` config.

### Integration test timing

- Start workers BEFORE registering/executing workflows
- Each workflow control test (pause/resume/terminate) needs its own workflow instance
- SIMPLE task scheduling takes 1-3s after completing the previous task. Poll in a loop.
- Always use `clearWorkerRegistry()` in `afterEach` for worker tests
- Import ALL jest globals: `import { test, expect, jest, beforeAll, afterAll } from "@jest/globals"`

## Conventions

### Client methods

```typescript
public async someMethod(args): Promise<T> {
  try {
    const { data } = await Resource.apiCall({
      ..., client: this._client, throwOnError: true,
    });
    return data;
  } catch (error: unknown) {
    handleSdkError(error, "Human-readable context");
  }
}
```

### OpenAPI types

- **Never edit** `src/open-api/generated/`
- Extend types in `src/open-api/types.ts`
- Import types: `import type { X } from "../open-api"`
- Import resources: `import { XResource } from "../open-api/generated"`

### Adding code

- New client: class in `src/sdk/clients/<name>/`, export from index, add getter to `OrkesClients.ts`, write E2E test
- New builder: factory function in `src/sdk/builders/tasks/`, export from index
- New worker feature: add to `src/sdk/worker/`, export from index
- Match Python SDK naming and behavior

### Naming

- Resource names in tests: `jssdktest_thing_${Date.now()}` (lowercase, underscores, timestamp suffix)
- Builder exports: `fooTask`, `fooBarTask` (camelCase + "Task" suffix)
- Client classes: `FooClient` (PascalCase + "Client" suffix)
- Enums from LLM types: `Role.USER`, `LLMProvider.OPEN_AI` (use enum values, not raw strings)

## Test Coverage

| Component | Unit | E2E | Total |
|-----------|------|-----|-------|
| 14 clients (~187 methods) | Yes | 100% | |
| ConductorWorkflow DSL | Yes | 100% | |
| Worker + Metrics + Context | Yes | 100% | |
| Error paths | - | 35 tests | |
| **Total** | **469** | **191** | **660** |
