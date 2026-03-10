# SDK Development Guide

Comprehensive reference for developing, extending, and debugging the Conductor JavaScript SDK.

## Architecture

```
Public API (src/sdk/index.ts)
  |
  +-- OrkesClients              Factory for all domain clients
  +-- Builders                  Task builders + ConductorWorkflow DSL
  +-- Worker Framework          @worker, TaskHandler, TaskContext, Metrics
  |
  +-- Domain Clients (src/sdk/clients/)
  |     WorkflowExecutor, TaskClient, MetadataClient, SchedulerClient,
  |     AuthorizationClient, SecretClient, SchemaClient, IntegrationClient,
  |     PromptClient, ApplicationClient, EventClient, HumanExecutor,
  |     TemplateClient, ServiceRegistryClient
  |
  +-- OpenAPI Layer (src/open-api/)
  |     Auto-generated types + resource classes
  |     Extended types in src/open-api/types.ts
  |
  +-- HTTP Transport (src/sdk/createConductorClient/)
        Auth token lifecycle, retry with backoff, HTTP/2, TLS, proxy
```

### Export Chain

Everything flows through `src/sdk/index.ts`:
```
sdk/index.ts
  -> createConductorClient/index.ts  (createConductorClient, orkesConductorClient alias, OrkesApiConfig)
  -> OrkesClients.ts                 (OrkesClients factory)
  -> clients/index.ts                (14 client classes, all re-exported)
  -> builders/index.ts               (task builders, ConductorWorkflow, workflow(), taskDefinition())
  -> generators/index.ts             (legacy generators, still exported)
  -> types.ts                        (OrkesApiConfig, TaskResultStatus)
  -> worker/index.ts                 (TaskHandler, worker, getTaskContext, MetricsCollector, etc.)
  -> helpers/logger.ts               (DefaultLogger, noopLogger, ConductorLogger type)
  -> helpers/errors.ts               (ConductorSdkError type)
```

When adding new exports, follow this chain. If something isn't importable from `"../sdk"` in tests, it's missing from an `index.ts` somewhere in the chain.

## Directory Structure

