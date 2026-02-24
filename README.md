# JavaScript/TypeScript SDK for Conductor

[![Build Status](https://github.com/conductor-oss/javascript-sdk/actions/workflows/pull_request.yml/badge.svg)](https://github.com/conductor-oss/javascript-sdk/actions/workflows/pull_request.yml)
[![npm](https://img.shields.io/npm/v/@io-orkes/conductor-javascript.svg)](https://www.npmjs.com/package/@io-orkes/conductor-javascript)
[![License](https://img.shields.io/npm/l/@io-orkes/conductor-javascript.svg)](LICENSE)

TypeScript/JavaScript SDK for [Conductor](https://www.conductor-oss.org/) (OSS and Orkes Conductor) — an orchestration platform for building distributed applications, AI agents, and workflow-driven microservices. Define workflows as code, run workers anywhere, and let Conductor handle retries, state management, and observability.

If you find [Conductor](https://github.com/conductor-oss/conductor) useful, please consider giving it a star on GitHub — it helps the project grow.

[![GitHub stars](https://img.shields.io/github/stars/conductor-oss/conductor.svg?style=social&label=Star&maxAge=)](https://GitHub.com/conductor-oss/conductor/)

<!-- TOC -->
* [Start Conductor server](#start-conductor-server)
* [Install the SDK](#install-the-sdk)
* [60-Second Quickstart](#60-second-quickstart)
* [Workers](#workers)
* [Monitoring Workers](#monitoring-workers)
* [Workflows](#workflows)
* [Troubleshooting](#troubleshooting)
* [Examples](#examples)
* [API Journey Examples](#api-journey-examples)
* [AI & LLM Workflows](#ai--llm-workflows)
* [Documentation](#documentation)
* [Support](#support)
* [Frequently Asked Questions](#frequently-asked-questions)
* [License](#license)
<!-- TOC -->

## Start Conductor server

If you don't already have a Conductor server running, pick one:

**Docker (recommended, includes UI):**

```shell
docker run -p 8080:8080 conductoross/conductor:latest
```

The UI will be available at `http://localhost:8080` and the API at `http://localhost:8080/api`.

**MacOS / Linux (one-liner):**

```shell
curl -sSL https://raw.githubusercontent.com/conductor-oss/conductor/main/conductor_server.sh | sh
```

**Conductor CLI:**

```shell
npm install -g @conductor-oss/conductor-cli
conductor server start
```

## Install the SDK

```shell
npm install @io-orkes/conductor-javascript
```

## 60-Second Quickstart

**Step 1: Create a workflow**

Workflows are definitions that reference task types. We'll build a workflow called `greetings` that runs one worker task and returns its output.

```typescript
import { ConductorWorkflow } from "@io-orkes/conductor-javascript";

const workflow = new ConductorWorkflow(executor, "greetings")
  .add(greet({ task_ref_name: "greet_ref", name: workflow.input("name") }))
  .outputParameters({ result: "${greet_ref.output.result}" });

await workflow.register();
```

**Step 2: Write a worker**

Workers are TypeScript functions decorated with `@worker` that poll Conductor for tasks and execute them.

```typescript
import { worker } from "@io-orkes/conductor-javascript";

@worker({ taskDefName: "greet" })
async function greet(task: Task) {
  return {
    status: "COMPLETED",
    outputData: { result: `Hello ${task.inputData.name}` },
  };
}
```

**Step 3: Run your first workflow app**

Create a `quickstart.ts` with the following:

```typescript
import {
  OrkesClients,
  ConductorWorkflow,
  TaskHandler,
  worker,
  simpleTask,
} from "@io-orkes/conductor-javascript";
import type { Task } from "@io-orkes/conductor-javascript";

// A worker is any TypeScript function.
@worker({ taskDefName: "greet" })
async function greet(task: Task) {
  return {
    status: "COMPLETED" as const,
    outputData: { result: `Hello ${task.inputData.name}` },
  };
}

async function main() {
  // Configure the SDK (reads CONDUCTOR_SERVER_URL / CONDUCTOR_AUTH_* from env).
  const clients = await OrkesClients.from();
  const executor = clients.getWorkflowClient();

  // Build a workflow with the fluent builder.
  const workflow = new ConductorWorkflow(executor, "greetings")
    .add(simpleTask("greet_ref", "greet", { name: "${workflow.input.name}" }))
    .outputParameters({ result: "${greet_ref.output.result}" });

  await workflow.register();

  // Start polling for tasks (auto-discovers @worker decorated functions).
  const handler = new TaskHandler({
    client: clients.getClient(),
    scanForDecorated: true,
  });
  await handler.startWorkers();

  // Run the workflow and get the result.
  const run = await workflow.execute({ name: "Conductor" });
  console.log(`result: ${run.output?.result}`);

  await handler.stopWorkers();
}

main();
```

Run it:

```shell
export CONDUCTOR_SERVER_URL=http://localhost:8080
npx ts-node quickstart.ts
```

> ### Using Orkes Conductor / Remote Server?
> Export your authentication credentials:
>
> ```shell
> export CONDUCTOR_SERVER_URL="https://your-cluster.orkesconductor.io/api"
> export CONDUCTOR_AUTH_KEY="your-key"
> export CONDUCTOR_AUTH_SECRET="your-secret"
> ```

That's it — you defined a worker, built a workflow, and executed it. Open the Conductor UI (default: [http://localhost:8080](http://localhost:8080)) to see the execution.

## Workers

Workers are TypeScript functions that execute Conductor tasks. Decorate any function with `@worker` to register it as a worker (auto-discovered by `TaskHandler`) and use it as a workflow task.

```typescript
import { worker, TaskHandler } from "@io-orkes/conductor-javascript";

@worker({ taskDefName: "greet", concurrency: 5, pollInterval: 100 })
async function greet(task: Task) {
  return {
    status: "COMPLETED",
    outputData: { result: `Hello ${task.inputData.name}` },
  };
}

@worker({ taskDefName: "process_payment", domain: "payments" })
async function processPayment(task: Task) {
  const result = await paymentGateway.charge(task.inputData.customerId, task.inputData.amount);
  return { status: "COMPLETED", outputData: { transactionId: result.id } };
}

// Auto-discover and start all decorated workers
const handler = new TaskHandler({ client, scanForDecorated: true });
await handler.startWorkers();

// Graceful shutdown
process.on("SIGTERM", async () => {
  await handler.stopWorkers();
  process.exit(0);
});
```

**Worker configuration:**

```typescript
@worker({
  taskDefName: "my_task",    // Required: task name
  concurrency: 5,             // Max concurrent tasks (default: 1)
  pollInterval: 100,          // Polling interval in ms (default: 100)
  domain: "production",       // Task domain for multi-tenancy
  workerId: "worker-123",     // Unique worker identifier
})
```

**Environment variable overrides** (no code changes needed):

```shell
# Global (all workers)
export CONDUCTOR_WORKER_ALL_POLL_INTERVAL=500
export CONDUCTOR_WORKER_ALL_CONCURRENCY=10

# Per-worker override
export CONDUCTOR_WORKER_SEND_EMAIL_CONCURRENCY=20
export CONDUCTOR_WORKER_PROCESS_PAYMENT_DOMAIN=payments
```

**NonRetryableException** — mark failures as terminal to prevent retries:

```typescript
import { NonRetryableException } from "@io-orkes/conductor-javascript";

@worker({ taskDefName: "validate_order" })
async function validateOrder(task: Task) {
  const order = await getOrder(task.inputData.orderId);
  if (!order) {
    throw new NonRetryableException("Order not found"); // FAILED_WITH_TERMINAL_ERROR
  }
  return { status: "COMPLETED", outputData: { validated: true } };
}
```

- `throw new Error()` → Task status: `FAILED` (will retry)
- `throw new NonRetryableException()` → Task status: `FAILED_WITH_TERMINAL_ERROR` (no retry)

**TaskContext** — access per-task context from anywhere in the async call stack:

```typescript
import { getTaskContext } from "@io-orkes/conductor-javascript";

@worker({ taskDefName: "process" })
async function process(task: Task) {
  const ctx = getTaskContext();
  ctx?.addLog("Processing started");
  ctx?.setCallbackAfter(30); // re-queue after 30 seconds
  return { status: "IN_PROGRESS", callbackAfterSeconds: 30 };
}
```

**Event listeners** for observability:

```typescript
const handler = new TaskHandler({
  client,
  scanForDecorated: true,
  eventListeners: [{
    onTaskExecutionCompleted(event) {
      metrics.histogram("task_duration_ms", event.durationMs, { task_type: event.taskType });
    },
    onTaskUpdateFailure(event) {
      alertOps({ severity: "CRITICAL", message: `Task update failed`, taskId: event.taskId });
    },
  }],
});
```

**Organize workers across files** with module imports:

```typescript
const handler = await TaskHandler.create({
  client,
  importModules: ["./workers/orderWorkers", "./workers/paymentWorkers"],
});
await handler.startWorkers();
```

**Legacy TaskManager API** continues to work with full backward compatibility. New projects should use `@worker` + `TaskHandler` above.

## Monitoring Workers

Enable Prometheus metrics with the built-in `MetricsCollector`:

```typescript
import { MetricsCollector, MetricsServer, TaskHandler } from "@io-orkes/conductor-javascript";

const metrics = new MetricsCollector();
const server = new MetricsServer(metrics, 9090);
await server.start();

const handler = new TaskHandler({
  client,
  eventListeners: [metrics],
  scanForDecorated: true,
});
await handler.startWorkers();
// GET http://localhost:9090/metrics — Prometheus text format
// GET http://localhost:9090/health  — {"status":"UP"}
```

Collects 19 metric types: poll counts, execution durations, error rates, output sizes, and more — with p50/p75/p90/p95/p99 quantiles.

## Workflows

Define workflows in TypeScript using the `ConductorWorkflow` builder:

```typescript
import { ConductorWorkflow, simpleTask, httpTask } from "@io-orkes/conductor-javascript";

const workflow = new ConductorWorkflow(executor, "order_flow")
  .add(simpleTask("validate_ref", "validate_order", {
    orderId: "${workflow.input.orderId}",
  }))
  .add(httpTask("inventory_ref", {
    uri: "https://api.example.com/check",
    method: "POST",
    body: { productId: "${workflow.input.productId}" },
  }))
  .fork([
    [simpleTask("email_ref", "send_email", {})],
    [simpleTask("sms_ref", "send_sms", {})],
  ])
  .timeoutSeconds(3600)
  .outputParameters({ orderId: "${workflow.input.orderId}" });

await workflow.register();
```

**Execute workflows:**

```typescript
// Synchronous (waits for completion)
const run = await workflow.execute({ orderId: "ORDER-123" });
console.log(run.output);

// Asynchronous (returns workflow ID immediately)
const workflowId = await workflow.startWorkflow({ orderId: "ORDER-123" });

// Or use WorkflowExecutor directly
const executor = clients.getWorkflowClient();
const id = await executor.startWorkflow({ name: "order_flow", version: 1, input: { orderId: "ORDER-123" } });
```

**Manage running workflows and send signals:**

```typescript
const executor = clients.getWorkflowClient();

await executor.pause(workflowId);
await executor.resume(workflowId);
await executor.terminate(workflowId, "no longer needed");
await executor.retry(workflowId, false);
await executor.restart(workflowId, false);

// Signal a WAIT task to complete
await executor.signal(workflowId, TaskResultStatusEnum.COMPLETED, { result: "approved" });
```

**Compose workflows** with sub-workflows:

```typescript
const childWorkflow = new ConductorWorkflow(executor, "child_flow")
  .add(simpleTask("step_ref", "child_step", {}));

const parentWorkflow = new ConductorWorkflow(executor, "parent_flow")
  .add(childWorkflow.toSubWorkflowTask("child_ref"));
```

## Troubleshooting

- **Worker stops polling or crashes:** `TaskHandler` monitors and restarts worker polling loops by default. Expose a health check using `handler.running` and `handler.runningWorkerCount`. If you enable metrics, alert on `worker_restart_total`.
- **HTTP/2 connection errors:** The SDK uses Undici for HTTP/2 when available. If your environment has unstable long-lived connections, the SDK falls back to HTTP/1.1 automatically. You can also provide a custom fetch function: `orkesConductorClient(config, myFetch)`.
- **Task stuck in SCHEDULED:** Ensure your worker is polling for the correct `taskDefName`. Workers must be started before the workflow is executed.

## Examples

See the [Examples Guide](examples/README.md) for the full catalog. Key examples:

| Example | Description | Run |
|---------|-------------|-----|
| [workers-e2e.ts](examples/workers-e2e.ts) | End-to-end: 3 chained workers with verification | `npx ts-node examples/workers-e2e.ts` |
| [quickstart.ts](examples/quickstart.ts) | 60-second intro: @worker + workflow + execute | `npx ts-node examples/quickstart.ts` |
| [kitchensink.ts](examples/kitchensink.ts) | All major task types in one workflow | `npx ts-node examples/kitchensink.ts` |
| [workflow-ops.ts](examples/workflow-ops.ts) | Lifecycle: pause, resume, terminate, retry, search | `npx ts-node examples/workflow-ops.ts` |
| [test-workflows.ts](examples/test-workflows.ts) | Unit testing with mock outputs (no workers) | `npx ts-node examples/test-workflows.ts` |
| [metrics.ts](examples/metrics.ts) | Prometheus metrics + HTTP server on :9090 | `npx ts-node examples/metrics.ts` |
| [express-worker-service.ts](examples/express-worker-service.ts) | Express.js + workers in one process | `npx ts-node examples/express-worker-service.ts` |
| [function-calling.ts](examples/agentic-workflows/function-calling.ts) | LLM dynamically picks which worker to call | `npx ts-node examples/agentic-workflows/function-calling.ts` |
| [fork-join.ts](examples/advanced/fork-join.ts) | Parallel branches with join synchronization | `npx ts-node examples/advanced/fork-join.ts` |
| [sub-workflows.ts](examples/advanced/sub-workflows.ts) | Workflow composition with sub-workflows | `npx ts-node examples/advanced/sub-workflows.ts` |

## API Journey Examples

End-to-end examples covering all APIs for each domain:

| Example | APIs | Run |
|---------|------|-----|
| [authorization.ts](examples/api-journeys/authorization.ts) | Authorization APIs (17 calls) | `npx ts-node examples/api-journeys/authorization.ts` |
| [metadata.ts](examples/api-journeys/metadata.ts) | Metadata APIs (21 calls) | `npx ts-node examples/api-journeys/metadata.ts` |
| [prompts.ts](examples/api-journeys/prompts.ts) | Prompt APIs (9 calls) | `npx ts-node examples/api-journeys/prompts.ts` |
| [schedules.ts](examples/api-journeys/schedules.ts) | Schedule APIs (13 calls) | `npx ts-node examples/api-journeys/schedules.ts` |
| [secrets.ts](examples/api-journeys/secrets.ts) | Secret APIs (12 calls) | `npx ts-node examples/api-journeys/secrets.ts` |
| [integrations.ts](examples/api-journeys/integrations.ts) | Integration APIs (22 calls) | `npx ts-node examples/api-journeys/integrations.ts` |
| [schemas.ts](examples/api-journeys/schemas.ts) | Schema APIs (10 calls) | `npx ts-node examples/api-journeys/schemas.ts` |

## AI & LLM Workflows

Conductor supports AI-native workflows including agentic tool calling, RAG pipelines, and multi-agent orchestration. The SDK provides typed builders for all LLM task types:

| Builder | Description |
|---------|-------------|
| `llmChatCompleteTask` | LLM chat completion (OpenAI, Anthropic, etc.) |
| `llmTextCompleteTask` | Text completion |
| `llmGenerateEmbeddingsTask` | Generate vector embeddings |
| `llmIndexDocumentTask` | Index a document into a vector store |
| `llmIndexTextTask` | Index text into a vector store |
| `llmSearchIndexTask` | Search a vector index |
| `llmSearchEmbeddingsTask` | Search by embedding similarity |
| `llmStoreEmbeddingsTask` | Store pre-computed embeddings |
| `llmQueryEmbeddingsTask` | Query embeddings |
| `generateImageTask` | Generate images |
| `generateAudioTask` | Generate audio |
| `callMcpToolTask` | Call an MCP tool |
| `listMcpToolsTask` | List available MCP tools |

**Example: LLM chat workflow**

```typescript
import { ConductorWorkflow, llmChatCompleteTask, Role } from "@io-orkes/conductor-javascript";

const workflow = new ConductorWorkflow(executor, "ai_chat")
  .add(llmChatCompleteTask("chat_ref", "openai", "gpt-4o", {
    messages: [{ role: Role.USER, message: "${workflow.input.question}" }],
    temperature: 0.7,
    maxTokens: 500,
  }))
  .outputParameters({ answer: "${chat_ref.output.result}" });

await workflow.register();
const run = await workflow.execute({ question: "What is Conductor?" });
console.log(run.output?.answer);
```

**Agentic Workflows**

Build AI agents where LLMs dynamically select and call TypeScript workers as tools.
See [examples/agentic-workflows/](examples/agentic-workflows/) for all examples.

| Example | Description |
|---------|-------------|
| [llm-chat.ts](examples/agentic-workflows/llm-chat.ts) | Automated multi-turn conversation between two LLMs |
| [llm-chat-human-in-loop.ts](examples/agentic-workflows/llm-chat-human-in-loop.ts) | Interactive chat with WAIT tasks for human input |
| [function-calling.ts](examples/agentic-workflows/function-calling.ts) | LLM dynamically picks which worker function to call |
| [mcp-weather-agent.ts](examples/agentic-workflows/mcp-weather-agent.ts) | MCP tool discovery and invocation for real-time data |
| [multiagent-chat.ts](examples/agentic-workflows/multiagent-chat.ts) | Multi-agent debate: optimist vs skeptic with moderator |

**RAG and Vector DB Workflows**

| Example | Description |
|---------|-------------|
| [rag-workflow.ts](examples/advanced/rag-workflow.ts) | End-to-end RAG: document indexing → semantic search → LLM answer |
| [vector-db.ts](examples/advanced/vector-db.ts) | Vector DB operations: embedding generation, storage, search |

## Documentation

| Document | Description |
|----------|-------------|
| [SDK Development Guide](SDK_DEVELOPMENT.md) | Architecture, patterns, pitfalls, testing |
| [Breaking Changes](BREAKING_CHANGES.md) | v3.x migration guide |
| [Workflow Management](docs/api-reference/workflow-executor.md) | Start, pause, resume, terminate, retry, search, signal |
| [Task Management](docs/api-reference/task-client.md) | Task operations, logs, queue management |
| [Metadata](docs/api-reference/metadata-client.md) | Task & workflow definitions, tags, rate limits |
| [Scheduling](docs/api-reference/scheduler-client.md) | Workflow scheduling with CRON expressions |
| [Authorization](docs/api-reference/authorization-client.md) | Users, groups, permissions |
| [Applications](docs/api-reference/application-client.md) | Application management, access keys, roles |
| [Events](docs/api-reference/event-client.md) | Event handlers, event-driven workflows |
| [Human Tasks](docs/api-reference/human-executor.md) | Human-in-the-loop workflows, form templates |
| [Service Registry](docs/api-reference/service-registry-client.md) | Service discovery, circuit breakers |
| [Secrets](docs/api-reference/secret-client.md) | Secret storage and management |
| [Prompts](docs/api-reference/prompt-client.md) | AI/LLM prompt templates |
| [Integrations](docs/api-reference/integration-client.md) | AI/LLM provider integrations |
| [Schemas](docs/api-reference/schema-client.md) | JSON/Avro/Protobuf schema management |

## Support

- [Open an issue (SDK)](https://github.com/conductor-oss/javascript-sdk/issues) for SDK bugs, questions, and feature requests
- [Open an issue (Conductor server)](https://github.com/conductor-oss/conductor/issues) for Conductor OSS server issues
- [Join the Conductor Slack](https://join.slack.com/t/orkes-conductor/shared_invite/zt-2vdbx239s-Eacdyqya9giNLHfrCavfaA) for community discussion and help
- [Orkes Community Forum](https://community.orkes.io/) for Q&A

## Frequently Asked Questions

**Is this the same as Netflix Conductor?**

Yes. Conductor OSS is the continuation of the original [Netflix Conductor](https://github.com/Netflix/conductor) repository after Netflix contributed the project to the open-source foundation.

**Is this project actively maintained?**

Yes. [Orkes](https://orkes.io) is the primary maintainer and offers an enterprise SaaS platform for Conductor across all major cloud providers.

**Can Conductor scale to handle my workload?**

Conductor was built at Netflix to handle massive scale and has been battle-tested in production environments processing millions of workflows. It scales horizontally to meet virtually any demand.

**What Node.js versions are supported?**

Node.js 18 and above.

**Should I use `@worker` decorator or the legacy `TaskManager`?**

Use `@worker` + `TaskHandler` for all new projects. It provides auto-discovery, cleaner code, and better TypeScript integration. The legacy `TaskManager` API is maintained for backward compatibility.

**Can I mix workers written in different languages?**

Yes. A single workflow can have workers written in TypeScript, Python, Java, Go, or any other supported language. Workers communicate through the Conductor server, not directly with each other.

**How do I run workers in production?**

Workers are standard Node.js processes. Deploy them as you would any Node.js application — in containers, VMs, or serverless. Workers poll the Conductor server for tasks, so no inbound ports need to be opened.

**How do I test workflows without running a full Conductor server?**

The SDK provides `testWorkflow()` on `WorkflowExecutor` that uses Conductor's `POST /api/workflow/test` endpoint to evaluate workflows with mock task outputs.

**Does the SDK support HTTP/2?**

Yes. When the optional `undici` package is installed (`npm install undici`), the SDK automatically uses HTTP/2 with connection pooling for better performance.

## License

Apache 2.0
