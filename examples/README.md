# Conductor TypeScript SDK Examples

Quick reference for example files demonstrating SDK features.

## :rocket: Quick Start

```bash
npm install
export CONDUCTOR_SERVER_URL=http://localhost:8080
npx ts-node examples/workers-e2e.ts
```

---

## :file_folder: Examples by Category

### Core Workers

| File | Description | Run |
|------|-------------|-----|
| **[workers-e2e.ts](workers-e2e.ts)** | :star: Start here — 3 chained workers end-to-end | `npx ts-node examples/workers-e2e.ts` |
| **[quickstart.ts](quickstart.ts)** | 60-second intro: @worker + ConductorWorkflow + execute | `npx ts-node examples/quickstart.ts` |
| **[helloworld.ts](helloworld.ts)** | Minimal complete workflow lifecycle | `npx ts-node examples/helloworld.ts` |
| **[worker-configuration.ts](worker-configuration.ts)** | Per-worker config: concurrency, poll interval, domain | `npx ts-node examples/worker-configuration.ts` |
| **[task-context.ts](task-context.ts)** | TaskContext: logging, callbacks, IN_PROGRESS pattern | `npx ts-node examples/task-context.ts` |
| **[task-configure.ts](task-configure.ts)** | Programmatic task defs: retry policies, timeouts, rate limits | `npx ts-node examples/task-configure.ts` |
| **[event-listeners.ts](event-listeners.ts)** | Custom TaskRunnerEventsListener hooks | `npx ts-node examples/event-listeners.ts` |
| **[express-worker-service.ts](express-worker-service.ts)** | Express.js HTTP server + Conductor workers in one process | `npx ts-node examples/express-worker-service.ts` |

### Workflows

| File | Description | Run |
|------|-------------|-----|
| **[dynamic-workflow.ts](dynamic-workflow.ts)** | Build workflows programmatically with switch, loop, inline | `npx ts-node examples/dynamic-workflow.ts` |
| **[kitchensink.ts](kitchensink.ts)** | All major task types in one workflow | `npx ts-node examples/kitchensink.ts` |
| **[workflow-ops.ts](workflow-ops.ts)** | Lifecycle: start, pause, resume, terminate, restart, retry, search | `npx ts-node examples/workflow-ops.ts` |
| **[test-workflows.ts](test-workflows.ts)** | Unit testing with mock task outputs (no workers needed) | `npx ts-node examples/test-workflows.ts` |

### AI/LLM Workflows

Require an LLM integration configured in Conductor. Set `LLM_PROVIDER` and `LLM_MODEL` env vars.

| File | Description | Run |
|------|-------------|-----|
| **[agentic-workflows/llm-chat.ts](agentic-workflows/llm-chat.ts)** | Two LLMs in automated multi-turn conversation | `npx ts-node examples/agentic-workflows/llm-chat.ts` |
| **[agentic-workflows/llm-chat-human-in-loop.ts](agentic-workflows/llm-chat-human-in-loop.ts)** | Interactive chat with WAIT tasks for human input | `npx ts-node examples/agentic-workflows/llm-chat-human-in-loop.ts` |
| **[agentic-workflows/function-calling.ts](agentic-workflows/function-calling.ts)** | LLM dynamically picks which worker to call | `npx ts-node examples/agentic-workflows/function-calling.ts` |
| **[agentic-workflows/mcp-weather-agent.ts](agentic-workflows/mcp-weather-agent.ts)** | MCP tool discovery + invocation for real-time data | `npx ts-node examples/agentic-workflows/mcp-weather-agent.ts` |
| **[agentic-workflows/multiagent-chat.ts](agentic-workflows/multiagent-chat.ts)** | Multi-agent debate: optimist vs skeptic with moderator | `npx ts-node examples/agentic-workflows/multiagent-chat.ts` |

### Monitoring

| File | Description | Run |
|------|-------------|-----|
| **[metrics.ts](metrics.ts)** | MetricsCollector + MetricsServer on :9090 (Prometheus) | `npx ts-node examples/metrics.ts` |
| **[event-listeners.ts](event-listeners.ts)** | Custom poll/execution/failure event hooks | `npx ts-node examples/event-listeners.ts` |

### Advanced