```
src/
  sdk/
    index.ts                      # Public API exports
    OrkesClients.ts               # Factory: one Client -> 14 domain client getters
    types.ts                      # OrkesApiConfig, TaskResultStatus, TaskResultOutputData
    helpers/
      errors.ts                   # ConductorSdkError, handleSdkError (throw/log strategies)
      logger.ts                   # ConductorLogger interface, DefaultLogger, noopLogger
    createConductorClient/        # Client construction
      createConductorClient.ts    # Main factory: config -> authenticated Client
      constants.ts                # Default timeouts, refresh intervals
      helpers/
        handleAuth.ts             # Token gen, background refresh, mutex for concurrency
        fetchWithRetry.ts         # Transport + 429 rate-limit + 401/403 auth retries
        resolveOrkesConfig.ts     # Env vars > config object > defaults
        resolveFetchFn.ts         # Picks fetch impl (native, Undici)
        getUndiciHttp2FetchFn.ts  # HTTP/2 with connection pooling via Undici
        addResourcesBackwardCompatibility.ts  # Legacy method aliases
    clients/                      # Domain-specific API clients
      workflow/
        WorkflowExecutor.ts       # 28 methods: register, start, execute, signal, etc.
        helpers/                  # enhanceSignalResponse, reverseFind, isCompletedTaskMatchingType
        types.ts                  # EnhancedSignalResponse, TaskFinderPredicate
        constants.ts              # RETRY_TIME_IN_MILLISECONDS
      task/TaskClient.ts          # 8 methods: search, get, update, logs, queue
      metadata/MetadataClient.ts  # 21 methods: tasks, workflows, tags, rate limits
      scheduler/SchedulerClient.ts # 14 methods: schedules, tags, global ops
      authorization/AuthorizationClient.ts  # 19 methods: users, groups, permissions
      secret/SecretClient.ts      # 9 methods: CRUD, tags, existence
      schema/SchemaClient.ts      # 6 methods: register, get, delete, versioning
      integration/IntegrationClient.ts # 20 methods: providers, APIs, tags, prompts
      prompt/PromptClient.ts      # 9 methods: CRUD, tags, test against LLM
      application/ApplicationClient.ts
      event/EventClient.ts
      human/HumanExecutor.ts
      template/TemplateClient.ts
      service-registry/ServiceRegistryClient.ts
      worker/                     # Polling & execution engine (internal)
        TaskRunner.ts             # Per-worker: poll -> execute -> update loop
        Poller.ts                 # Generic concurrent queue with adaptive backoff
        events/                   # EventDispatcher + TaskRunnerEventsListener interface
        exceptions/Exceptions.ts  # NonRetryableException class
        types.ts                  # ConductorWorker, TaskInProgressResult
        constants.ts              # Default poll intervals, batch sizes
    builders/
      ConductorWorkflow.ts       # Fluent builder: add, fork, register, execute
      workflow.ts                 # workflow(name, tasks) -> minimal WorkflowDef
      taskDefinition.ts          # taskDefinition({ name, ... }) -> TaskDef with defaults
      tasks/                     # 21 standard task builders
        simple.ts                # simpleTask(refName, taskDefName, input, optional?)
        http.ts                  # httpTask(refName, httpInput, asyncComplete?, optional?)
        wait.ts                  # waitTaskDuration(refName, duration), waitTaskUntil(refName, until)
        subWorkflow.ts, setVariable.ts, inline.ts, dynamic.ts, dynamicFork.ts
        event.ts, forkJoin.ts, join.ts, jsonJq.ts, kafkaPublish.ts
        switch.ts, terminate.ts, humanTask.ts, startWorkflow.ts
        getDocument.ts, httpPoll.ts, waitForWebhook.ts
        llm/                     # 13 LLM-specific builders
          llmChatComplete.ts     # llmChatCompleteTask(ref, provider, model, options)
          llmTextComplete.ts, llmGenerateEmbeddings.ts, llmIndexDocument.ts
          llmIndexText.ts, llmSearchIndex.ts, llmSearchEmbeddings.ts
          llmStoreEmbeddings.ts, llmQueryEmbeddings.ts
          generateImage.ts, generateAudio.ts, callMcpTool.ts, listMcpTools.ts
          promptHelpers.ts       # Prompt template utilities
          types.ts               # Role enum, LLMProvider enum, ChatMessage, ToolSpec, etc.
    worker/
      index.ts                   # Re-exports everything below
      core/TaskHandler.ts        # Main entry: discovers @worker fns, manages lifecycle
      decorators/
        worker.ts                # @worker decorator (dual-mode: execution + builder)
        registry.ts              # Global registry: registerWorker, getRegisteredWorkers, clearWorkerRegistry
      context/
        TaskContext.ts            # AsyncLocalStorage-based per-task context + getTaskContext()
      metrics/
        MetricsCollector.ts      # TaskRunnerEventsListener impl, 19 metric types, quantiles
        MetricsServer.ts         # HTTP server: /metrics (Prometheus) + /health (JSON)
        PrometheusRegistry.ts    # Optional prom-client bridge (lazy loaded)
      schema/                    # jsonSchema(), schemaField() decorator, generateSchemaFromClass()
      config/                    # Worker configuration resolution helpers
    generators/                   # Legacy task generators (pre-v3, still exported for backward compat)
  open-api/
    index.ts                     # Type re-exports (generated + custom)
    types.ts                     # Extended types: Consistency, ReturnStrategy, TaskType (28 variants),
                                 #   TaskResultStatusEnum, ServiceType, specific TaskDef types,
                                 #   Extended* interfaces for fields missing from OpenAPI spec
    generated/                   # AUTO-GENERATED from OpenAPI spec - never edit directly
      types.gen.ts               # All OpenAPI types
      sdk.gen.ts                 # Resource classes (API call implementations)
      client.ts                  # createClient factory
  integration-tests/             # E2E tests against real Conductor server
    utils/
      waitForWorkflowStatus.ts   # Poll until workflow reaches expected status
      waitForWorkflowCompletion.ts
      executeWorkflowWithRetry.ts # Retry on transient network errors (fetch failed, timeout, etc.)
      customJestDescribe.ts      # describeForOrkesV5 (skips if ORKES_BACKEND_VERSION < 5)
      mockLogger.ts              # jest.fn() logger for unit tests
```

## Design Patterns

### 1. OrkesClients Factory

Single authenticated connection, multiple domain facades:

