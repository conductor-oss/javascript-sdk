# Worker Architecture Comparison: Python SDK vs JavaScript SDK

## 1. Overview

Both SDKs implement the same conceptual worker architecture: **decorator-based registration, auto-discovery, orchestrated lifecycle, poll-execute-update loop, event-driven observability**. The Python SDK is the reference ("golden") implementation with significantly more depth in process isolation, async support, metrics, and configuration.

---

## 2. Annotations / Decorators

### Python: `@worker_task`

```python
@worker_task(
    task_definition_name='process_order',
    poll_interval_millis=1000,
    thread_count=5,
    domain='production',
    worker_id='worker-1',
    register_task_def=True,
    poll_timeout=100,
    task_def=TaskDef(retry_count=3, timeout_seconds=300),
    overwrite_task_def=True,
    strict_schema=True,
    lease_extend_enabled=False
)
def process_order(order_id: str, amount: float) -> dict:
    return {'processed': True}
```

**Implementation Details:**
- Defined in `worker_task.py`, calls `register_decorated_fn()` which stores in module-level `_decorated_functions` dict
- Key is `(task_definition_name, domain)` tuple - allows same task name with different domains
- Dual-mode: decorated function can be called normally OR with `task_ref_name=` kwarg to generate a `SimpleTask` for workflow building
- Legacy `WorkerTask` (CamelCase) decorator also available for backward compatibility
- Introspects function signature to auto-extract parameters from `task.input_data`
- Auto-converts dataclass parameters from dicts

### JavaScript: `@worker`

```typescript
@worker({
  taskDefName: 'process_order',
  pollInterval: 1000,
  concurrency: 5,
  domain: 'production',
  workerId: 'worker-1',
  registerTaskDef: true,
  pollTimeout: 100,
  taskDef: { retryCount: 3, timeoutSeconds: 300 },
  overwriteTaskDef: true,
  strictSchema: true,
})
async function processOrder(task: Task): Promise<TaskResult> {
  return { status: 'COMPLETED', outputData: { processed: true } };
}
```

**Implementation Details:**
- Defined in `worker/decorators/worker.ts`, calls `registerWorker()` which stores in `WorkerRegistry` singleton (Map-based)
- Key is `${taskDefName}:${domain || ""}` string
- Single-mode: no dual-mode support (no workflow task generation from decorator)
- Function always receives raw `Task` object - no auto-extraction of typed parameters from `inputData`
- No dataclass/interface conversion support

### Comparison

| Feature | Python | JavaScript | Gap |
|---------|--------|-----------|-----|
| Registry storage | Module-level dict `{(name,domain): metadata}` | Singleton Map `{name:domain: metadata}` | Equivalent |
| Duplicate detection | Overwrites silently | Logs warning, overwrites | JS slightly better |
| Dual-mode (task generation) | Yes - `fn(task_ref_name='ref')` returns SimpleTask | Yes - `fn({ taskRefName: 'ref' })` returns SimpleTaskDef | Parity |
| Parameter extraction | Auto from type hints + `task.input_data` | Manual - receives raw `Task` | N/A (TypeScript erases types at runtime) |
| Dataclass/interface support | Auto-converts dicts to dataclasses | No | N/A (TypeScript limitation) |
| Legacy decorator | `WorkerTask` (CamelCase) | No | N/A |

---

## 3. Worker Discovery & Auto-Registration

### Python: `WorkerLoader` + `scan_for_annotated_workers`

```python
handler = TaskHandler(
    configuration=config,
    scan_for_annotated_workers=True,
    import_modules=['my_app.workers', 'my_app.tasks']
)
```

**Implementation:**
- `WorkerLoader` class provides multiple discovery methods:
  - `scan_packages(packages, recursive=True)` - recursive package scanning
  - `scan_module(module_name)` - single module import
  - `scan_path(path, package_prefix)` - filesystem path scanning
- Convenience functions: `scan_for_workers()`, `auto_discover_workers()`
- `print_summary()` for debugging discovery issues
- When `scan_for_annotated_workers=True`, TaskHandler calls `get_registered_workers()` to collect all decorated functions
- Module imports trigger `@worker_task` decorators, which register in `_decorated_functions`

