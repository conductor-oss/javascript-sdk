# Connection and authentication

Every client (`OrkesClients.from()`, `createConductorClient()`,
`AgentRuntime`, ...) resolves the same way: `CONDUCTOR_SERVER_URL` ->
explicit config -> default `http://localhost:8080`. Auth follows the same
chain: `CONDUCTOR_AUTH_KEY` / `CONDUCTOR_AUTH_SECRET` -> explicit config ->
`undefined` (no-auth). No other env var names are read.

```typescript
import { OrkesClients } from "@io-orkes/conductor-javascript";

const clients = await OrkesClients.from(); // reads CONDUCTOR_* from env
const executor = clients.getWorkflowClient();
```

**OSS:** a local development server may allow anonymous access (leave
`CONDUCTOR_AUTH_KEY`/`SECRET` unset). **Orkes:** use the tenant API endpoint
and an application access key/secret. Never put credentials in workflow
input, agent prompts, task output, example source, or version control.

If requests fail, verify the URL ends in `/api`, the server is reachable, and
the credentials belong to that endpoint — see [debugging](debugging.md).
Next: [core quickstart](core-quickstart.md).