```typescript
const clients = await OrkesClients.from({
  serverUrl: "https://play.orkes.io",
  keyId: "...",
  keySecret: "...",
});
const workflow = clients.getWorkflowClient();  // WorkflowExecutor
const metadata = clients.getMetadataClient();  // MetadataClient
// 12 more getters...
```

`OrkesClients.from()` calls `createConductorClient()` which sets up auth, retry, and optional HTTP/2. You can also construct clients directly: `new MetadataClient(client)`.

`orkesConductorClient` is an alias for `createConductorClient`. Integration tests use `orkesConductorClient()` by convention (reads env vars).

### 2. Client Class Pattern

Every client method:

```typescript
export class SomeClient {
  public readonly _client: Client;
  constructor(client: Client) { this._client = client; }

  public async someMethod(arg1: string): Promise<SomeType> {
    try {
      const { data } = await SomeResource.apiCall({
        path: { id: arg1 },
        query: { ... },
        body: ...,
        client: this._client,
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to do X for '${arg1}'`);
    }
  }
}
```

Rules:
- `throwOnError: true` on every OpenAPI call
- try/catch with `handleSdkError` using human-readable context with the resource ID
- Return `data` from the response
- For APIs not in the OpenAPI spec, use `this._client.put/get/delete` directly (see rate limit methods in MetadataClient)

### 3. handleSdkError

```typescript
handleSdkError(error, "Context");           // throws ConductorSdkError (return type: never)
handleSdkError(error, "Context", "log");     // logs to console.error (return type: void)
```

The `"throw"` overload returns `never`, which is how client methods compile without a return after the catch. If TypeScript complains about a missing return in a new client method, you forgot the `handleSdkError` call.

The error message chains: `"Failed to get workflow 'abc': 404 Not Found"`.

### 4. ConductorWorkflow Fluent Builder

```typescript
const wf = new ConductorWorkflow(executor, "order_flow")
  .add(simpleTask("validate_ref", "validate_order", {}))
  .fork([
    [simpleTask("email_ref", "send_email", {})],
    [simpleTask("sms_ref", "send_sms", {})],
  ])
  .timeoutSeconds(3600)
  .outputParameters({ orderId: "${workflow.input.orderId}" });

await wf.register();                           // overwrite=true by default
const run = await wf.execute({ orderId: "123" });
```

**Gotcha:** `ConductorWorkflow.register()` defaults to `overwrite=true`, but `MetadataClient.registerWorkflowDef()` defaults to `overwrite=false`.

`execute()` internally generates a `requestId` via `crypto.randomUUID()`.

`input("fieldName")` returns `"${workflow.input.fieldName}"` and `output("fieldName")` returns `"${workflow.output.fieldName}"` - these are Conductor expression helpers.

### 5. Worker Decorator + TaskHandler

```typescript
@worker({ taskDefName: "process_order", concurrency: 5, pollInterval: 100 })
async function processOrder(task: Task) {
  const ctx = getTaskContext();
  ctx?.addLog("Processing started");
  return { status: "COMPLETED", outputData: { result: "done" } };
}

const handler = new TaskHandler({ client, scanForDecorated: true });
await handler.startWorkers();
// handler.stopWorkers() to shut down
```

Lifecycle: `TaskHandler` discovers decorated workers from global registry -> creates `TaskRunner` per worker -> `Poller` polls for tasks -> executes with `TaskContext` -> updates result -> dispatches events.

`NonRetryableException`: throw from a worker to mark the task as `FAILED_WITH_TERMINAL_ERROR` (no retries regardless of task def retry settings).

```typescript
throw new NonRetryableException("Order not found - permanent failure");
```

### 6. TaskContext (AsyncLocalStorage)

```typescript
function deepHelper() {
  const ctx = getTaskContext();       // Works from any async depth
  ctx?.addLog("Inside helper");
  ctx?.setCallbackAfter(30);
  ctx?.setOutput({ partial: true });
  return ctx?.getInput();
}
```

Returns `undefined` outside task execution. All 16 methods: `getTaskId()`, `getWorkflowInstanceId()`, `getRetryCount()`, `getPollCount()`, `getInput()`, `getTaskDefName()`, `getWorkflowTaskType()`, `getTask()`, `addLog()`, `getLogs()`, `setCallbackAfter()`, `getCallbackAfterSeconds()`, `setOutput()`, `getOutput()`.

### 7. Metrics

```typescript
const metrics = new MetricsCollector({ prefix: "my_app", slidingWindowSize: 1000 });
const handler = new TaskHandler({ client, eventListeners: [metrics], scanForDecorated: true });
await handler.startWorkers();

