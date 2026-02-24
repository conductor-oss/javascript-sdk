# Python SDK vs JavaScript SDK - Detailed Comparison

## Overview

This document provides a detailed comparison between the **Python SDK** (golden reference, `conductor-python`) and the **JavaScript SDK** (`@io-orkes/conductor-javascript` v3.0.0), covering API surface, architecture, worker system, and feature parity.

**Verdict Summary**: The JavaScript SDK has **near-complete parity** with the Python SDK (~98%). All client classes (including rate limit CRUD), worker features (TaskContext, adaptive backoff, 19 Prometheus metrics with quantiles and optional prom-client, decorator-based JSON schema generation), workflow DSL (`ConductorWorkflow` with `toSubWorkflowTask()`), and all 34 task type builders (including 13 LLM/AI + 2 MCP) are implemented.

---

## 1. Architecture Comparison

### Client Factory Pattern

| Aspect | Python SDK | JavaScript SDK | Parity |
|--------|-----------|---------------|--------|
| Factory class | `OrkesClients(configuration)` returns typed clients | `OrkesClients.from(config)` returns typed clients | **Same pattern** |
| Client creation | `clients.get_workflow_client()`, etc. | `clients.getWorkflowClient()`, etc. | **Same** |
| Direct construction | N/A | `new WorkflowExecutor(client)` also works | JS has both |
| Configuration | `Configuration(base_url, authentication_settings)` | `OrkesApiConfig { serverUrl, keyId, keySecret }` | Similar |
| Auth | `AuthenticationSettings(key_id, key_secret)` | `keyId` + `keySecret` on config | Similar |

**Both SDKs** now use a centralized factory (`OrkesClients`) that vends typed client instances. JavaScript also supports direct construction by passing the OpenAPI client to individual client class constructors.

### HTTP Layer

| Aspect | Python SDK | JavaScript SDK |
|--------|-----------|---------------|
| Sync HTTP | `requests` library | N/A (JS is async) |
| Async HTTP | `httpx.AsyncClient` | `undici` (optional) or native `fetch` |
| HTTP/2 | Yes (via httpx) | Yes (via undici) |
| Rate limiting | Not built-in at SDK level | Auto-retry on HTTP 429 with exponential backoff |
| Token refresh | Via `auth_token_ttl_min` (default 45min) | Via `refreshTokenInterval` |
| Connection pooling | httpx connection pool (100 connections) | undici connection pool |

### Process Model

| Aspect | Python SDK | JavaScript SDK |
|--------|-----------|---------------|
| Worker isolation | **One OS process per worker** (multiprocessing) | **Single process**, one TaskRunner per worker |
| True parallelism | Yes (bypasses GIL) | No (Node.js single-threaded, but async I/O) |
| Sync worker execution | ThreadPoolExecutor per process | N/A |
| Async worker execution | AsyncTaskRunner with event loop per process | Poller with async callbacks |
| Auto-detection | `def` vs `async def` → selects runner type | No auto-detection (all workers are async JS functions) |

**Key Difference**: Python spawns **separate OS processes** per worker for true parallelism and fault isolation. JavaScript runs all workers in a **single Node.js process** with a Poller per worker. This is arguably appropriate for each language's concurrency model (Python has GIL; Node.js has a native event loop).

---

## 2. Client Modules Comparison

### Clients Present in Both SDKs

| Client | Python | JavaScript | API Parity |
|--------|--------|-----------|------------|
| **WorkflowExecutor** | `WorkflowExecutor` | `WorkflowExecutor` | **Full** |
| **WorkflowClient** | `WorkflowClient` (abstract) | Combined into `WorkflowExecutor` | **Full** |
| **MetadataClient** | `MetadataClient` | `MetadataClient` | **High** (rate limit endpoints not in OpenAPI spec) |
| **TaskClient** | `TaskClient` | `TaskClient` | **Full** |
| **SchedulerClient** | `SchedulerClient` | `SchedulerClient` | **Full** |
| **EventClient** | Via `EventResource` API | `EventClient` | High |
| **ServiceRegistryClient** | `ServiceRegistryClient` | `ServiceRegistryClient` | High |
| **HumanExecutor** | Via `HumanTask` API | `HumanExecutor` | High |
| **TemplateClient** | Via `HumanTask.saveTemplate` | `TemplateClient` | Low (JS minimal) |
| **AuthorizationClient** | `AuthorizationClient` | `AuthorizationClient` | **Full** |
| **SecretClient** | `SecretClient` | `SecretClient` | **Full** |
| **SchemaClient** | `SchemaClient` | `SchemaClient` | **Full** |
| **IntegrationClient** | `IntegrationClient` | `IntegrationClient` | **Full** |
| **PromptClient** | `PromptClient` | `PromptClient` | **Full** |

### Clients Present ONLY in Python SDK

| Client | Description | JS Status |
|--------|-------------|-----------|
| **ConductorWorkflow (DSL)** | Fluent workflow builder with `>>` operator | **Implemented** (`ConductorWorkflow` class with `.add()` chaining) |

### Clients Present ONLY in JavaScript SDK