### JavaScript: `TaskHandler` + `scanForDecorated`

```typescript
const handler = new TaskHandler({
  client,
  scanForDecorated: true,
  importModules: ['./workers/orderWorkers'],
});
// or
const handler = await TaskHandler.create({
  client,
  importModules: ['./workers/orderWorkers'],
});
```

**Implementation:**
- `TaskHandler` constructor checks `scanForDecorated !== false` (default: true)
- Calls `getRegisteredWorkers()` from `WorkerRegistry`
- `TaskHandler.create()` static async factory for `importModules` (uses dynamic `import()`)
- Module imports trigger `@worker` decorators, which register in `WorkerRegistry`
- No recursive package scanning, no filesystem scanning

### Comparison

| Feature | Python | JavaScript |
|---------|--------|-----------|
| Auto-scan decorated | Yes | Yes |
| Module imports | Yes (`import_modules`) | Yes (`importModules` via dynamic `import()`) |
| Recursive package scan | Yes (`scan_packages(recursive=True)`) | No |
| Filesystem scan | Yes (`scan_path()`) | No |
| Discovery summary | Yes (`print_summary()`) | No |
| Async module import | No (sync import) | Yes (`TaskHandler.create()`) |

---

## 4. Process Model & Isolation

### Python: One OS Process Per Worker

```
Main Process (TaskHandler)
├── Process 1: Worker "fetch_data" (AsyncTaskRunner)
├── Process 2: Worker "process_cpu" (TaskRunner)
├── Process 3: Worker "send_email" (AsyncTaskRunner)
├── Process 4: Metrics Provider
├── Process 5: Logger
└── Thread: Process Monitor
```

**Implementation:**
- Uses `multiprocessing.Process` for each worker
- On macOS: sets `os.environ["no_proxy"] = "*"` for performance
- On Windows: uses "spawn" start method
- On Linux: uses "fork" start method
- Process monitor thread checks worker health every 5 seconds
- Auto-restart with exponential backoff: `min(backoff * 2^failures, 60s)`
- Max restart attempts configurable (0 = unlimited)
- Centralized logging via `multiprocessing.Queue` → logger process
- Metrics aggregation across processes via shared SQLite `.db` files

**Benefits:** True parallelism (bypasses GIL), fault isolation, independent resource management

### JavaScript: Single Process, One Poller Per Worker

```
Node.js Process
├── TaskRunner for "fetch_data" → Poller → async callbacks
├── TaskRunner for "process_cpu" → Poller → async callbacks
└── TaskRunner for "send_email" → Poller → async callbacks
```

**Implementation:**
- All workers run in single Node.js event loop
- Each worker gets a `TaskRunner` which creates a `Poller`
- `Poller` uses `setTimeout`-based polling loop
- Concurrency managed via `tasksInProcess` counter
- No process isolation - one worker crash affects all
- No process monitoring or auto-restart

**Benefits:** Lower overhead, simpler architecture, natural for Node.js async model

### Comparison

| Feature | Python | JavaScript |
|---------|--------|-----------|
| Isolation model | OS process per worker | Single process, all workers |
| True parallelism | Yes (multiprocessing) | No (event loop) |
| Fault isolation | Yes (process boundary) | No |
| Process monitoring | Yes (daemon thread, 5s interval) | No |
| Auto-restart | Yes (exponential backoff, configurable max) | No |
| Centralized logging | Yes (logging queue + process) | No (console-based) |
| Memory overhead | Higher (process per worker) | Lower |
| Startup time | Slower (process spawn) | Faster |

---

## 5. Async Support & Auto-Detection

### Python: Automatic Sync/Async Detection

```python
# Auto-detected as sync → TaskRunner (ThreadPoolExecutor)
@worker_task(task_definition_name='cpu_task', thread_count=4)
def cpu_task(data: dict) -> dict:
    return expensive_computation(data)

# Auto-detected as async → AsyncTaskRunner (event loop)
@worker_task(task_definition_name='io_task', thread_count=50)
async def io_task(url: str) -> dict:
    async with httpx.AsyncClient() as client:
        return (await client.get(url)).json()
```