// Programmatic access
const m = metrics.getMetrics();
console.log(m.pollTotal.get("my_task"));

// Prometheus text
const text = metrics.toPrometheusText();
```

For an HTTP endpoint, use `MetricsServer` directly:

```typescript
const server = new MetricsServer(metrics, 9090);
await server.start();
// GET http://localhost:9090/metrics -> Prometheus text
// GET http://localhost:9090/health  -> {"status":"UP"}
await server.stop();
```

**Do not use `MetricsCollector({ httpPort })` in Jest** - it uses a dynamic import with `.js` extension that doesn't resolve under Jest's TS transform.

## Known Pitfalls

Every item below caused real test failures during SDK development.

### Task builder argument order

The #1 source of bugs. `simpleTask(taskReferenceName, name, inputParameters)` puts the **ref name first**:

```typescript
simpleTask("my_ref", "my_task_def", { key: "val" })  // CORRECT
simpleTask("my_task_def", "my_ref", { key: "val" })  // WRONG - silent failure
```

Getting it backwards doesn't throw - it creates a workflow with swapped values. You only find out when the server says "taskReferenceName should be unique" (if you use the same task def name for two tasks).

All builders follow the same convention: `(taskReferenceName, ...)`.

Also note: the export is `setVariableTask` (not `setVariable`), `waitTaskDuration` (not `waitTask`).

### OpenAPI type mismatches

| Type | Spec Says | Reality | Fix |
|------|-----------|---------|-----|
| `TargetRef.id` | Literal string type | Dynamic string | `as never` |
| `UpsertUserRequest.roles` | Single string union | People expect array | `"USER"` not `["USER"]` |
| `UpsertGroupRequest.roles` | Single string union | People expect array | `"USER"` not `["USER"]` |
| `TaskResult` | `taskId`, `workflowInstanceId` required | Often constructed partial | Always provide both |
| `TaskMock` | `{ status?, output?, executionTime?, queueWaitTime? }` | People write `{ COMPLETED: {...} }` | Use array: `[{ status: "COMPLETED", output: {...} }]` |
| `RateLimitConfig` | Only `concurrentExecLimit` + `rateLimitKey` | Server accepts more fields | Use `ExtendedRateLimitConfig` or raw HTTP |
| `Task.taskType` | Expect `"SIMPLE"` for simple tasks | Actually the task def name | Don't compare against TaskType enum |
| `SchemaDef.type` | `"JSON" \| "AVRO" \| "PROTOBUF"` | People pass `"json"` | Case-sensitive string literal |
| `ChatMessage.role` | `Role` enum | People pass `"user"` | Use `Role.USER` from `sdk/builders/tasks/llm/types` |

### Server behavior differences

| Behavior | Detail |
|----------|--------|
| **User IDs lowercased** | `upsertUser("MyUser")` -> server stores `"myuser"`. Then `getUser("MyUser")` returns 404. Always use lowercase. |
| **Schedule names** | Alphanumeric + underscores only. `my-schedule` rejected, `my_schedule` works. |
| **Cron expressions** | 6 fields including seconds: `"0 0 0 1 1 *"`. Five-field cron `"0 0 1 1 *"` is rejected. |
| **Empty task lists** | `tasks: []` in WorkflowDef is rejected. Minimum one task. |
| **SIMPLE task state** | Without a running worker polling, tasks stay `SCHEDULED`. For tests needing `IN_PROGRESS` without a worker, use `WAIT` task type instead. |
| **Not-found responses** | Some APIs (delete, get tags) return 200/empty for non-existent resources. Others throw 404. Error-path tests must handle both patterns. |
| **Prompt models** | `savePrompt` with models param needs `"provider:model"` format: `["openai:gpt-4o"]` not `["gpt-4o"]`. |
| **Integration config** | Provider types like `"custom"` may not exist. Use server-supported types (`"openai"`). Configuration needs `api_key` field. |
| **Rate limit API** | Uses raw HTTP `PUT/GET/DELETE` on `/api/metadata/workflow/{name}/rate-limit`. Not in OpenAPI spec. Not available on all server versions. |
| **Workflow input expressions** | Use `${workflow.input.fieldName}` in inputParameters. Dollar-brace syntax, not template literals. |

### `getWorkflow()` vs `getExecution()` on WorkflowExecutor

Both return `Workflow`, both call the same underlying API. Key difference:
- `getWorkflow(id, includeTasks, retry=0)` - has built-in retry on 500/404/403
- `getExecution(id, includeTasks=true)` - simple, no retry

Use `getWorkflow` when you need resilience. Use `getExecution` for straightforward one-shot fetches. There's also `getWorkflowStatus()` which returns `WorkflowStatus` (lighter, just status/output/variables).

### Jest + dynamic imports

`MetricsCollector` lazy-loads `MetricsServer` via `await import("./MetricsServer.js")`. The `.js` extension doesn't resolve in Jest. **Always test `MetricsServer` by importing the class directly.** Never test `MetricsCollector`'s `httpPort` auto-start in Jest.

### Integration test timing

- **Start workers BEFORE workflows.** Worker polling must be active before you start a workflow, otherwise SIMPLE tasks have nothing to poll them.
- **Independent workflow instances per test.** Don't chain pause -> resume -> terminate on the same workflow across separate `test()` blocks. If pause fails, resume/terminate cascade-fail.
- **Task scheduling delay.** After completing task N in a multi-task workflow, task N+1 takes 1-3 seconds to become SCHEDULED. Poll in a loop, don't just `setTimeout(2000)`.
- **`clearWorkerRegistry()` in afterEach.** Worker tests register functions globally. Without clearing, workers leak between tests.

## Adding a New Client

1. Create `src/sdk/clients/<name>/<Name>Client.ts`
2. Create `src/sdk/clients/<name>/index.ts`: `export * from "./<Name>Client"`
3. Add `export * from "./<name>"` to `src/sdk/clients/index.ts`
4. Add getter to `src/sdk/OrkesClients.ts`:
   ```typescript
   get<Name>Client(): <Name>Client {
     return new <Name>Client(this._client);
   }
   ```
5. Write E2E tests: `src/integration-tests/<Name>Client.test.ts` (CRUD + error paths)

## Adding a New Task Builder

1. Create `src/sdk/builders/tasks/<taskName>.ts`
2. Add `export * from "./<taskName>"` to `src/sdk/builders/tasks/index.ts`
3. For LLM builders, put in `src/sdk/builders/tasks/llm/` and export from `llm/index.ts`

```typescript
import { TaskType } from "../../../open-api";
import type { WorkflowTask } from "../../../open-api";

