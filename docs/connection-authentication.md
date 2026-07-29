# Connection and authentication

**Audience:** developers configuring how the SDK reaches a Conductor server.

## Prerequisites

A reachable server ([server-setup.md](server-setup.md)) and the SDK installed.

**Security note:** never commit a key or secret. Set them as environment
variables or inject them from a secret manager. The SDK trims whitespace from
`CONDUCTOR_AUTH_KEY` and `CONDUCTOR_AUTH_SECRET`, because a trailing newline
pasted into a CI secret is a common cause of "Invalid Access Key".

## Creating a client

```ts
import { OrkesClients } from "@io-orkes/conductor-javascript";

// Reads CONDUCTOR_SERVER_URL / CONDUCTOR_AUTH_KEY / CONDUCTOR_AUTH_SECRET from env
const clients = await OrkesClients.from();
const executor = clients.getWorkflowClient();
```

Or build a client explicitly:

```ts
import { createConductorClient } from "@io-orkes/conductor-javascript";

const client = createConductorClient({
  serverUrl: "https://your-cluster.orkesconductor.io/api",
  keyId: process.env.MY_KEY,
  keySecret: process.env.MY_SECRET,
});
```

`orkesConductorClient` is an alias of `createConductorClient` — the two are the
same function.

**Expected result:** any client method resolves. On an unauthenticated OSS server,
leave the key and secret unset.

## Environment variables

| Variable | Purpose |
|---|---|
| `CONDUCTOR_SERVER_URL` | Server URL, with or without `/api`. Defaults to `http://localhost:8080`. |
| `CONDUCTOR_AUTH_KEY` | Auth key. Unset means no-auth mode. |
| `CONDUCTOR_AUTH_SECRET` | Auth secret. Set together with the key. |
| `CONDUCTOR_REQUEST_TIMEOUT_MS` | Per-request timeout. |
| `CONDUCTOR_CONNECT_TIMEOUT_MS` | Connection timeout. |
| `CONDUCTOR_REFRESH_TOKEN_INTERVAL` | JWT refresh interval. |
| `CONDUCTOR_RETRY_SERVER_ERRORS` | Retry 5xx responses. |
| `CONDUCTOR_DISABLE_HTTP2` | Force HTTP/1.1. |
| `CONDUCTOR_MAX_HTTP2_CONNECTIONS` | HTTP/2 connection pool size. |
| `CONDUCTOR_PROXY_URL` | Outbound proxy. |
| `CONDUCTOR_TLS_CERT_PATH` / `CONDUCTOR_TLS_KEY_PATH` / `CONDUCTOR_TLS_CA_PATH` | Client certs and custom CA. |
| `CONDUCTOR_TLS_INSECURE` | Skip certificate verification. Development only. |
| `CONDUCTOR_LOG_LEVEL` | SDK log level. |

## Precedence

Configuration resolves in this order (spec R3):

1. `CONDUCTOR_SERVER_URL` / `CONDUCTOR_AUTH_KEY` / `CONDUCTOR_AUTH_SECRET`
2. explicit values passed to the constructor
3. `CONDUCTOR_AGENT_SERVER_URL` / `CONDUCTOR_AGENT_AUTH_KEY` / `CONDUCTOR_AGENT_AUTH_SECRET`
4. the deprecated `AGENTSPAN_*` spelling of (3), which warns once per name
5. `http://localhost:8080`

**The core env vars outrank explicit constructor values.** That is deliberate — it
lets an operator redirect a deployed application without a code change — but it
surprises people who expect explicit configuration to win. If you need a client
that ignores the environment, unset the variables for that process.

The agent-layer tier exists so an agent-only application can be configured with
one set of variables. See
[agents/reference/runtime.md](agents/reference/runtime.md).

## Sharing one client

Build one client and share it. Every client class and the agent runtime accept a
pre-built `ConductorClient`, which means one token mint rather than one per
component:

```ts
const clients = await OrkesClients.from();
const runtime = new AgentRuntime(clients.getClient());
```

**Common failure mode:** constructing several clients from separate configs, each
minting and refreshing its own JWT. It works, but multiplies auth traffic and
makes token expiry harder to reason about.

## TLS and proxies

```shell
export CONDUCTOR_TLS_CA_PATH=/etc/ssl/certs/internal-ca.pem
export CONDUCTOR_PROXY_URL=http://proxy.internal:3128
```

`CONDUCTOR_TLS_INSECURE=true` disables verification. Never set it outside local
development.

## Next steps

[core-quickstart.md](core-quickstart.md) · [api-map.md](api-map.md) ·
[security.md](security.md)