| File | Description | Notes |
|------|-------------|-------|
| **[advanced/fork-join.ts](advanced/fork-join.ts)** | Parallel branches with ConductorWorkflow.fork() | Both 3-branch and 2-branch shown |
| **[advanced/http-poll.ts](advanced/http-poll.ts)** | HTTP polling with fixed and linear backoff | Configurable strategies |
| **[advanced/sync-updates.ts](advanced/sync-updates.ts)** | Update variables and task outputs at runtime | External system integration |
| **[advanced/wait-for-webhook.ts](advanced/wait-for-webhook.ts)** | Webhook-driven workflow pauses | External signal completion |
| **[advanced/sub-workflows.ts](advanced/sub-workflows.ts)** | Registered + inline sub-workflow composition | toSubWorkflowTask() |
| **[advanced/rag-workflow.ts](advanced/rag-workflow.ts)** | RAG pipeline: index → search → LLM answer | Requires vector DB + LLM |
| **[advanced/vector-db.ts](advanced/vector-db.ts)** | Embeddings: generate, store, search, index | Requires vector DB |
| **[advanced/human-tasks.ts](advanced/human-tasks.ts)** | Human-in-the-loop: claim, update, complete | HumanExecutor API |

---

## :dart: API Journey Examples

End-to-end examples covering all APIs for each domain client.

### Authorization Journey

| File | Description | APIs |
|------|-------------|------|
| **[api-journeys/authorization.ts](api-journeys/authorization.ts)** | Full authorization lifecycle | 17 API calls |

**Scenario:** Create users and groups, manage membership, grant and revoke permissions, verify access, clean up.

**Features:**
- User CRUD (upsert, get, list, delete)
- Group CRUD (upsert, get, list, delete)
- Group membership (add/remove users)
- Permission management (grant, get, check, remove)
- Granted permission queries (user + group)

```bash
npx ts-node examples/api-journeys/authorization.ts
```

---

### Metadata Journey

| File | Description | APIs |
|------|-------------|------|
| **[api-journeys/metadata.ts](api-journeys/metadata.ts)** | Full metadata lifecycle | 21 API calls |

**Scenario:** Register tasks and workflows, manage tags, configure rate limits, bulk operations, clean up.

**Features:**
- Task definition CRUD (register, get, update, unregister, batch)
- Workflow definition CRUD (register, get, unregister)
- Tag management (add, get, set, delete for both tasks and workflows)
- Rate limit management (set, get, remove)
- Bulk operations (getAllTaskDefs, getAllWorkflowDefs)

```bash
npx ts-node examples/api-journeys/metadata.ts
```

---

### Prompt Journey

| File | Description | APIs |
|------|-------------|------|
| **[api-journeys/prompts.ts](api-journeys/prompts.ts)** | Full prompt lifecycle | 9 API calls |

**Scenario:** Save prompt templates, update, test against LLM, manage tags, list all, delete.

**Features:**
- Prompt CRUD (save, get, update, delete)
- Tag management (set, get, delete)
- Test prompts against LLM with variables
- List all prompt templates

```bash
npx ts-node examples/api-journeys/prompts.ts
```

---

### Schedule Journey

| File | Description | APIs |
|------|-------------|------|
| **[api-journeys/schedules.ts](api-journeys/schedules.ts)** | Full schedule lifecycle | 13 API calls |

**Scenario:** Create cron schedules, pause/resume, search executions, manage tags, preview next runs, clean up.

**Features:**
- Schedule CRUD (save, get, delete)
- Pause and resume schedules
- Search schedule executions
- Get next N execution times
- Tag management (set, get, delete)
- List all schedules (with optional workflow filter)

```bash
npx ts-node examples/api-journeys/schedules.ts
```

---

### Secrets Journey

| File | Description | APIs |
|------|-------------|------|
| **[api-journeys/secrets.ts](api-journeys/secrets.ts)** | Full secret lifecycle | 12 API calls |

**Scenario:** Store secrets, verify existence, retrieve, update, manage tags, list names, clean up.

**Features:**
- Secret CRUD (put, get, delete)
- Existence check
- Tag management (set, get, delete)
- List all secret names
- List grantable secrets

```bash
npx ts-node examples/api-journeys/secrets.ts
```

---

### Integrations Journey

| File | Description | APIs |
|------|-------------|------|
| **[api-journeys/integrations.ts](api-journeys/integrations.ts)** | Full integration lifecycle | 22 API calls |

**Scenario:** Register providers and APIs, query integrations, manage tags, associate prompts, clean up.

