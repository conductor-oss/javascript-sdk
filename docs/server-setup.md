# Connect the JS/TS SDK to a Conductor server

**Audience:** developers running workflows, workers, or Conductor agents locally
or against a hosted cluster. **Prerequisites:** Node.js >= 18.

## Local development

Pick one:

```shell
docker run -p 8080:8080 conductoross/conductor:latest
```

```shell
curl -sSL https://raw.githubusercontent.com/conductor-oss/conductor/main/conductor_server.sh | sh
```

```shell
npm install -g @conductor-oss/conductor-cli
conductor server start
```

The Docker image also serves the UI at `http://localhost:8080`; the API is at
`http://localhost:8080/api`.

## Hosted / Orkes Cloud

Set the API URL (including `/api`) and credentials:

```shell
export CONDUCTOR_SERVER_URL="https://your-cluster.orkesconductor.io/api"
export CONDUCTOR_AUTH_KEY="your-key"
export CONDUCTOR_AUTH_SECRET="your-secret"
```

For agent runs, configure the LLM provider credential on the server before
starting it — see [security](security.md).

Continue with [connection/authentication](connection-authentication.md).