| Client | Description | Python Status |
|--------|-------------|---------------|
| **ApplicationClient** | Application & access key management | Covered by `AuthorizationClient` |
| **Backward compat layer** | Legacy resource-based API with deprecation warnings | Not needed (Python didn't have this migration) |

---

## 3. Detailed API Method Comparison

### WorkflowExecutor

| Method | Python | JavaScript | Notes |
|--------|--------|-----------|-------|
| `registerWorkflow` | `register_workflow(workflow, overwrite)` | `registerWorkflow(override, workflow)` | Param order differs |
| `startWorkflow` | `start_workflow(request)` | `startWorkflow(request)` | Same |
| `startWorkflows` | `start_workflows(*requests)` | `startWorkflows(requests[])` | Same |
| `startWorkflowByName` | `start_workflow_by_name(name, input, ...)` | `startWorkflowByName(name, input, ...)` | **Same** |
| `executeWorkflow` | `execute_workflow(request, wait_until, wait_for, request_id)` | `executeWorkflow(request, name, version, requestId, waitUntilTaskRef)` | Different signatures |
| `executeWorkflowWithReturnStrategy` | `execute_workflow_with_return_strategy(...)` | Overloaded `executeWorkflow(...)` with consistency/returnStrategy | Same functionality |
| `getWorkflow` | `get_workflow(id, include_tasks)` | `getWorkflow(id, includeTasks, retry)` | JS has retry param |
| `getWorkflowStatus` | `get_workflow_status(id, output, variables)` | `getWorkflowStatus(id, includeOutput, includeVariables)` | Same |
| `getExecution` | N/A (use `get_workflow`) | `getExecution(id, includeTasks)` | JS has convenience method |
| `pause` | `pause(id)` | `pause(id)` | Same |
| `resume` | `resume(id)` | `resume(id)` | Same |
| `restart` | `restart(id, use_latest)` | `restart(id, useLatestDefinitions)` | Same |
| `retry` | `retry(id, resume_subworkflow)` | `retry(id, resumeSubworkflowTasks)` | Same |
| `rerun` | `rerun(request, id)` | `reRun(id, request)` | Param order differs |
| `terminate` | `terminate(id, reason, trigger_failure)` | `terminate(id, reason)` | Python has extra param |
| `search` | `search(query_id, start, size, ...)` | `search(start, size, query, freeText, sort, skipCache)` | Similar |
| `skipTask` | `skip_task_from_workflow(id, ref, request)` | `skipTasksFromWorkflow(id, ref, request)` | Same |
| `updateTask` | `update_task(taskId, workflowId, output, status)` | `updateTask(taskId, workflowId, status, output)` | Param order differs |
| `updateTaskByRefName` | `update_task_by_ref_name(output, workflowId, ref, status)` | `updateTaskByRefName(ref, workflowId, status, output)` | Same functionality |
| `updateTaskSync` | `update_task_by_ref_name_sync(...)` | `updateTaskSync(...)` | Same |
| `signal` | `signal(workflowId, status, body, returnStrategy)` | `signal(workflowId, status, output, returnStrategy)` | Same |
| `signalAsync` | `signal_async(workflowId, status, body)` | `signalAsync(workflowId, status, output)` | Same |
| `getTask` | `get_task(task_id)` | `getTask(taskId)` | Same |
| `goBackToTask` | N/A | `goBackToTask(workflowId, predicate, overrides)` | JS-only convenience |
| `deleteWorkflow` | `delete_workflow(id, archive)` | `deleteWorkflow(id, archive)` | **Same** |
| `getByCorrelationIds` | `get_by_correlation_ids(name, ids, ...)` | `getByCorrelationIds(request, includeClosed, includeTasks)` | **Same** |
| `testWorkflow` | Via `WorkflowClient.test_workflow(request)` | `testWorkflow(testRequest)` | **Same** |
| `updateVariables` | Via `WorkflowClient.update_variables(id, vars)` | `updateVariables(workflowId, variables)` | **Same** |
| `updateState` | Via `WorkflowClient.update_state(id, ...)` | `updateState(workflowId, updateRequest, requestId, ...)` | **Same** |

### MetadataClient

| Method | Python | JavaScript | Notes |
|--------|--------|-----------|-------|
| `registerTaskDef` | `register_task_def(task_def)` | `registerTask(taskDef)` | Same |
| `registerTasks` | N/A | `registerTasks(taskDefs[])` | JS has batch |
| `updateTaskDef` | `update_task_def(task_def)` | `updateTask(taskDef)` | Same |
| `unregisterTaskDef` | `unregister_task_def(type)` | `unregisterTask(name)` | Same |
| `getTaskDef` | `get_task_def(type)` | `getTask(name)` | Same |
| `getAllTaskDefs` | `get_all_task_defs()` | `getAllTaskDefs()` | **Same** |
| `registerWorkflowDef` | `register_workflow_def(def, overwrite)` | `registerWorkflowDef(def, overwrite)` | Same |
| `getWorkflowDef` | `get_workflow_def(name, version)` | `getWorkflowDef(name, version, metadata)` | JS has metadata param |
| `unregisterWorkflowDef` | `unregister_workflow_def(name, version)` | `unregisterWorkflow(name, version)` | Same |
| `getAllWorkflowDefs` | `get_all_workflow_defs()` | `getAllWorkflowDefs()` | **Same** |
| `addWorkflowTag` | `add_workflow_tag(tag, name)` | `addWorkflowTag(tag, name)` | **Same** |
| `deleteWorkflowTag` | `delete_workflow_tag(tag, name)` | `deleteWorkflowTag(tag, name)` | **Same** |
| `getWorkflowTags` | `get_workflow_tags(name)` | `getWorkflowTags(name)` | **Same** |
| `setWorkflowTags` | `set_workflow_tags(tags, name)` | `setWorkflowTags(tags, name)` | **Same** |
| `addTaskTag` | `add_task_tag(tag, name)` | `addTaskTag(tag, name)` | **Same** |
| `deleteTaskTag` | `delete_task_tag(tag, name)` | `deleteTaskTag(tag, name)` | **Same** |
| `getTaskTags` | `get_task_tags(name)` | `getTaskTags(name)` | **Same** |
| `setTaskTags` | `set_task_tags(tags, name)` | `setTaskTags(tags, name)` | **Same** |
| Rate limiting | 3 rate limit methods | `setWorkflowRateLimit`, `getWorkflowRateLimit`, `removeWorkflowRateLimit` | **Same** (raw HTTP calls, not in OpenAPI spec) |

### TaskClient

| Method | Python | JavaScript | Notes |
|--------|--------|-----------|-------|
| `pollTask` | `poll_task(type, worker_id, domain)` | N/A (internal to worker) | Not needed in JS client |
| `batchPollTasks` | `batch_poll_tasks(...)` | N/A (internal to worker) | Not needed in JS client |
| `getTask` | `get_task(task_id)` | `getTask(taskId)` | Same |
| `updateTask` | `update_task(task_result)` | N/A (uses TaskResource) | Different approach |
| `updateTaskByRefName` | `update_task_by_ref_name(...)` | `updateTaskResult(...)` | Same |
| `updateTaskSync` | `update_task_sync(...)` | `updateTaskSync(...)` | **Same** |
| `search` | N/A | `search(start, size, sort, freeText, query)` | JS has search |
| `getQueueSize` | `get_queue_size_for_task(type)` | `getQueueSizeForTask(taskType)` | **Same** |
| `addTaskLog` | `add_task_log(task_id, message)` | `addTaskLog(taskId, message)` | **Same** |
| `getTaskLogs` | `get_task_logs(task_id)` | `getTaskLogs(taskId)` | **Same** |
| `getTaskPollData` | `get_task_poll_data(type)` | `getTaskPollData(taskType)` | **Same** |

### SchedulerClient

| Method | Python | JavaScript | Parity |
|--------|--------|-----------|--------|
| `saveSchedule` | Yes | Yes | Same |
| `getSchedule` | Yes | Yes | Same |
| `deleteSchedule` | Yes | Yes | Same |
| `pauseSchedule` | Yes | Yes | Same |
| `resumeSchedule` | Yes | Yes | Same |
| `getAllSchedules` | Yes | Yes | Same |
| `getNextFewSchedules` | Yes | Yes | Same |
| `search` | Yes | Yes | Same |
| `pauseAllSchedules` | Yes | Yes | Same |
| `resumeAllSchedules` | Yes | Yes | Same |
| `requeueAllExecutionRecords` | Yes | Yes | Same |
| `setSchedulerTags` | Yes | `setSchedulerTags(tags, name)` | **Same** |
| `getSchedulerTags` | Yes | `getSchedulerTags(name)` | **Same** |
| `deleteSchedulerTags` | Yes | `deleteSchedulerTags(tags, name)` | **Same** |

### SecretClient

| Method | Python | JavaScript | Notes |
|--------|--------|-----------|-------|
| `putSecret` | `put_secret(key, value)` | `putSecret(key, value)` | Same |
| `getSecret` | `get_secret(key)` | `getSecret(key)` | Same |
| `deleteSecret` | `delete_secret(key)` | `deleteSecret(key)` | Same |
| `listAllSecretNames` | `list_all_secret_names()` | `listAllSecretNames()` | Same |
| `listSecretsThatUserCanGrantAccessTo` | `list_secrets_that_user_can_grant_access_to()` | `listSecretsThatUserCanGrantAccessTo()` | Same |
| `secretExists` | `secret_exists(key)` | `secretExists(key)` | Same |
| `setSecretTags` | `set_secret_tags(tags, key)` | `setSecretTags(tags, key)` | Same |
| `getSecretTags` | `get_secret_tags(key)` | `getSecretTags(key)` | Same |
| `deleteSecretTags` | `delete_secret_tags(tags, key)` | `deleteSecretTags(tags, key)` | Same |

### SchemaClient

| Method | Python | JavaScript | Notes |
|--------|--------|-----------|-------|
| `registerSchema` | `register_schema(schema)` | `registerSchema(schemas, newVersion)` | JS takes array |
| `getSchema` | `get_schema(name, version)` | `getSchema(name, version)` | Same |
| `getSchemaByName` | N/A | `getSchemaByName(name)` | JS convenience (latest version) |
| `getAllSchemas` | `get_all_schemas()` | `getAllSchemas()` | Same |
| `deleteSchema` | `delete_schema(name, version)` | `deleteSchema(name, version)` | Same |
| `deleteSchemaByName` | `delete_schema_by_name(name)` | `deleteSchemaByName(name)` | Same |

### AuthorizationClient

| Method | Python | JavaScript | Notes |
|--------|--------|-----------|-------|
| `grantPermissions` | `grant_permissions(request)` | `grantPermissions(request)` | Same |
| `getPermissions` | `get_permissions(type, id)` | `getPermissions(type, id)` | Same |
| `removePermissions` | `remove_permissions(request)` | `removePermissions(request)` | Same |
| `upsertUser` | `upsert_user(request, id)` | `upsertUser(id, request)` | Same |
| `getUser` | `get_user(id)` | `getUser(id)` | Same |
| `listUsers` | `list_users(apps)` | `listUsers(apps)` | Same |
| `deleteUser` | `delete_user(id)` | `deleteUser(id)` | Same |
| `checkPermissions` | `check_permissions(userId, type, id)` | `checkPermissions(userId, type, id)` | Same |
| `getGrantedPermissionsForUser` | `get_granted_permissions(userId)` | `getGrantedPermissionsForUser(userId)` | Same |
| `upsertGroup` | `upsert_group(request, id)` | `upsertGroup(id, request)` | Same |
| `getGroup` | `get_group(id)` | `getGroup(id)` | Same |
| `listGroups` | `list_groups()` | `listGroups()` | Same |
| `deleteGroup` | `delete_group(id)` | `deleteGroup(id)` | Same |
| `addUserToGroup` | `add_user_to_group(groupId, userId)` | `addUserToGroup(groupId, userId)` | Same |
| `addUsersToGroup` | `add_users_to_group(groupId, userIds)` | `addUsersToGroup(groupId, userIds)` | Same |
| `getUsersInGroup` | `get_users_in_group(id)` | `getUsersInGroup(id)` | Same |
| `removeUserFromGroup` | `remove_user_from_group(groupId, userId)` | `removeUserFromGroup(groupId, userId)` | Same |
| `removeUsersFromGroup` | `remove_users_from_group(groupId, userIds)` | `removeUsersFromGroup(groupId, userIds)` | Same |
| `getGrantedPermissionsForGroup` | `get_granted_permissions_for_group(groupId)` | `getGrantedPermissionsForGroup(groupId)` | Same |

### IntegrationClient

| Method | Python | JavaScript | Notes |
|--------|--------|-----------|-------|
| `saveIntegrationProvider` | `save_integration_provider(name, integration)` | `saveIntegrationProvider(name, integration)` | Same |
| `getIntegrationProvider` | `get_integration_provider(name)` | `getIntegrationProvider(name)` | Same |
| `getIntegrationProviders` | `get_integration_providers()` | `getIntegrationProviders()` | Same |
| `deleteIntegrationProvider` | `delete_integration_provider(name)` | `deleteIntegrationProvider(name)` | Same |
| `saveIntegrationApi` | `save_integration_api(provider, name, api)` | `saveIntegrationApi(provider, name, api)` | Same |
| `getIntegrationApi` | `get_integration_api(provider, name)` | `getIntegrationApi(provider, name)` | Same |
| `getIntegrationApis` | `get_integration_apis(provider)` | `getIntegrationApis(provider)` | Same |
| `deleteIntegrationApi` | `delete_integration_api(provider, name)` | `deleteIntegrationApi(provider, name)` | Same |
| `getIntegrations` | `get_all_integrations(category, active)` | `getIntegrations(category, activeOnly)` | Same |
| `getIntegrationProviderDefs` | `get_integration_provider_defs()` | `getIntegrationProviderDefs()` | Same |
| `getProvidersAndIntegrations` | `get_providers_and_integrations(type, active)` | `getProvidersAndIntegrations(type, activeOnly)` | Same |
| `getIntegrationAvailableApis` | `get_integration_available_apis(provider)` | `getIntegrationAvailableApis(provider)` | Same |
| `associatePromptWithIntegration` | `associate_prompt_with_integration(...)` | `associatePromptWithIntegration(...)` | Same |
| `getPromptsWithIntegration` | `get_prompts_with_integration(...)` | `getPromptsWithIntegration(...)` | Same |
| Integration tags | 3 methods | `setIntegrationTags`, `getIntegrationTags`, `deleteIntegrationTags` | Same |
| Provider tags | 3 methods | `setProviderTags`, `getProviderTags`, `deleteProviderTags` | Same |

### PromptClient

| Method | Python | JavaScript | Notes |
|--------|--------|-----------|-------|
| `savePrompt` | `save_message_template(name, desc, template, models)` | `savePrompt(name, desc, template, models)` | Same |
| `updatePrompt` | N/A | `updatePrompt(name, desc, template, models)` | JS has explicit update |
| `getPrompt` | `get_message_template(name)` | `getPrompt(name)` | Same |
| `getPrompts` | `get_message_templates()` | `getPrompts()` | Same |
| `deletePrompt` | `delete_message_template(name)` | `deletePrompt(name)` | Same |
| `testPrompt` | `test_message_template(request)` | `testPrompt(testRequest)` | Same |
| `getPromptTags` | `get_tags_for_prompt_template(name)` | `getPromptTags(name)` | Same |
| `setPromptTags` | `put_tag_for_prompt_template(name, tags)` | `setPromptTags(name, tags)` | Same |
| `deletePromptTags` | `delete_tag_for_prompt_template(name, tags)` | `deletePromptTags(name, tags)` | Same |

### ServiceRegistryClient

Full parity - both SDKs have essentially identical APIs for service registry, circuit breaker, method management, and proto management.

---

## 4. Worker System Comparison

This is the most critical comparison area. The JavaScript SDK was explicitly designed to match the Python SDK's worker architecture.

### Worker Registration

| Feature | Python | JavaScript | Parity |
|---------|--------|-----------|--------|
| Decorator/annotation | `@worker_task(task_definition_name='...')` | `@worker({ taskDefName: '...' })` | Same pattern |
| Global registry | `WorkerProcess.registered_workers` | `WorkerRegistry` (Map-based singleton) | Same pattern |
| Auto-discovery | `scan_for_annotated_workers=True` | `scanForDecorated: true` | Same |
| Module imports | `import_modules=['my_app.workers']` | `importModules: ['./workers']` | Same |
| Manual workers | `workers=[Worker(...)]` array | `workers: [{ taskDefName, execute }]` array | Same |

### Worker Configuration Properties

| Property | Python | JavaScript | Default (Both) | Parity |
|----------|--------|-----------|-----------------|--------|
| `concurrency`/`thread_count` | `thread_count` | `concurrency` | 1 | Same (different name) |
| `pollInterval` | `poll_interval_millis` | `pollInterval` | 100ms | Same |
| `domain` | `domain` | `domain` | None | Same |
| `workerId` | `worker_id` | `workerId` | Auto | Same |
| `registerTaskDef` | `register_task_def` | `registerTaskDef` | false | Same |
| `pollTimeout` | `poll_timeout` | `pollTimeout` | 100ms | Same |
| `overwriteTaskDef` | `overwrite_task_def` | `overwriteTaskDef` | true | Same |
| `strictSchema` | `strict_schema` | `strictSchema` | false | Same |
| `paused` | `paused` | Via env var `CONDUCTOR_WORKER_<NAME>_PAUSED` | false | Same (env-only) |
| `taskDef` template | `task_def` parameter | `taskDef` parameter | None | Same |

### Environment Variable Configuration

| Format | Python | JavaScript | Parity |
|--------|--------|-----------|--------|
| Worker-specific (UPPER) | `CONDUCTOR_WORKER_<NAME>_<PROP>` | `CONDUCTOR_WORKER_<NAME>_<PROP>` | Same |
| Worker-specific (dotted) | `conductor.worker.<name>.<prop>` | `conductor.worker.<name>.<prop>` | Same |
| Global (UPPER) | `CONDUCTOR_WORKER_ALL_<PROP>` | `CONDUCTOR_WORKER_ALL_<PROP>` | Same |
| Global (dotted) | `conductor.worker.all.<prop>` | `conductor.worker.all.<prop>` | Same |
| Old format | `conductor_worker_<prop>` | N/A | Python-only backward compat |

### TaskHandler / Worker Lifecycle

| Feature | Python | JavaScript | Parity |
|---------|--------|-----------|--------|
| Orchestrator class | `TaskHandler` | `TaskHandler` | Same name |
| Start workers | `start_processes()` | `startWorkers()` | Same |
| Stop workers | `stop_processes()` | `stopWorkers()` | Same |
| Join (wait for) | `join_processes()` | N/A | **MISSING in JS** |
| Context manager | `with TaskHandler(...) as handler:` | `Symbol.asyncDispose` support | Same concept |
| Static factory | N/A | `TaskHandler.create(config)` for async imports | JS-only |
| Worker count | N/A | `workerCount`, `runningWorkerCount` | JS-only accessors |

### Polling & Execution Loop

| Feature | Python | JavaScript | Parity |
|---------|--------|-----------|--------|
| Batch polling | Dynamic: `thread_count - running_tasks` | Fixed: `concurrency - tasksInProcess` | Similar |
| Adaptive backoff | Exponential: 1ms→2ms→4ms→...→poll_interval | Adaptive: exponential backoff on empty polls | **Same** |
| Auth failure backoff | `2^failures` seconds, capped at 60s | Exponential backoff on auth failures | **Same** |
| Task update retries | 4 attempts, 10s/20s/30s backoff | 3 retries (`MAX_RETRIES`), 10s/20s/30s | **Nearly identical** |
| Capacity management | Semaphore (async) / ThreadPool (sync) | `tasksInProcess` counter | Similar |
| Cleanup | `cleanup_completed_tasks()` per iteration | `performWork` decrements counter | Similar |
| Run-once pattern | Explicit `run_once()` method | While loop in `Poller.poll()` | Similar |

### Event System

| Feature | Python | JavaScript | Parity |
|---------|--------|-----------|--------|
| Event dispatcher | `SyncEventDispatcher` | `EventDispatcher` | Same |
| Listener interface | `TaskRunnerEventsListener` (Protocol) | `TaskRunnerEventsListener` (interface) | Same |
| PollStarted | Yes | Yes | Same |
| PollCompleted | Yes | Yes | Same |
| PollFailure | Yes | Yes | Same |
| TaskExecutionStarted | Yes | Yes | Same |
| TaskExecutionCompleted | Yes (with `output_size_bytes`) | Yes (with `outputSizeBytes`) | Same |
| TaskExecutionFailure | Yes | Yes | Same |
| TaskUpdateFailure | Yes | Yes | Same |
| Total events | **7** | **7** | Same |
| Error isolation | `try/except` per listener | `try/catch` per listener | Same |
| Promise.allSettled | N/A (sync in Python) | Yes | JS publishes async |
| Multiple listeners | Yes | Yes | Same |
| MetricsCollector listener | Built-in Prometheus | `MetricsCollector` with `toPrometheusText()` | **Same** |

### NonRetryableException

| Feature | Python | JavaScript | Parity |
|---------|--------|-----------|--------|
| Exception class | `NonRetryableException` | `NonRetryableException` | Same |
| Behavior | Sets `FAILED_WITH_TERMINAL_ERROR` | Sets `FAILED_WITH_TERMINAL_ERROR` | Same |
| Caught before regular | Yes | Yes (`instanceof` check) | Same |

### Task Context

| Feature | Python | JavaScript |
|---------|--------|-----------|
| Task context | `TaskContext` via thread-local/async-local | `TaskContext` via `AsyncLocalStorage` |
| `get_task_context()` | Yes, provides task_id, poll_count, etc. | `getTaskContext()` — same fields |
| `add_log()` from context | Yes | `addLog()` on `TaskContext` |
| `set_callback_after()` | Yes | `setCallbackAfter()` on `TaskContext` |
| `TaskInProgress` return type | Yes (extends lease) | `isTaskInProgress()` type guard |

### JSON Schema Generation

| Feature | Python | JavaScript |
|---------|--------|-----------|
| Schema generation | Yes (draft-07 from Python type hints) | `jsonSchema()` helper (draft-07 from field descriptors) |
| Schema registration | Yes (`SchemaClient`) | `SchemaClient` + `inputSchema`/`outputSchema` on `@worker` |
| Supports dataclasses | Yes | N/A (uses declarative field descriptors) |
| Supports Optional[T] | Yes | Via `required: false` on fields |
| Supports List[T], Dict[str, T] | Yes | Via `type: "array"` / `type: "object"` with nested properties |
| `strict_schema` flag | Yes | Yes |

### Metrics / Prometheus

| Feature | Python | JavaScript |
|---------|--------|-----------|
| Prometheus metrics | Built-in `MetricsCollector` (19 metrics) | `MetricsCollector` (19 metrics) with `toPrometheusText()` |
| HTTP metrics endpoint | Yes (`/metrics` and `/health`) | `MetricsServer` (Node.js `http`) — `/metrics` and `/health` |
| File-based metrics | Yes (`.prom` files) | Yes (`filePath` config option) |
| Multiprocess-safe | Yes (SQLite coordination) | N/A (single-process Node.js) |
| API request metrics | Yes (`http_api_client_request`) | Yes (`recordApiRequestTime()`) |
| Quantile calculation | Yes (p50-p99, sliding window) | Yes (p50/p75/p90/p95/p99, configurable window) |
| Task metrics | Yes (poll time, execute time, result size) | Yes (same + queue full, ack error, paused, restart, etc.) |

---

## 5. Workflow Builder/DSL Comparison

### Python: ConductorWorkflow (Rich DSL)

```python
workflow = ConductorWorkflow(executor=executor, name='order_flow')
workflow >> validate_order >> charge_payment >> send_confirmation
workflow.register(overwrite=True)
run = workflow.execute(workflow_input={'order_id': '123'})
```

Features:
- `>>` operator for task chaining
- Chainable configuration methods
- Direct execution via `__call__`
- `to_workflow_def()` conversion
- Input/output parameter helpers

### JavaScript: ConductorWorkflow (Fluent DSL)

```typescript
const wf = new ConductorWorkflow(executor, "order_flow")
  .add(simpleTask("validate_ref", "validate_order", {}))
  .add(simpleTask("charge_ref", "charge_payment", {}))
  .add(simpleTask("confirm_ref", "send_confirmation", {}))
  .timeoutSeconds(3600)
  .outputParameters({ orderId: "${workflow.input.orderId}" });

await wf.register(true);
const run = await wf.execute({ orderId: "123" });
```

Features:
- `.add()` method chaining (JS can't overload `>>`)
- `.fork(branches)` for parallel branches with auto-join
- Chainable configuration methods (description, timeout, ownerEmail, failureWorkflow, restartable, etc.)
- `.enableStatusListener(sink)` / `.disableStatusListener()`
- `.outputParameter(key, value)` for individual output params
- `.workflowInput(input)` alias for inputTemplate
- `.toWorkflowDef()` conversion
- `.register()`, `.execute()`, `.startWorkflow()` execution helpers with idempotency support
- `.input(path)` / `.output(path)` reference helpers
- Factory functions for each task type: `simpleTask`, `httpTask`, `switchTask`, `forkJoinTask`, etc.
- Plus simple `workflow()` function for quick definitions

### ConductorWorkflow Method Parity

| Method | Python | JavaScript | Notes |
|--------|--------|-----------|-------|
| Constructor | `ConductorWorkflow(executor, name, version, description)` | `new ConductorWorkflow(executor, name, version?, description?)` | Same |
| Add tasks | `workflow >> task` | `wf.add(task)` | JS uses method (no operator overloading) |
| Fork/Join | `workflow >> [[branch1], [branch2]]` | `wf.fork([branch1, branch2])` | Same behavior, different syntax |
| Register | `register(overwrite)` | `register(overwrite)` | Same |
| Execute | `execute(workflow_input, wait_until, wait_for, request_id, idempotency_key, idempotency_strategy, task_to_domain)` | `execute(input, waitUntilTaskRef, requestId, idempotencyKey, idempotencyStrategy, taskToDomain)` | Same |
| Start | `start_workflow_with_input(input, correlation_id, task_to_domain, priority, idempotency_key, idempotency_strategy)` | `startWorkflow(input, correlationId, priority, idempotencyKey, idempotencyStrategy, taskToDomain)` | Same |
| Callable | `workflow(**kwargs)` | N/A | Python-only (`__call__`) |
| To def | `to_workflow_def()` | `toWorkflowDef()` | Same |
| Input ref | `workflow.input(path)` | `wf.input(path)` | Same |
| Output ref | `workflow.output(path)` | `wf.output(path)` | Same |
| Output param (single) | `output_parameter(key, value)` | `outputParameter(key, value)` | Same |
| Status listener | `enable_status_listener(sink)` / `disable_status_listener()` | `enableStatusListener(sink)` / `disableStatusListener()` | Same |
| Workflow input | `workflow_input(input)` | `workflowInput(input)` | Same |
| Inline sub-workflow | `InlineSubWorkflowTask` | `wf.toSubWorkflowTask(refName)` | Same — embeds workflow def inline |

---

## 6. Task Type Builders

| Task Type | Python | JavaScript | Notes |
|-----------|--------|-----------|-------|
| Simple | `SimpleTask` | `simpleTask()` | Same |
| HTTP | `HttpTask` | `httpTask()` | Same |
| HTTP Poll | `HttpPollTask` | `httpPollTask()` | Same |
| Inline/JS | `InlineTask` / `JavascriptTask` | `inlineTask()` | Same |
| Switch | `SwitchTask` | `switchTask()` | Same |
| ForkJoin | `ForkJoinTask` | `forkJoinTask()` | Same |
| DynamicFork | `DynamicForkTask` | `dynamicForkTask()` | Same |
| DoWhile | `DoWhileTask` / `LoopTask` | `doWhileTask()` | Same |
| SubWorkflow | `SubWorkflowTask` | `subWorkflowTask()` | Same |
| Event | `EventTask` | `eventTask()` | Same |
| Wait | `WaitTask` | `waitTaskDuration()` / `waitTaskUntil()` | Same |
| Wait for Webhook | `WaitForWebhookTask` | `waitForWebhookTask()` | Same |
| Terminate | `TerminateTask` | `terminateTask()` | Same |
| SetVariable | `SetVariableTask` | `setVariableTask()` | Same |
| JsonJQ | `JsonJQTask` | `jsonJqTask()` | Same |
| KafkaPublish | `KafkaPublishTask` | `kafkaPublishTask()` | Same |
| Join | `JoinTask` | `joinTask()` | Same |
| GetDocument | `GetDocumentTask` | `getDocumentTask()` | Same |
| HumanTask | `HumanTask` | `humanTask()` | Same |
| StartWorkflow | `StartWorkflowTask` | `startWorkflowTask()` | Same |
| Dynamic | `DynamicTask` | `dynamicTask()` | Same |
| LlmChatComplete | `LlmChatComplete` | `llmChatCompleteTask()` | Same |
| LlmTextComplete | `LlmTextComplete` | `llmTextCompleteTask()` | Same |
| LlmGenerateEmbeddings | `LlmGenerateEmbeddings` | `llmGenerateEmbeddingsTask()` | Same |
| LlmIndexText | `LlmIndexText` | `llmIndexTextTask()` | Same |
| LlmIndexDocument | `LlmIndexDocument` | `llmIndexDocumentTask()` | Same |
| LlmSearchIndex | `LlmSearchIndex` | `llmSearchIndexTask()` | Same |
| LlmSearchEmbeddings | `LlmSearchEmbeddings` | `llmSearchEmbeddingsTask()` | Same |
| LlmStoreEmbeddings | `LlmStoreEmbeddings` | `llmStoreEmbeddingsTask()` | Same |
| LlmQueryEmbeddings | `LlmGetEmbeddings` | `llmQueryEmbeddingsTask()` | Same |
| GenerateImage | `GenerateImage` | `generateImageTask()` | Same |
| GenerateAudio | `GenerateAudio` | `generateAudioTask()` | Same |
| CallMcpTool | `CallMcpTool` | `callMcpToolTask()` | Same |
| ListMcpTools | `ListMcpTools` | `listMcpToolsTask()` | Same |

---

## 7. Feature Gap Summary

### Comprehensive Gap Table

#### Task Type Builders

| # | Feature | Python | JavaScript | Status |
|---|---------|--------|-----------|--------|
| 1 | Simple task | `SimpleTask` | `simpleTask()` | Full |
| 2 | HTTP task | `HttpTask` | `httpTask()` | Full |
| 3 | HTTP Poll task | `HttpPollTask` | `httpPollTask()` | Full |
| 4 | Inline task | `InlineTask` / `JavascriptTask` | `inlineTask()` | Full |
| 5 | Switch task | `SwitchTask` | `switchTask()` | Full |
| 6 | Fork/Join | `ForkJoinTask` | `forkJoinTask()` | Full |
| 7 | Dynamic Fork | `DynamicForkTask` | `dynamicForkTask()` | Full |
| 8 | Do-While | `DoWhileTask` / `LoopTask` | `doWhileTask()` | Full |
| 9 | Sub-Workflow | `SubWorkflowTask` | `subWorkflowTask()` | Full |
| 10 | Start Workflow | `StartWorkflowTask` | `startWorkflowTask()` | Full |
| 11 | Dynamic task | `DynamicTask` | `dynamicTask()` | Full |
| 12 | Event task | `EventTask` | `eventTask()` | Full |
| 13 | Wait task | `WaitTask` | `waitTaskDuration()` / `waitTaskUntil()` | Full |
| 14 | Wait for Webhook | `WaitForWebhookTask` | `waitForWebhookTask()` | Full |
| 15 | Human task | `HumanTask` | `humanTask()` | Full (`__humanTaskDefinition` structure) |
| 16 | Terminate | `TerminateTask` | `terminateTask()` | Full |
| 17 | Set Variable | `SetVariableTask` | `setVariableTask()` | Full |
| 18 | JSON JQ | `JsonJQTask` | `jsonJqTask()` | Full |
| 19 | Kafka Publish | `KafkaPublishTask` | `kafkaPublishTask()` | Full |
| 20 | Join | `JoinTask` | `joinTask()` | Full |
| 21 | Get Document | `GetDocumentTask` | `getDocumentTask()` | Full |
| 22 | LLM Chat Complete | `LlmChatComplete` (26 params) | `llmChatCompleteTask()` (20 params) | Full |
| 23 | LLM Text Complete | `LlmTextComplete` (14 params) | `llmTextCompleteTask()` (12 params) | Full |
| 24 | LLM Generate Embeddings | `LlmGenerateEmbeddings` (5 params) | `llmGenerateEmbeddingsTask()` (5 params) | Full |
| 25 | LLM Index Text | `LlmIndexText` (12 params) | `llmIndexTextTask()` (12 params) | Full |
| 26 | LLM Index Document | `LlmIndexDocument` (12 params) | `llmIndexDocumentTask()` (12 params) | Full |
| 27 | LLM Search Index | `LlmSearchIndex` (9 params) | `llmSearchIndexTask()` (8 params) | Full |
| 28 | LLM Store Embeddings | `LlmStoreEmbeddings` | `llmStoreEmbeddingsTask()` | Full |
| 29 | LLM Search Embeddings | `LlmSearchEmbeddings` | `llmSearchEmbeddingsTask()` | Full |
| 30 | LLM Query Embeddings | `LlmGetEmbeddings` | `llmQueryEmbeddingsTask()` | Full |
| 31 | Generate Image | `GenerateImage` | `generateImageTask()` | Full |
| 32 | Generate Audio | `GenerateAudio` | `generateAudioTask()` | Full |
| 33 | Call MCP Tool | `CallMcpTool` | `callMcpToolTask()` | Full |
| 34 | List MCP Tools | `ListMcpTools` | `listMcpToolsTask()` | Full |

**Task builder summary**: 34/34 task types have full builders.

#### Workflow DSL

| # | Feature | Python | JavaScript | Status |
|---|---------|--------|-----------|--------|
| 1 | Fluent builder class | `ConductorWorkflow` | `ConductorWorkflow` | Full |
| 2 | Task chaining | `>>` operator | `.add()` method | Full (different syntax) |
| 3 | Fork/Join via list | `>> [[a], [b]]` | `.fork([[a], [b]])` | Full |
| 4 | Configuration methods | 12 methods | 12 methods | Full |
| 5 | Register & execute | `register()`, `execute()` | `register()`, `execute()` | Full |
| 6 | Start with input | `start_workflow_with_input()` | `startWorkflow()` | Full |
| 7 | Idempotency support | Yes | Yes | Full |
| 8 | Status listener | `enable/disable_status_listener()` | `enableStatusListener()` / `disableStatusListener()` | Full |
| 9 | Output param (single) | `output_parameter(key, val)` | `outputParameter(key, val)` | Full |
| 10 | `__call__` (callable) | `workflow(**kwargs)` | `wf.execute(input)` | Same functionality — Python syntax sugar only |
| 11 | `InlineSubWorkflowTask` | Embeds workflow def as sub-workflow | `wf.toSubWorkflowTask(refName)` | Full |
| 12 | Prompt variables helper | `prompt_variable()` / `prompt_variables()` on tasks | `withPromptVariable()` / `withPromptVariables()` utilities | Full (functional style) |

#### Worker System

| # | Feature | Python | JavaScript | Status |
|---|---------|--------|-----------|--------|
| 1 | `@worker` decorator | `@worker_task()` | `@worker()` | Full |
| 2 | Global registry | `WorkerProcess.registered_workers` | `WorkerRegistry` | Full |
| 3 | Auto-discovery | `scan_for_annotated_workers` | `scanForDecorated` | Full |
| 4 | Module imports | `import_modules=[...]` | `importModules: [...]` | Full |
| 5 | TaskContext | `TaskContext` (thread-local) | `TaskContext` (`AsyncLocalStorage`) | Full |
| 6 | Adaptive backoff | Exponential 1ms→poll_interval | Exponential backoff on empty polls | Full |
| 7 | Auth failure backoff | 2^failures seconds, cap 60s | Exponential backoff on auth failures | Full |
| 8 | NonRetryableException | `NonRetryableException` | `NonRetryableException` | Full |
| 9 | Event system (7 events) | `SyncEventDispatcher` | `EventDispatcher` | Full |
| 10 | `join_processes()` | Yes (wait for worker processes) | N/A | **Gap** — N/A in single-process Node.js |
| 11 | Process isolation | One OS process per worker | Single Node.js process | **By design** — Node.js async model |

#### Metrics / Observability

| # | Feature | Python | JavaScript | Status |
|---|---------|--------|-----------|--------|
| 1 | MetricsCollector | Yes (19 metrics) | Yes (19 metrics) | Full |
| 2 | HTTP `/metrics` endpoint | Yes | `MetricsServer` | Full |
| 3 | HTTP `/health` endpoint | Yes | `MetricsServer` | Full |
| 4 | Prometheus text format | Yes | `toPrometheusText()` | Full |
| 5 | File-based metrics | Yes (`.prom` files) | Yes (`filePath` config option) | Full |
| 6 | API request metrics | `http_api_client_request` | `recordApiRequestTime()` | Full |
| 7 | Queue full metric | `task_execution_queue_full` | `recordTaskExecutionQueueFull()` | Full |
| 8 | Uncaught exception metric | `thread_uncaught_exceptions` | `recordUncaughtException()` | Full |
| 9 | Workflow start error | `workflow_start_error` | `recordWorkflowStartError()` | Full |
| 10 | External payload used | `external_payload_used` | `recordExternalPayloadUsed()` | Full |
| 11 | Worker restart metric | `worker_restart` | `recordWorkerRestart()` | Full |
| 12 | Quantile calculation (p50-p99) | Yes (sliding window 1000) | Yes (sliding window, configurable) | Full |
| 13 | `prometheus_client` integration | Yes (native prom-client) | Optional `prom-client` integration via `usePromClient: true` + `PrometheusRegistry` | Full (optional peer dep) |
| 14 | Auto-start via `httpPort` config | Yes | Yes | Full |

#### JSON Schema Generation

| # | Feature | Python | JavaScript | Status |
|---|---------|--------|-----------|--------|
| 1 | Schema from type hints | Auto-inspection of function signatures | `@schemaField()` decorator + `generateSchemaFromClass()` with `reflect-metadata` | Full (decorator-based) |
| 2 | Declarative schema helper | N/A | `jsonSchema()` from field descriptors | JS-only approach (alternative) |
| 3 | Schema registration with task def | Auto via `TaskRunner` | Via `inputSchema`/`outputSchema` on `@worker` | Full (different mechanism) |
| 4 | Draft-07 compliance | Yes | Yes | Full |
| 5 | Nested object support | Yes (dataclasses) | Yes (nested `properties`) | Full |
| 6 | Array support | Yes (`List[T]`) | Yes (`type: "array"`, `items`) | Full |
| 7 | `strict_schema` flag | Yes (`additionalProperties: false`) | Config exists | Full |

#### AI Module

| # | Feature | Python | JavaScript | Status |
|---|---------|--------|-----------|--------|
| 1 | `LLMProvider` enum | 11 providers | `LLMProvider` enum (11 providers) | Full |
| 2 | `VectorDB` enum | 4 databases | `VectorDB` enum (4 databases) | Full |
| 3 | `IntegrationConfig` classes | `WeaviateConfig`, `OpenAIConfig`, `PineconeConfig`, etc. | `OpenAIConfig`, `AzureOpenAIConfig`, `WeaviateConfig`, `PineconeConfig` | Full |
| 4 | `AIOrchestrator` class | Manages AI integrations, prompts, vector stores | N/A | **Gap** — deferred |

### Remaining Gaps Summary

| # | Gap | Impact | Category | Notes |
|---|-----|--------|----------|-------|
| 1 | **`AIOrchestrator` class** | Medium | AI module | High-level AI integration management — deferred |
| 2 | **Process isolation** | Low | Worker system | Node.js uses single-process async model by design |

### Features JavaScript Has That Python Doesn't

| # | Feature | Notes |
|---|---------|-------|
| 1 | **Backward compatibility layer** | Full legacy resource API with deprecation warnings |
| 2 | **`goBackToTask`/`goBackToFirstTaskMatchingType`** | Convenience methods for re-running from specific tasks |
| 3 | **Test generators** | `generateSimpleTask()` etc. for test data |
| 4 | **Dual CJS/ESM** output | Python doesn't need this |
| 5 | **`Symbol.asyncDispose`** support | Modern JS cleanup pattern |

---

## 8. Configuration Environment Variable Comparison

### Server Configuration

| Variable | Python | JavaScript |
|----------|--------|-----------|
| Server URL | `CONDUCTOR_SERVER_URL` | `CONDUCTOR_SERVER_URL` |
| Auth key | `CONDUCTOR_AUTH_KEY` | `CONDUCTOR_AUTH_KEY` |
| Auth secret | `CONDUCTOR_AUTH_SECRET` | `CONDUCTOR_AUTH_SECRET` |
| UI URL | `CONDUCTOR_UI_SERVER_URL` | N/A |
| HTTP/2 | `CONDUCTOR_HTTP2_ENABLED` | N/A (auto via undici) |
| Max connections | N/A | `CONDUCTOR_MAX_HTTP2_CONNECTIONS` |
| Token refresh | Via `auth_token_ttl_min` | `CONDUCTOR_REFRESH_TOKEN_INTERVAL` |

### Worker Configuration

Both SDKs support identical environment variable formats for worker configuration (see Section 4 above).

---

## 9. Error Handling Comparison

| Aspect | Python | JavaScript |
|--------|--------|-----------|
| SDK error class | `APIError`, `ApiException` | `ConductorSdkError` |
| Error wrapping | `ApiExceptionHandler.raise_exception()` | `handleSdkError(error, message, strategy)` |
| Log vs throw | Always throws | Configurable: `"throw"` or `"log"` |
| Inner error chain | Via `ApiException` | Via `ConductorSdkError._trace` |
| Worker NonRetryable | `NonRetryableException` | `NonRetryableException` |

---

## 10. Testing Comparison

| Aspect | Python | JavaScript |
|--------|--------|-----------|
| Unit test framework | `pytest` | `jest` (v30) |
| Async worker tests | 17 tests (mocked HTTP) | Unit tests with mocks |
| Integration tests | End-to-end examples | 10+ integration test files |
| Backend version tests | N/A | `ORKES_BACKEND_VERSION=4\|5` |
| Coverage | `.coverage` file present | Jest coverage config |

---

## 11. Closeness Score

### Overall Parity: ~98%

| Category | Score | Notes |
|----------|-------|-------|
| **Client modules** | **100%** | Full parity including rate limit CRUD |
| **Workflow execution** | **98%** | Full method parity |
| **Worker system** | **98%** | TaskContext, adaptive backoff, auth backoff, events, schema |
| **Task type builders** | **100%** | 34/34 builders including LLM, MCP, HTTP Poll, Webhook, GetDocument |
| **Workflow DSL** | **95%** | Full `ConductorWorkflow` with `toSubWorkflowTask()`. Missing only `__call__` (language limitation) |
| **Metrics/Observability** | **98%** | 19 metrics, quantiles (p50-p99), HTTP + file export, optional prom-client integration |
| **AI module** | **95%** | All LLM task builders + `LLMProvider`/`VectorDB` enums + `IntegrationConfig` types. Missing only `AIOrchestrator` |
| **JSON schema** | **95%** | `jsonSchema()` declarative helper + `@schemaField()` decorator with `reflect-metadata` type inference |
| **Scheduling** | **100%** | Full parity including tags |
| **Authorization** | **95%** | Full parity (permissions, users, groups) |
| **Secrets** | **100%** | Full parity |
| **Schemas** | **100%** | Full parity |
| **Prompts** | **100%** | Full parity |

### What the JavaScript SDK Does Well

1. **Full client module parity**: All Python client classes are now implemented
2. **`OrkesClients` factory**: Same pattern as Python for client creation
3. **`ConductorWorkflow` DSL**: Fluent builder with chaining, config, fork/join, `toSubWorkflowTask()`, register, execute
4. **All 34 task type builders**: Including 13 LLM/AI, 2 MCP, Human, Dynamic, StartWorkflow, HTTP Poll, Webhook, GetDocument
5. **Worker event system**: 7 events matching Python exactly
6. **`@worker` decorator**: Clean TypeScript pattern matching `@worker_task`
7. **Worker configuration hierarchy**: Identical env var format and precedence
8. **`TaskHandler` orchestrator**: Same architecture as Python
9. **TaskContext**: Full async-local context with `addLog()`, `setCallbackAfter()`
10. **Prometheus metrics**: 19 metrics with quantiles (p50-p99), `MetricsServer` (HTTP + file export), optional `prom-client` integration
11. **JSON schema generation**: `jsonSchema()` declarative helper + `@schemaField()` decorator with `reflect-metadata` runtime type inference + `inputType`/`outputType` on `@worker`
12. **AI types**: `LLMProvider`, `VectorDB` enums + typed `IntegrationConfig` + `withPromptVariable()` helpers
13. **OpenAPI-generated types**: Strong TypeScript types from spec
14. **HTTP/2 with retry**: Good resilience layer
15. **Backward compatibility**: Thoughtful migration path from v2

### Remaining Gaps

| Priority | Gap | Notes |
|----------|-----|-------|
| Medium | `AIOrchestrator` class | High-level AI integration management — deferred |
