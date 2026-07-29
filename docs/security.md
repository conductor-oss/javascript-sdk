# Security and secrets

Keep API keys, provider credentials, and signing secrets in the Conductor
server or its configured secret provider (`SecretClient`,
`AuthorizationClient`, `IntegrationClient`). Do not put them in workflow
input, agent prompts, task output, example source, or version control.

Agent tools declare required credentials via `credentials: [...]`; a capable
server delivers resolved values only in the polled task's `runtimeMetadata`,
fail-closed — a tool whose declared credential wasn't delivered fails
non-retryably naming the missing credential, with no ambient-env fallback.
See [agent tools](agents/reference/api.md#credentials-and-secrets).

There is no dedicated `security.md`/`secret-client.md` API reference page
yet (tracked in
[documentation-parity.md](documentation-parity.md#js-only-by-design-pages));
see the [secrets](../examples/api-journeys/secrets.ts) and
[authorization](../examples/api-journeys/authorization.ts) API journey
examples for a runnable walkthrough in the meantime.
