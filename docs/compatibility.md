# Compatibility matrix

| Area | Supported baseline | Notes |
|---|---|---|
| JS/TS SDK | Node.js >= 18 | Defined by `package.json`'s `engines` field. |
| OSS Conductor | Supported server deployment | Test the target server during upgrades. |
| Orkes | Supported tenant API | Enterprise features depend on tenant permissions. |
| Conductor agents | Server agent runtime and provider integration | Provider credentials live on the server, not the client. |

The JS SDK does not currently provide Java's `FileClient` or Spring Boot
modules — this documentation does not present either as available JS
support.

## Workflow-scoped files

The JS SDK does not currently expose a public workflow-scoped `FileClient`.
Use task-appropriate object storage or a server capability selected by your
deployment; do not copy Java `FileClient` examples into JS applications.

## Framework/runtime integration

Spring and Spring Boot modules are Java-specific. Host workers and
`AgentRuntime` services in whatever Node.js framework your deployment uses —
see [express-worker-service.ts](../examples/express-worker-service.ts) and
[deployment/scaling](deployment-scaling.md).
