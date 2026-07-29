# Security

**Audience:** developers handling credentials, secrets, and untrusted input with
this SDK.

## Prerequisites

A configured client ([connection-authentication.md](connection-authentication.md)).

## Server credentials

`CONDUCTOR_AUTH_KEY` and `CONDUCTOR_AUTH_SECRET` are minted into a short-lived JWT
and sent as the `X-Authorization` header. The SDK handles minting and refresh; you
only supply the key and secret.

- Never commit them. Inject from the environment or a secret manager.
- The SDK trims surrounding whitespace, because a trailing newline pasted into a CI
  secret is a common cause of "Invalid Access Key".
- Share one client so one token is minted and refreshed, rather than one per
  component.
- `CONDUCTOR_TLS_INSECURE=true` disables certificate verification. Local
  development only.

## Task and tool secrets

The server resolves declared secrets when it polls a task and delivers them
**wire-only** on that task's `runtimeMetadata`. They are never persisted by the
SDK and never fetched separately. For the duration of the call the SDK injects
them into the worker's `process.env` — mutate, invoke, restore — serialized so
concurrent calls don't clobber each other's environment.

```ts
const dbLookup = tool(
  async () => ({ ok: (process.env.DB_API_KEY ?? "") !== "" }),
  {
    name: "db_lookup",
    description: "Look up data.",
    inputSchema: { type: "object", properties: {}, required: [] },
    credentials: ["DB_API_KEY"],
  },
);
```

**Fail-closed, no fallback.** If a tool declares `credentials: [...]` and the
server didn't deliver one, the task fails non-retryably naming the missing
credential. There is deliberately **no ambient-environment fallback** — the SDK
will not silently read a locally-set variable of the same name instead. That
design choice means a misconfigured deployment fails loudly rather than running
with the wrong identity.

Servers that predate `TaskDef.runtimeMetadata` support (conductor-oss without
PR #1255, agentspan server > 0.4.2) cannot deliver credentials at all.

**Scope credentials per tool, not per agent.** Declaring every secret at the agent
level hands each tool the whole set.

## Untrusted input

Model output reaches your code as tool arguments. Treat it as untrusted:

- Validate arguments against `inputSchema`, and re-validate anything you pass to a
  shell, query, or filesystem path.
- Use `approvalRequired: true` on tools that delete, pay, send, or escalate
  privilege — see
  [agents/concepts/streaming-hitl.md](agents/concepts/streaming-hitl.md).
- Remember one HUMAN task gates the **whole batch** of pending tool calls with a
  single verdict. Approving one approves all of them; iterate
  `pendingTool.toolCalls` before approving.
- Guardrails ([agents/concepts/guardrails.md](agents/concepts/guardrails.md)) are a
  mitigation, not a boundary. A regex that blocks a secret pattern reduces
  accidental disclosure; it does not make an agent safe to hand untrusted input.

## Code execution

`LocalCodeExecutor`, `DockerCodeExecutor`, `JupyterCodeExecutor`, and
`ServerlessCodeExecutor` run model-authored code. `LocalCodeExecutor` runs it in
**your process**, with your privileges — prefer a container or serverless executor
for anything reachable by untrusted input. `CommandValidator` and
`cliAllowedCommands` constrain CLI execution; treat an unconstrained
`cliCommands` as equivalent to shell access.

## Logging

Callback hooks and task logs receive prompts, tool arguments, and model output.
Anything you forward to an external sink inherits that sensitivity. Redact before
shipping. `getTaskContext()?.addLog()` writes into the Conductor UI, which is
visible to anyone with access to the execution.

## LLM provider keys

Provider API keys belong to the **server** process, not your application. The
agent layer never reads them.

## Next steps

[connection-authentication.md](connection-authentication.md) ·
[agents/concepts/tools.md](agents/concepts/tools.md#credentials) ·
[deployment-scaling.md](deployment-scaling.md)