**Features:**
- Provider CRUD (save, get, list, delete)
- Integration API CRUD (save, get, list, delete)
- Query integrations (all, by category, available APIs, definitions)
- Tag management (provider tags + integration tags)
- Prompt association (associate, get)

```bash
npx ts-node examples/api-journeys/integrations.ts
```

---

### Schema Journey

| File | Description | APIs |
|------|-------------|------|
| **[api-journeys/schemas.ts](api-journeys/schemas.ts)** | Full schema lifecycle | 10 API calls |

**Scenario:** Register JSON schemas, create new versions, retrieve by name and version, list all, clean up.

**Features:**
- Schema registration (single + batch)
- Version management (create new versions)
- Retrieval (by name, by name + version, list all)
- Deletion (by version, by name)

```bash
npx ts-node examples/api-journeys/schemas.ts
```

---

### Application Journey

| File | Description | APIs |
|------|-------------|------|
| **[api-journeys/applications.ts](api-journeys/applications.ts)** | Full application lifecycle | 20 API calls |

**Scenario:** Create applications, manage access keys, assign roles, manage tags, clean up.

**Features:**
- Application CRUD (create, get, update, list, delete)
- Access key management (create, list, toggle, delete)
- Role management (add, remove)
- Tag management (add, get, delete)

```bash
npx ts-node examples/api-journeys/applications.ts
```

---

### Event Handler Journey

| File | Description | APIs |
|------|-------------|------|
| **[api-journeys/event-handlers.ts](api-journeys/event-handlers.ts)** | Full event handler lifecycle | 18 API calls |

**Scenario:** Create event handlers, update configuration, filter by event and status, manage tags, query queues, clean up.

**Features:**
- Event handler CRUD (add, get, update, list, delete)
- Event handler filtering (by event, active only)
- Tag management (add, get, delete)
- Queue configuration (list queue names)
- Event execution views

```bash
npx ts-node examples/api-journeys/event-handlers.ts
```

---

## :mortar_board: Learning Path

Start simple and build up:

```bash
# 1. Hello world (2 min)
npx ts-node examples/helloworld.ts

# 2. Multiple workers end-to-end (5 min)
npx ts-node examples/workers-e2e.ts

# 3. All task types (5 min)
npx ts-node examples/kitchensink.ts

# 4. Workflow lifecycle operations (5 min)
npx ts-node examples/workflow-ops.ts

# 5. Worker configuration + context (5 min)
npx ts-node examples/worker-configuration.ts
npx ts-node examples/task-context.ts

# 6. Event listeners + metrics (5 min)
npx ts-node examples/event-listeners.ts
npx ts-node examples/metrics.ts

# 7. Advanced patterns (10 min)
npx ts-node examples/advanced/fork-join.ts
npx ts-node examples/advanced/sub-workflows.ts

# 8. API journeys (10 min each)
npx ts-node examples/api-journeys/metadata.ts
npx ts-node examples/api-journeys/authorization.ts

# 9. AI/LLM workflows (requires LLM integration)
npx ts-node examples/agentic-workflows/function-calling.ts
npx ts-node examples/agentic-workflows/multiagent-chat.ts
```

---

## :package: Package Structure

```
examples/
├── quickstart.ts                    # 60-second intro
├── helloworld.ts                    # Minimal lifecycle
├── dynamic-workflow.ts              # Programmatic workflow builder
├── kitchensink.ts                   # All major task types
├── workflow-ops.ts                  # Workflow lifecycle management
├── workers-e2e.ts                   # Multiple workers end-to-end
├── test-workflows.ts                # Mock-based workflow testing
├── worker-configuration.ts          # Config hierarchy + env vars
├── task-context.ts                  # TaskContext usage
├── task-configure.ts                # Programmatic task definitions
├── event-listeners.ts               # Custom event listener hooks
├── metrics.ts                       # Prometheus metrics + HTTP server
├── express-worker-service.ts        # Express.js + workers integration
│
├── agentic-workflows/               # AI/LLM agent examples
│   ├── llm-chat.ts                  # Multi-turn automated AI conversation
│   ├── llm-chat-human-in-loop.ts    # Interactive chat with WAIT pauses
│   ├── function-calling.ts          # LLM-driven function routing
│   ├── mcp-weather-agent.ts         # MCP tool discovery + invocation
│   └── multiagent-chat.ts           # Multi-agent debate with moderator
│
├── api-journeys/                    # Complete API lifecycle demos
│   ├── authorization.ts             # Users, groups, permissions (17 calls)
│   ├── metadata.ts                  # Tasks, workflows, tags, rate limits (21 calls)
│   ├── prompts.ts                   # Prompt templates (9 calls)
│   ├── schedules.ts                 # Workflow schedules (13 calls)
│   ├── secrets.ts                   # Secret management (12 calls)
│   ├── integrations.ts              # Providers, APIs, tags (22 calls)
│   ├── schemas.ts                   # Schema definitions (10 calls)
│   ├── applications.ts             # Applications, access keys, roles (20 calls)
│   └── event-handlers.ts           # Event handlers, queues, tags (18 calls)
│
└── advanced/                        # Advanced workflow patterns
    ├── fork-join.ts                 # Parallel execution with join
    ├── http-poll.ts                 # HTTP polling with backoff
    ├── sync-updates.ts              # Runtime state updates
    ├── wait-for-webhook.ts          # Webhook-driven workflows
    ├── sub-workflows.ts             # Workflow composition
    ├── rag-workflow.ts              # RAG pipeline (index → search → answer)
    ├── vector-db.ts                 # Vector DB operations
    └── human-tasks.ts              # Human-in-the-loop workflow
```

