# Compatibility

**Audience:** developers checking whether a capability exists on their server and
runtime.

## Prerequisites

None.

## Runtime

| | Supported |
|---|---|
| Node.js | >= 18. CI covers 20, 22, 24. |
| Modules | ESM and CommonJS — `import` and `require` both work. |
| TypeScript | 5.x. Both decorator styles supported — see [workers.md](workers.md#decorator-styles). |

## Server families

| | conductor-oss | Orkes Conductor |
|---|---|---|
| Core workflows and workers | Yes | Yes |
| Auth | Usually unauthenticated locally | Key/secret → JWT |
| Scheduler module | Optional | Included |
| Secret store | May be env-backed and read-only | Writable |
| Agent runtime | `>= 3.32.0-rc.8` | Requires `agentspan.embedded=true` |
| Credential delivery on `runtimeMetadata` | Needs conductor-oss PR #1255 | Yes |

`CONDUCTOR_SERVER_TYPE=oss` gates Orkes-only integration tests out, so a run against
a standalone server skips rather than fails.

## Capability gates worth knowing

**Agent runtime.** Conductor agents need conductor-oss `>= 3.32.0-rc.8`, or
orkes-conductor booted with the `agentspan.embedded=true` boot property. That
property is owned by the server, not this SDK.

**Credential delivery.** Tool credentials arrive wire-only on the polled task's
`runtimeMetadata`. A server that doesn't persist `TaskDef.runtimeMetadata`
(conductor-oss without PR #1255, agentspan server > 0.4.2) cannot deliver them,
and credentialed tools fail closed. See [security.md](security.md).

**Read-only secret store.** A standalone OSS server's secret store can be
env-backed, where `PUT /api/secrets/{name}` returns 500 "env-backed secrets are
read-only" and credentials only exist if pre-seeded as server env vars before boot.
The e2e suite probes for this and skips affected steps.

**Per-schedule verbs.** Pause and resume differ by server family. The SDK issues PUT
first and falls back to GET on HTTP 405, so one client works against both.

**Streaming.** Agent streaming uses SSE where available and falls back to polling
otherwise. The fallback is silent — you get a correct result with no incremental
events. `SSEUnavailableError` and `SSETimeoutError` cover the explicit cases.

## Sibling SDKs

This SDK shares wire contracts with the Python and Java SDKs: the serialized agent
configuration, the plan format (`Ref` markers, step shape), and the agent
metadata keys. The server compiler is the same path for all three. See
[agents/reference/agent-schema.md](agents/reference/agent-schema.md) and
[documentation-parity.md](documentation-parity.md).

## Backward compatibility

The `AGENTSPAN_*` environment variables and the `AgentspanError` /
`AgentspanMetadata` exports remain available as deprecated aliases. See
[upgrading.md](upgrading.md) and [../BREAKING_CHANGES.md](../BREAKING_CHANGES.md).

## Next steps

[upgrading.md](upgrading.md) · [server-setup.md](server-setup.md) ·
[workflow-testing.md](workflow-testing.md)