export const myNewTask = (
  taskReferenceName: string,
  name: string,
  inputParameters: Record<string, unknown>,
  optional?: boolean,
): WorkflowTask => ({
  name,
  taskReferenceName,
  type: TaskType.MY_TYPE,
  inputParameters,
  optional,
});
```

Test by building a workflow with `ConductorWorkflow.add()`, registering, and verifying the definition on the server via `getWorkflowDef()`.

## Testing

### Unit tests

Co-located with source in `__tests__/` directories.

```bash
npm test                # All 469 unit tests
npm run test:unit       # Unit tests only
```

### Integration tests (E2E)

Against a real Conductor server. Location: `src/integration-tests/`.

```bash
# Full suite
CONDUCTOR_SERVER_URL=http://localhost:8080 \
CONDUCTOR_AUTH_KEY=key CONDUCTOR_AUTH_SECRET=secret \
ORKES_BACKEND_VERSION=5 \
npm run test:integration:orkes-v5

# Single file
npx jest --force-exit --testPathPatterns="AuthorizationClient"
```

### Integration test template

```typescript
import { expect, describe, test, jest, beforeAll, afterAll } from "@jest/globals";
import { orkesConductorClient, OrkesClients, SomeClient } from "../sdk";

describe("SomeClient", () => {
  jest.setTimeout(60000);
  const suffix = Date.now();
  let someClient: SomeClient;
  const resourceName = `jssdktest_resource_${suffix}`;  // lowercase, underscores only

  beforeAll(async () => {
    const client = await orkesConductorClient();
    const clients = new OrkesClients(client);
    someClient = clients.getSomeClient();
  });

  afterAll(async () => {
    try { await someClient.delete(resourceName); } catch { /* ok */ }
  });

  test("create", async () => { ... });
  test("get", async () => { ... });

  describe("Error Paths", () => {
    // Strict: API always 404s
    test("get non-existent throws", async () => {
      await expect(someClient.get("nonexistent")).rejects.toThrow();
    });
    // Tolerant: API may 200/empty or 404
    test("delete non-existent throws or no-ops", async () => {
      try { await someClient.delete("nonexistent"); }
      catch (e) { expect(e).toBeDefined(); }
    });
  });
});
```

Conventions:
- **Import all jest globals** from `"@jest/globals"` (not globally available)
- **Resource names**: lowercase + underscores + `Date.now()` suffix
- **Cleanup**: individual try/catch per operation in `afterAll`
- **Timeouts**: `jest.setTimeout(60000)` minimum
- **Version gating**: `describeForOrkesV5` from `./utils/customJestDescribe`
- **Skip guards**: `if (!featureSupported) return;` for optional server features
- **Worker tests**: `clearWorkerRegistry()` in `afterEach`, start workers before workflows
- **`--force-exit` flag**: always use with `npx jest` (some tests leave open handles)

### Coverage

| Layer | Tests | Notes |
|-------|-------|-------|
| Unit | 469 | 97%+ on new code |
| E2E | 191 | 100% of all ~187 client methods |
| Error paths | 35 | Every client has negative tests |
| **Total** | **660** | |

## OpenAPI Layer

`src/open-api/generated/` is auto-generated. **Never edit directly.**

```bash
npm run generate-openapi-layer  # Regenerate from spec
```

To extend types missing from the spec:

```typescript
// In src/open-api/types.ts
import type { SomeType as OpenApiSomeType } from "./generated/types.gen";

