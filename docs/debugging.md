# Debugging incidents

Start with safe evidence: workflow ID, task reference, status, retry count,
and `reasonForIncompletion`. Confirm server reachability and authentication
before changing application code.

| Symptom | First check |
|---|---|
| Connection error | `CONDUCTOR_SERVER_URL` includes `/api` and the server is healthy. |
| Task stuck in `SCHEDULED` | A worker is polling the exact `taskDefName` (and `domain`, if set) — workers must start before the workflow executes. |
| Authentication failure | `CONDUCTOR_AUTH_KEY`/`CONDUCTOR_AUTH_SECRET` target the active server. |
| Worker stops polling | `TaskHandler` auto-restarts polling loops; check `handler.running`/`handler.runningWorkerCount` and, if metrics are enabled, `worker_restart_total`. |
| Agent cannot call a model | The provider credential is configured on the server, not the client. |

See the root [README's Troubleshooting section](../README.md#troubleshooting),
[workflow-executor.md](api-reference/workflow-executor.md), and
[agents/reference/client.md](agents/reference/client.md) for the relevant
inspection APIs.
