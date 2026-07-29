# Debugging

**Audience:** developers diagnosing a stuck workflow, a failed task, or a silent
worker.

## Prerequisites

Access to the Conductor UI or the workflow client, and your worker logs.

## Start here: read the execution

```ts
const execution = await clients.getWorkflowClient().getExecution(workflowId);
console.log(execution.status);
for (const task of execution.tasks ?? []) {
  console.log(task.referenceTaskName, task.taskDefName, task.status, task.reasonForIncompletion);
}
```

`getExecution()` includes task-level detail; `getWorkflow()` hits a different
endpoint and returns a different shape. For task status, use `getExecution()`.

## Task stuck in SCHEDULED

By far the most common report. The task was scheduled and nothing polled it.

| Check | How |
|---|---|
| Is a worker running? | `handler.running`, `handler.runningWorkerCount` |
| Does the name match? | `@worker({ taskDefName })` must equal the second argument to `simpleTask(ref, taskDefName, …)` |
| Argument order | `simpleTask("greet_ref", "greet", …)` — **ref first**, then task name. Reversed, workers poll for a name nothing produces. |
| Started in time? | Workers must be polling before the workflow executes |
| Domain mismatch? | A worker with `domain: "x"` won't pick up tasks queued without a domain |
| New-style decorators | Class-method decorators only register when the class is instantiated — `void new Workers()` |

For agents specifically: a run that hangs at a tool call usually means the
execution was triggered through the control-plane `AgentClient` while no `serve()`
process was polling. See
[agents/concepts/deploy-serve-run.md](agents/concepts/deploy-serve-run.md).

## Task ran twice

The lease lapsed and the server re-queued it. Enable lease extension and check that
`responseTimeoutSeconds >= 1.25`, since shorter values are silently skipped. See
[reliability.md](reliability.md#lease-extension).

## Worker stops polling

`TaskHandler` monitors and restarts polling loops by default. Alert on
`worker_restart_total` — a climbing count means something throws repeatedly.
Expose `handler.running` as a health check.

## `${...}` appears literally in output

The expression referenced a task ref or field that doesn't exist. The server leaves
unresolvable expressions as-is rather than erroring, so a typo in a ref name shows
up as literal text, not a failure.

## Task fails and keeps retrying

`throw new Error()` yields `FAILED` and retries per the task definition. For
failures a retry cannot fix — bad input, missing record — throw
`NonRetryableException` to get `FAILED_WITH_TERMINAL_ERROR` instead.

## HTTP/2 connection errors

The SDK uses Undici for HTTP/2 when available and falls back to HTTP/1.1
automatically. To force HTTP/1.1:

```shell
export CONDUCTOR_DISABLE_HTTP2=true
```

You can also supply a custom fetch: `orkesConductorClient(config, myFetch)`.

## "Invalid Access Key"

Usually a trailing newline in `CONDUCTOR_AUTH_KEY` or `CONDUCTOR_AUTH_SECRET`. The
SDK trims them, so if this persists, verify the key is valid for the cluster in
`CONDUCTOR_SERVER_URL` — a key from a different cluster produces the same message.

## Configuration seems to be ignored

The core `CONDUCTOR_*` environment variables **outrank** explicit constructor
values (spec R3). If a client isn't using the URL you passed, check the
environment. See
[connection-authentication.md](connection-authentication.md#precedence).

## Deprecation warnings about AGENTSPAN_*

Those variables were renamed to `CONDUCTOR_AGENT_*`. The old names still work and
warn once per name per process. See [upgrading.md](upgrading.md).

## Turn up the logs

```shell
export CONDUCTOR_LOG_LEVEL=DEBUG
```

Inside a worker, `getTaskContext()?.addLog("…")` attaches a log line to that task
execution, visible in the UI — the fastest way to see what one specific task did.

## Process won't exit

Something is still polling. `await handler.stopWorkers()` for workers,
`await runtime.shutdown()` for agents. Both belong in a `finally`.

## Next steps

[observability.md](observability.md) · [reliability.md](reliability.md) ·
[workflow-testing.md](workflow-testing.md)