**Detection Algorithm:**
```python
is_async = inspect.iscoroutinefunction(worker.execute_function)
if is_async:
    runner = AsyncTaskRunner(worker, config, metrics_settings, event_listeners)
    process = Process(target=_run_async_worker_process, args=(runner,))
else:
    runner = TaskRunner(worker, config, metrics_settings, event_listeners)
    process = Process(target=_run_sync_worker_process, args=(runner,))
```

**TaskRunner (Sync):**
- `ThreadPoolExecutor(max_workers=thread_count)`
- Blocking HTTP via `requests` / `httpx.Client`
- Tasks submitted to thread pool: `executor.submit(execute_and_update, task)`
- Capacity: thread pool + `_running_tasks` set tracking

**AsyncTaskRunner (Async):**
- Pure `asyncio` event loop (single thread)
- Non-blocking HTTP via `httpx.AsyncClient`
- Tasks as coroutines: `asyncio.create_task(execute_and_update(task))`
- Capacity: `asyncio.Semaphore(thread_count)` for execution limiting
- Clients created **after fork** (not picklable)
- Token refresh: lazy on first API call (can't `await` in `__init__`)

### JavaScript: All Workers Are Async

```typescript
@worker({ taskDefName: 'my_task', concurrency: 5 })
async function myTask(task: Task): Promise<TaskResult> {
  return { status: 'COMPLETED', outputData: {} };
}
```

**Implementation:**
- No sync/async detection - JavaScript functions are inherently async-capable
- Single `Poller` class handles all workers
- `Poller.poll()` is an async while loop with `setTimeout`-based intervals
- Tasks dispatched via `forEach(this.performWork)` (fire-and-forget)
- Capacity: `tasksInProcess` counter (incremented on dispatch, decremented on completion)

### Comparison

| Feature | Python | JavaScript |
|---------|--------|-----------|
| Auto-detection | Yes (`def` vs `async def`) | N/A (all async) |
| Sync execution model | ThreadPoolExecutor | N/A |
| Async execution model | asyncio event loop + Semaphore | Node.js event loop + counter |
| Concurrency control | Semaphore (async) / ThreadPool (sync) | Counter-based |
| HTTP client (sync) | httpx.Client / requests | N/A |
| HTTP client (async) | httpx.AsyncClient | undici / native fetch |
| Client creation timing | After fork (pickling constraint) | During init |

---

## 6. Polling Loop

### Python: Adaptive Polling with Exponential Backoff

```python
def run_once(self):
    # 1. Cleanup completed tasks
    cleanup_completed_tasks()

    # 2. Check capacity
    current = len(running_tasks) + pending_async_count
    if current >= max_workers:
        sleep(0.001)  # 1ms
        return

    # 3. Calculate batch size
    available = max_workers - current

    # 4. ADAPTIVE BACKOFF (empty queue optimization)
    if consecutive_empty_polls > 0:
        capped = min(consecutive_empty_polls, 10)
        delay = min(0.001 * (2 ** capped), poll_interval)
        # Exponential: 1ms, 2ms, 4ms, 8ms, ..., poll_interval
        if time_since_last_poll < delay:
            sleep(delay - time_since_last_poll)
            return

    # 5. AUTH FAILURE BACKOFF
    if auth_failures > 0:
        backoff = min(2 ** auth_failures, 60)  # 2s, 4s, 8s, ..., 60s cap
        if time_since_last_failure < backoff:
            sleep(0.1)
            return []

    # 6. Batch poll
    tasks = batch_poll(available)

    # 7. Submit tasks
    if tasks:
        consecutive_empty_polls = 0
        for task in tasks:
            executor.submit(execute_and_update, task)
    else:
        consecutive_empty_polls += 1
```

### JavaScript: Adaptive Polling with Backoff

```typescript
private poll = async () => {
    while (this.isPolling) {
        try {
            // 1. PAUSED CHECK
            if (this.options.paused) { sleep(pollInterval); continue; }

            // 2. AUTH FAILURE BACKOFF
            if (authFailures > 0) {
                backoffMs = min(2^authFailures, 60) * 1000;
                if (timeSinceFailure < backoffMs) { sleep(100); continue; }
            }

            // 3. CAPACITY CHECK
            const count = Math.max(0, concurrency - tasksInProcess);
            if (count === 0) { /* log warning after 100 skips */ }
            else {
                // 4. ADAPTIVE BACKOFF
                if (adaptiveBackoff && consecutiveEmptyPolls > 0) {
                    delay = min(1ms * 2^min(emptyPolls, 10), pollInterval);
                    if (timeSinceLastPoll < delay) { sleep(delay - elapsed); continue; }
                }

                // 5. POLL + DISPATCH
                const tasks = await this.pollFunction(count);
                if (tasks.length > 0) { consecutiveEmptyPolls = 0; }
                else { consecutiveEmptyPolls++; }
                authFailures = 0; // Reset on success
                tasks?.forEach(this.performWork);
            }
        } catch (error) {
            if (isAuthError(error)) { authFailures++; lastAuthFailureAt = now; }
            else { logger.error("Error polling", error); }
        }
        await sleep(pollInterval);
    }
};
```

### Comparison

| Feature | Python | JavaScript | Gap |
|---------|--------|-----------|-----|
| **Dynamic batch size** | `max_workers - running` | `concurrency - tasksInProcess` | Same concept |
| **Adaptive backoff (empty polls)** | Exponential: 1ms → 2ms → 4ms → ... → poll_interval | Exponential: 1ms → 2ms → 4ms → ... → pollInterval | Parity |
| **Auth failure backoff** | Exponential: 2^failures seconds, capped at 60s | Exponential: 2^failures seconds, capped at 60s | Parity |
| **At-capacity behavior** | Sleeps 1ms, returns immediately | Logs warning after 100 skips | Different approach |
| **Immediate cleanup** | `cleanup_completed_tasks()` first in loop | Counter decremented in `performWork` | Both immediate |
| **Poll timeout** | 100ms server-side long poll | `batchPollingTimeout` (100ms default) | Parity |
| **Paused worker** | Checks `worker.paused`, returns empty | Checks `options.paused`, skips poll | Parity |
| **Capacity tracking** | `len(running_tasks) + pending_async` | `tasksInProcess` counter | Python more precise |

---

## 7. Task Execution Flow

### Python

```
poll → task received
  → set task context (contextvars)
  → publish TaskExecutionStarted event
  → inspect function signature
  → extract parameters from task.input_data (with type conversion)
  → call worker function(**kwargs)
  → if coroutine: submit to BackgroundEventLoop, return ASYNC_TASK_RUNNING sentinel
  → handle return type:
    → TaskResult: use as-is
    → TaskInProgress: create IN_PROGRESS result with callback_after_seconds
    → dict/other: wrap in COMPLETED TaskResult
  → serialize output (dataclass → dict, sanitize)
  → merge context modifications (logs, callback_after_seconds)
  → publish TaskExecutionCompleted event
  → update task on server (4 retries, 10s/20s/30s backoff)
  → on NonRetryableException: FAILED_WITH_TERMINAL_ERROR
  → on Exception: FAILED
  → finally: clear task context
```

### JavaScript

```
poll → task received
  → publish TaskExecutionStarted event
  → call worker.execute(task)
  → calculate output size
  → publish TaskExecutionCompleted event
  → updateTaskWithRetry(task, taskResult)
    → 3 retries, 10s/20s/30s backoff
  → on NonRetryableException: FAILED_WITH_TERMINAL_ERROR
  → on Exception: FAILED with reasonForIncompletion
```

### Comparison

| Feature | Python | JavaScript |
|---------|--------|-----------|
| Task context (thread-local) | Yes (`contextvars`) | **No** |
| Parameter extraction | Auto from signature + input_data | Manual - raw Task object |
| Type conversion | dataclass, enum, etc. | None |
| TaskInProgress support | Yes (returns IN_PROGRESS with callback) | **No** |
| Output serialization | dataclass → dict, sanitize | JSON.stringify for size only |
| Context merge (logs, callback) | Yes | **No** |
| Update retries | 4 attempts (0, 1, 2, 3) | 3 attempts (MAX_RETRIES=3) |
| Update backoff | 10s, 20s, 30s | 10s, 20s, 30s |
| TaskUpdateFailure event | Yes (retry_count=4) | Yes (includes taskResult) |
| NonRetryableException | Yes → FAILED_WITH_TERMINAL_ERROR | Yes → FAILED_WITH_TERMINAL_ERROR |

---

## 8. Event System / Interceptors

### Python: `SyncEventDispatcher` + `TaskRunnerEventsListener` Protocol

```python
from conductor.client.event.task_runner_events import (
    TaskRunnerEventsListener, TaskExecutionCompleted, TaskUpdateFailure
)

class SLAMonitor(TaskRunnerEventsListener):
    def on_task_execution_completed(self, event: TaskExecutionCompleted):
        if event.duration_ms > 5000:
            alert(f"SLA breach: {event.task_type} took {event.duration_ms}ms")

    def on_task_update_failure(self, event: TaskUpdateFailure):
        backup_db.save(event.task_result)  # Recovery for lost results

handler = TaskHandler(
    configuration=config,
    event_listeners=[SLAMonitor(), MetricsCollector(settings)]
)
```

**Implementation:**
- Events are frozen `@dataclass` objects (immutable, thread-safe)
- `SyncEventDispatcher` publishes synchronously (inline, no async overhead)
- Listener protocol uses `typing.Protocol` with `@runtime_checkable`
- All methods optional - implement only what you need
- Listener failures caught and logged (error isolation)
- Events include UTC timestamp via `datetime.now(timezone.utc)`
- Each worker process has its own EventDispatcher (no cross-process events)

### JavaScript: `EventDispatcher` + `TaskRunnerEventsListener` Interface

```typescript
const metricsListener: TaskRunnerEventsListener = {
    onTaskExecutionCompleted(event: TaskExecutionCompleted) {
        console.log(`Task ${event.taskId} completed in ${event.durationMs}ms`);
    },
    onTaskUpdateFailure(event: TaskUpdateFailure) {
        backupDb.save(event.taskResult);
    },
};

const handler = new TaskHandler({
    client,
    eventListeners: [metricsListener],
});
```

**Implementation:**
- Events are plain objects (interfaces, not frozen)
- `EventDispatcher` publishes asynchronously via `Promise.allSettled()`
- Listener interface uses TypeScript interface (all methods optional)
- Listener failures caught and logged to `console.error`
- Events include `Date` timestamp
- Each TaskRunner has its own EventDispatcher

### Event Types (Identical in Both)

| Event | Python Fields | JavaScript Fields | Parity |
|-------|---------------|-------------------|--------|
| `PollStarted` | task_type, worker_id, poll_count, timestamp | taskType, workerId, pollCount, timestamp | Same |
| `PollCompleted` | task_type, duration_ms, tasks_received, timestamp | taskType, durationMs, tasksReceived, timestamp | Same |
| `PollFailure` | task_type, duration_ms, cause, timestamp | taskType, durationMs, cause, timestamp | Same |
| `TaskExecutionStarted` | task_type, task_id, worker_id, workflow_instance_id, timestamp | taskType, taskId, workerId, workflowInstanceId, timestamp | Same |
| `TaskExecutionCompleted` | task_type, task_id, worker_id, workflow_instance_id, duration_ms, output_size_bytes, timestamp | taskType, taskId, workerId, workflowInstanceId, durationMs, outputSizeBytes, timestamp | Same |
| `TaskExecutionFailure` | task_type, task_id, worker_id, workflow_instance_id, cause, duration_ms, timestamp | taskType, taskId, workerId, workflowInstanceId, cause, durationMs, timestamp | Same |
| `TaskUpdateFailure` | task_type, task_id, worker_id, workflow_instance_id, cause, retry_count, task_result, timestamp | taskType, taskId, workerId, workflowInstanceId, cause, retryCount, taskResult, timestamp | Same |

### Comparison

| Feature | Python | JavaScript |
|---------|--------|-----------|
| Event count | 7 | 7 |
| Event immutability | `@dataclass(frozen=True)` | Plain objects (mutable) |
| Publishing model | Synchronous (inline) | Asynchronous (`Promise.allSettled`) |
| Listener protocol | `typing.Protocol` (duck typing) | TypeScript interface |
| Error isolation | `try/except` per listener | `try/catch` per listener, `Promise.allSettled` |
| Cross-process events | No (per-process dispatcher) | N/A (single process) |
| Registration API | `event_listeners` param on TaskHandler | `eventListeners` param on TaskHandler/TaskRunner |

---

## 9. Metrics / Prometheus

### Python: Full Prometheus Stack

```python
from conductor.client.configuration.settings.metrics_settings import MetricsSettings

metrics_settings = MetricsSettings(
    directory="/tmp/conductor-metrics",
    update_interval=0.1,
    http_port=8000  # Built-in HTTP server
)

handler = TaskHandler(
    configuration=config,
    metrics_settings=metrics_settings,
    event_listeners=[custom_monitor]  # Can combine with custom listeners
)
```

**Built-in Metrics:**
- `task_poll_time_seconds{taskType,quantile}` - Poll latency
- `task_execute_time_seconds{taskType,quantile}` - Execution time
- `task_execute_error_total{taskType,exception}` - Error count
- `task_poll_total{taskType}` - Poll count
- `task_result_size_bytes{taskType,quantile}` - Output size
- `http_api_client_request{method,uri,status,quantile}` - API request latency

**Features:**
- HTTP mode: Built-in server on `/metrics` and `/health` endpoints
- File mode: Writes `.prom` files for external scraping
- Multiprocess-safe via SQLite `.db` files
- Automatic aggregation across worker processes (no PID labels)
- `MetricsCollector` is itself an event listener

### JavaScript: Built-in MetricsCollector

The JavaScript SDK provides a built-in `MetricsCollector` that implements `TaskRunnerEventsListener`:

```typescript
import { MetricsCollector, TaskHandler } from "@io-orkes/conductor-javascript/worker";

const metrics = new MetricsCollector();

const handler = new TaskHandler({
    client,
    eventListeners: [metrics],
});

handler.startWorkers();

// Read metrics
const snapshot = metrics.getMetrics();
console.log("Poll total:", snapshot.pollTotal);
console.log("Execution durations:", snapshot.executionDurationMs);
```

### Comparison

| Feature | Python | JavaScript |
|---------|--------|-----------|
| Built-in metrics collector | Yes (`MetricsCollector`) | Yes (`MetricsCollector`) | Parity |
| HTTP metrics endpoint | Yes (`/metrics`, `/health`) | No (use prom-client separately) | Python richer |
| File-based metrics | Yes (`.prom` files) | No | Python richer |
| Multiprocess aggregation | Yes (SQLite) | N/A (single process) | N/A |
| API request metrics | Yes (`http_api_client_request`) | No | Python richer |
| Event-based architecture | Yes (MetricsCollector is listener) | Yes (MetricsCollector is listener) | Parity |
| Custom metrics via events | Yes | Yes | Parity |

---

## 10. Configuration System

Both SDKs implement nearly identical hierarchical configuration systems. See `SDK_COMPARISON.md` Section 4 for the detailed property-by-property comparison. Key differences:

| Feature | Python | JavaScript |
|---------|--------|-----------|
| Old env format (`conductor_worker_<prop>`) | Supported (backward compat) | Not supported |
| Mixed case (`CONDUCTOR_WORKER_<name>_<PROP>`) | Supported | Not supported |
| `poll_interval` vs `polling_interval` aliases | Both supported | Only `pollInterval` |
| Startup logging format | `Conductor Worker[name=X, pid=Y, status=Z, ...]` | `Conductor Worker[name=X, pid=Y, status=Z, ...]` | Same format |
| Config source tracking | Yes (logged per property) | Yes (logged per property) |

---

## 11. Task Context

### Python: Full Task Context via `contextvars`

```python
from conductor.client.context.task_context import get_task_context, TaskInProgress

@worker_task(task_definition_name='batch_processor')
def process_batch(batch_id: str) -> Union[dict, TaskInProgress]:
    ctx = get_task_context()

    ctx.add_log("Starting batch processing")
    poll_count = ctx.get_poll_count()

    processed = process_chunk(batch_id, offset=poll_count * 100)

    if processed < 100:
        ctx.add_log(f"Completed. Total: {poll_count * 100 + processed}")
        return {'total': poll_count * 100 + processed}
    else:
        return TaskInProgress(callback_after_seconds=30, output={'progress': poll_count * 100 + processed})
```

**API:**
- `get_task_context()` → `TaskContext`
- `ctx.get_task_id()`, `ctx.get_workflow_instance_id()`, `ctx.get_retry_count()`, `ctx.get_poll_count()`
- `ctx.add_log(message)` - adds execution log
- `ctx.set_callback_after(seconds)` - sets callback for re-queue
- `ctx.set_output(data)` - sets intermediate output
- `TaskInProgress(callback_after_seconds, output)` - return type for long-running tasks

### JavaScript: Full Task Context via `AsyncLocalStorage`

```typescript
import { getTaskContext } from "@io-orkes/conductor-javascript/worker";

@worker({ taskDefName: 'batch_processor' })
async function processBatch(task: Task) {
    const ctx = getTaskContext();
    ctx?.addLog("Starting batch processing");
    const pollCount = ctx?.getPollCount() ?? 0;

    const processed = await processChunk(task.inputData.batchId, pollCount * 100);

    if (processed < 100) {
        return { status: "COMPLETED", outputData: { total: pollCount * 100 + processed } };
    } else {
        return { status: "IN_PROGRESS", callbackAfterSeconds: 30, outputData: { progress: pollCount * 100 + processed } };
    }
}
```

**API:**
- `getTaskContext()` → `TaskContext | undefined`
- `ctx.getTaskId()`, `ctx.getWorkflowInstanceId()`, `ctx.getRetryCount()`, `ctx.getPollCount()`
- `ctx.getTaskDefName()`, `ctx.getWorkflowTaskType()`
- `ctx.addLog(message)` — adds execution log
- `ctx.setCallbackAfter(seconds)` — sets callback for re-queue
- `ctx.setOutput(data)` — sets intermediate output
- `ctx.getInput()` — gets task input data
- `ctx.getTask()` — gets full Task object
- `TaskInProgressResult` — return type: `{ status: "IN_PROGRESS", callbackAfterSeconds, outputData? }`

### Comparison

| Feature | Python | JavaScript | Status |
|---------|--------|-----------|--------|
| Context mechanism | `contextvars` | `AsyncLocalStorage` | Parity (both async-safe) |
| Long-running tasks | `TaskInProgress` | `TaskInProgressResult` | Parity |
| Execution logs | `ctx.add_log()` | `ctx.addLog()` | Parity |
| Callback scheduling | `ctx.set_callback_after()` | `ctx.setCallbackAfter()` | Parity |
| Poll count access | `ctx.get_poll_count()` | `ctx.getPollCount()` | Parity |
| Workflow task type | `ctx.get_workflow_task_type()` | `ctx.getWorkflowTaskType()` | Parity |
| Context merging | Logs + callback merged into result | Logs + callback + output merged into result | Parity |
| Error stack traces | Traceback in TaskExecLog on failure | Stack trace in TaskExecLog on failure | Parity |

---

## 12. Summary: Gap Status

### Priority 1: Critical Worker Features — All CLOSED

| # | Feature | Status |
|---|---------|--------|
| 1 | Adaptive backoff for empty polls | **CLOSED** — Exponential backoff in Poller: 1ms, 2ms, 4ms...1024ms, capped at pollInterval |
| 2 | Auth failure backoff | **CLOSED** — Exponential backoff: 2^N seconds, capped at 60s, resets on success |
| 3 | TaskContext | **CLOSED** — `AsyncLocalStorage`-based context with `getTaskContext()`, `addLog()`, `setCallbackAfter()`, `setOutput()`, `getWorkflowTaskType()` |
| 4 | TaskInProgress | **CLOSED** — Workers can return `{ status: "IN_PROGRESS", callbackAfterSeconds }` for long-running tasks |
| 5 | Paused worker support | **CLOSED** — `paused` option checked in polling loop, controllable via `setPaused()` and env vars |

### Priority 2: Worker Enhancements — All CLOSED

| # | Feature | Status |
|---|---------|--------|
| 6 | Parameter extraction | **N/A** — TypeScript erases types at runtime; Python uses `inspect.signature()`. Not feasible in JS. |
| 7 | Update retry count | **CLOSED** — `MAX_RETRIES = 4` with 10s/20s/30s/40s backoff |
| 8 | Built-in MetricsCollector | **CLOSED** — `MetricsCollector` implements `TaskRunnerEventsListener` with in-memory metrics collection |
| 9 | Process monitoring | **CLOSED** — Health monitor in TaskHandler with auto-restart and exponential backoff |

### Priority 3: Advanced Features — All CLOSED

| # | Feature | Status |
|---|---------|--------|
| 10 | JSON schema generation | **N/A** — TypeScript runtime type erasure makes this impractical; users can set `taskDef.inputSchema`/`outputSchema` manually |
| 11 | WorkerLoader / recursive scanning | **N/A** — JS module system doesn't support package scanning; `importModules` with dynamic `import()` covers the use case |
| 12 | Discovery summary | **CLOSED** — `TaskHandler.printSummary()` logs all workers with status, domain, concurrency, pollInterval |
| 13 | Dual-mode decorator | **CLOSED** — `@worker`-decorated function called with `{ taskRefName }` returns `SimpleTaskDef` for workflow building |

### Integration & Wiring — All CLOSED

| # | Feature | Status |
|---|---------|--------|
| 14 | `resolveWorkerConfig` wired into TaskHandler | **CLOSED** — Env vars auto-applied on startup (worker-specific > global > code > defaults) |
| 15 | Worker ID defaults to hostname | **CLOSED** — Uses `os.hostname()` fallback, overridable via config or env var |
| 16 | Task definition auto-registration | **CLOSED** — `registerTaskDef: true` registers/updates task defs via Conductor API before polling |
| 17 | Startup config logging | **CLOSED** — `Conductor Worker[name=X, pid=Y, status=Z, ...]` logged per worker on discovery |
| 18 | Paused from env vars | **CLOSED** — `CONDUCTOR_WORKER_<NAME>_PAUSED=true` pauses worker on startup |
| 19 | Error stack traces in task logs | **CLOSED** — Full stack trace included in `TaskExecLog` on task failure for Conductor UI debugging |
| 20 | `isHealthy()` / `getWorkerStatus()` | **CLOSED** — `TaskHandler.isHealthy()` and `getWorkerStatus()` for runtime health inspection |
| 21 | `getWorkflowTaskType()` on TaskContext | **CLOSED** — Accessor for `task.taskType` (SIMPLE, HTTP, etc.) |

### Remaining Differences (by design, not gaps)

| Feature | Python | JavaScript | Reason |
|---------|--------|-----------|--------|
| Parameter extraction from signature | `inspect.signature()` | Manual — receives `Task` object | TypeScript erases types at runtime |
| JSON schema generation from types | Automatic from type hints | Manual via `taskDef.inputSchema` | TypeScript erases types at runtime |
| Recursive package scanning | `scan_packages(recursive=True)` | `importModules` with `import()` | JS module system design |
| Output serialization fallback | `dataclass → dict`, string fallback | Workers return typed objects directly | Different language idioms |
| Multiprocess model | OS process per worker | Single event loop | Node.js design (async I/O) |
| Old-format env vars (`conductor_worker_*`) | Supported for backward compat | Not supported | New SDK, no backward compat needed |
| `polling_interval` alias | Both `poll_interval` and `polling_interval` | Only `pollInterval` | Simplicity |
| Legacy `WorkerTask` decorator | CamelCase alias available | Only `@worker` | No backward compat needed |
| Schema registration via SchemaResource | Auto-registers input/output schemas | Users set `taskDef.inputSchema` directly | TypeScript can't generate schemas |
| Signal handling (SIGINT/SIGTERM) | Via multiprocessing | Application-level concern | Node.js convention |
| `extendLease` | Flag exists, not implemented | Flag exists, not implemented | Symmetric — neither SDK uses it |