---

## :wrench: Configuration

### Worker Architecture

```typescript
import { OrkesClients, TaskHandler, worker, simpleTask, ConductorWorkflow } from "@io-orkes/conductor-javascript";
import type { Task, TaskResult } from "@io-orkes/conductor-javascript";

// 1. Define workers with @worker decorator
@worker({ taskDefName: "my_task", concurrency: 5, pollInterval: 100 })
async function myTask(task: Task): Promise<TaskResult> {
  return { status: "COMPLETED", outputData: { result: "done" } };
}

// 2. Connect to Conductor
const clients = await OrkesClients.from();

// 3. Build and register workflows
const wf = new ConductorWorkflow(clients.getWorkflowClient(), "my_workflow")
  .add(simpleTask("my_ref", "my_task", { key: "${workflow.input.key}" }));
await wf.register();

// 4. Start workers + execute
const handler = new TaskHandler({ client: clients.getClient(), scanForDecorated: true });
await handler.startWorkers();
const run = await wf.execute({ key: "value" });
await handler.stopWorkers();
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CONDUCTOR_SERVER_URL` | Conductor server URL | Required |
| `CONDUCTOR_AUTH_KEY` | Authentication key ID | — |
| `CONDUCTOR_AUTH_SECRET` | Authentication secret | — |
| `LLM_PROVIDER` | LLM integration name | `openai_integration` |
| `LLM_MODEL` | LLM model name | `gpt-4o` |
| `EMBEDDING_PROVIDER` | Embedding model integration | `openai_integration` |
| `EMBEDDING_MODEL` | Embedding model name | `text-embedding-3-small` |
| `VECTOR_DB` | Vector DB integration name | `pinecone_integration` |
| `VECTOR_INDEX` | Vector DB index name | varies |
| `MCP_SERVER` | MCP server integration name | `weather_mcp_server` |

---

## :bug: Common Issues

**Workers don't pick up tasks**
- Ensure `CONDUCTOR_SERVER_URL` is set correctly
- Workers must be started (`handler.startWorkers()`) **before** executing workflows
- Check the `taskDefName` matches between `@worker` and `simpleTask`

**Decorator errors (`TS1206`)**
- Add `"experimentalDecorators": true` to your `tsconfig.json`
- Or use `npx ts-node --compiler-options '{"experimentalDecorators":true}'`

**Express example requires express**
- Install: `npm install express @types/express`

**AI/LLM examples fail**
- Requires an LLM integration configured in Conductor (e.g., OpenAI)
- Set `LLM_PROVIDER` and `LLM_MODEL` environment variables
- Verify the integration is active in the Conductor UI

**Vector DB examples fail**
- Requires a vector DB integration (e.g., Pinecone, Weaviate)
- Set `VECTOR_DB` and `VECTOR_INDEX` environment variables

---

## :books: Documentation

- [SDK README](../README.md) — Installation, quickstart, API reference
- [SDK Development Guide](../SDK_DEVELOPMENT.md) — Architecture, patterns, testing
- [Breaking Changes](../BREAKING_CHANGES.md) — v3.x migration guide
- [Conductor Documentation](https://docs.conductor-oss.org/) — Server documentation