export interface ExtendedSomeType extends OpenApiSomeType {
  customField?: string;  // Exists at runtime but not in spec
}
```

Import patterns:
- Types: `import type { Workflow, Task } from "../open-api"`
- Resources: `import { WorkflowResource, TaskResource } from "../open-api/generated"`

The `types.ts` file also defines key enums (`TaskType` with 28 variants, `Consistency`, `ReturnStrategy`, `TaskResultStatusEnum`) and specific typed task definitions (`SimpleTaskDef`, `HttpTaskDef`, etc.).

## Environment Variables

Read in `resolveOrkesConfig.ts`. Env vars take precedence over config object values.

| Variable | Purpose | Default |
|----------|---------|---------|
| `CONDUCTOR_SERVER_URL` | Server URL (trailing `/` and `/api` auto-stripped) | Required |
| `CONDUCTOR_AUTH_KEY` | API key ID | Required for auth |
| `CONDUCTOR_AUTH_SECRET` | API key secret | Required for auth |
| `CONDUCTOR_MAX_HTTP2_CONNECTIONS` | HTTP/2 connection pool size | - |
| `CONDUCTOR_REFRESH_TOKEN_INTERVAL` | Token refresh interval (ms) | 1200000 |
| `CONDUCTOR_REQUEST_TIMEOUT_MS` | Per-request timeout | 60000 |
| `CONDUCTOR_CONNECT_TIMEOUT_MS` | Connection timeout | 30000 |
| `CONDUCTOR_TLS_CERT_PATH` | Client TLS certificate | - |
| `CONDUCTOR_TLS_KEY_PATH` | Client TLS key | - |
| `CONDUCTOR_TLS_CA_PATH` | CA bundle | - |
| `CONDUCTOR_PROXY_URL` | HTTP/HTTPS proxy | - |
| `ORKES_BACKEND_VERSION` | Server version (test gating only) | - |

## Examples

The `examples/` directory contains 32 runnable TypeScript files across 3 subdirectories, matching the Python SDK's examples structure. See [examples/README.md](examples/README.md) for the full catalog.

### Structure

```
examples/
├── 13 core files          # Workers, workflows, metrics, testing
├── agentic-workflows/     # 5 AI/LLM agent examples
├── api-journeys/          # 7 complete API lifecycle demos
└── advanced/              # 7 advanced workflow patterns
```

### Conventions

- **Self-contained**: Every file imports from `../src/sdk`, connects via `OrkesClients.from()`, and is runnable with `npx ts-node examples/<file>.ts`
- **Cleanup**: Examples that create resources clean up after themselves in try/finally blocks
- **Env vars**: All examples read `CONDUCTOR_SERVER_URL` (required) and optionally `CONDUCTOR_AUTH_KEY`/`CONDUCTOR_AUTH_SECRET`
- **AI examples**: Use `LLM_PROVIDER` and `LLM_MODEL` env vars with defaults to `openai_integration` / `gpt-4o`
- **Naming**: Kebab-case file names matching Python SDK's snake_case pattern (e.g., `fork-join.ts` ↔ `fork_join_script.py`)
- **Imports**: Use relative paths from the example file (e.g., `from "../../src/sdk"` for subdirectory examples)

### Adding a New Example

1. Create the `.ts` file in the appropriate directory
2. Follow the standard pattern:
   ```typescript
   /**
    * Example Name — Brief description
    *
    * Demonstrates: feature1, feature2, feature3
    *
    * Run:
    *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/<file>.ts
    */
   import { OrkesClients, ... } from "../src/sdk";

   async function main() {
     const clients = await OrkesClients.from();
     // ... example logic ...
     process.exit(0);
   }

   main().catch((err) => { console.error(err); process.exit(1); });
   ```
3. Add to `examples/README.md` in the appropriate category table
4. If it's a key example, add to the root `README.md` examples table

### Python SDK Mapping

| JS Example | Python Equivalent | Notes |
|------------|-------------------|-------|
| `workers-e2e.ts` | `workers_e2e.py` | Multiple workers chained |
| `kitchensink.ts` | `kitchensink.py` | All task types |
| `workflow-ops.ts` | `workflow_ops.py` | Lifecycle operations |
| `dynamic-workflow.ts` | `dynamic_workflow.py` | Programmatic builder |
| `task-context.ts` | `task_context_example.py` | TaskContext usage |
| `metrics.ts` | `metrics_example.py` | Prometheus metrics |
| `express-worker-service.ts` | `fastapi_worker_service.py` | HTTP server + workers |
| `api-journeys/authorization.ts` | `authorization_journey.py` | All authorization APIs |
| `api-journeys/metadata.ts` | `metadata_journey.py` | All metadata APIs |
| `api-journeys/prompts.ts` | `prompt_journey.py` | All prompt APIs |
| `api-journeys/schedules.ts` | `schedule_journey.py` | All schedule APIs |
| `agentic-workflows/function-calling.ts` | `agentic_workflows/function_calling_example.py` | LLM tool calling |
| `agentic-workflows/multiagent-chat.ts` | `agentic_workflows/multiagent_chat.py` | Multi-agent debate |
| `advanced/rag-workflow.ts` | `rag_workflow.py` | RAG pipeline |
| `advanced/fork-join.ts` | `orkes/fork_join_script.py` | Parallel execution |

## Build

```bash
npm run build          # tsup -> dist/ (ESM + CJS dual output)
npm run lint           # ESLint
npm run lint-fix       # ESLint auto-fix
npm run generate-docs  # TypeDoc -> markdown
```

Node 18+ required. Dual ESM/CJS via `tsup` with `exports` field in `package.json`.

## Python SDK Parity

| Feature | Python | JavaScript | Notes |
|---------|--------|------------|-------|
| Client factory | `OrkesClients` | `OrkesClients.from()` | Same pattern |
| 14 domain clients | All | All | Same method names |
| Workflow DSL | `ConductorWorkflow` | `ConductorWorkflow` | Fluent builder |
| Worker decorator | `@worker_task` | `@worker` | TS decorator syntax |
| Task context | `get_task_context()` | `getTaskContext()` | AsyncLocalStorage vs contextvars |
| Metrics | `MetricsCollector` | `MetricsCollector` | 19 metric types, quantiles |
| Metrics server | HTTP endpoint | `MetricsServer` | `/metrics` + `/health` |
| Non-retryable | `NonRetryableError` | `NonRetryableException` | `FAILED_WITH_TERMINAL_ERROR` |
| LLM builders | 13 builders | 13 builders | Full parity |
| Schema gen | `@input_schema` | `@schemaField` / `jsonSchema` | JSON Schema |
| Health monitor | Auto-restart | `HealthMonitorConfig` | Backoff + restart |
| HTTP/2 | Optional | Optional (Undici) | Connection pooling |
| Signal API | `signal()` | `signal()` + `EnhancedSignalResponse` | All 4 return strategies |
| Rate limits | `MetadataClient` | `setWorkflowRateLimit` | Raw HTTP (not in spec) |
| Examples | 46 files, 6 subdirs | 32 files, 3 subdirs | JS merges some Python examples |
