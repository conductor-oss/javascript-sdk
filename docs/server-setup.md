# Server setup

**Audience:** developers who need a Conductor server to develop against.

## Prerequisites

Docker, or Node.js >= 18 for the CLI option. Nothing from this SDK is needed to
start a server.

## Options

**Docker (recommended — includes the UI):**

```shell
docker run -p 8080:8080 conductoross/conductor:latest
```

**macOS / Linux one-liner:**

```shell
curl -sSL https://raw.githubusercontent.com/conductor-oss/conductor/main/conductor_server.sh | sh
```

**Conductor CLI:**

```shell
npm install -g @conductor-oss/conductor-cli
conductor server start
```

**Expected result:** the UI at `http://localhost:8080` and the API at
`http://localhost:8080/api`.

**Common failure mode:** pointing the SDK at the UI URL rather than the API URL.
`CONDUCTOR_SERVER_URL` may be given with or without the `/api` suffix — the SDK
normalizes it — but a URL pointing at a different port will simply fail to
connect.

## OSS vs Orkes

| | conductor-oss | Orkes Conductor |
|---|---|---|
| Auth | Usually none locally | Key/secret, minted to a JWT |
| Agent runtime | `>= 3.32.0-rc.8` | Requires `agentspan.embedded=true` |
| Scheduler module | Optional | Included |
| Secret store | Can be env-backed and read-only | Writable |

Pages call out Orkes-only capabilities where behavior differs. See
[compatibility.md](compatibility.md) for the version matrix.

**Agent runtime:** running Conductor agents needs conductor-oss
`>= 3.32.0-rc.8`, or orkes-conductor booted with the `agentspan.embedded=true`
boot property. That property is owned by the server, not this SDK.

## Local integration testing

The repository ships a Docker Compose stack used by CI:

```shell
docker compose -f scripts/docker-compose-oss.yaml up -d
./scripts/run-integration-oss.sh
```

**Cleanup:**

```shell
docker compose -f scripts/docker-compose-oss.yaml down -v
```

## Next steps

[connection-authentication.md](connection-authentication.md) ·
[core-quickstart.md](core-quickstart.md)
