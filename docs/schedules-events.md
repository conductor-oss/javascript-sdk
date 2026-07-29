# Schedules and events

Use `SchedulerClient` for workflow schedules and `EventClient` for
event-driven integration. Give scheduled executions a stable correlation or
idempotency key so retries do not duplicate business effects.

```typescript
const scheduler = clients.getSchedulerClient();
await scheduler.saveSchedule({ name: "nightly-report", cronExpression: "0 0 2 * * *", startWorkflowRequest: { name: "report_flow" } });
```

`pauseSchedule`/`resumeSchedule` issue PUT first and fall back to GET on
HTTP 405, so the same call works against both OSS/embedded (PUT-only) and
Orkes Cloud (GET-only) servers.

See [scheduler-client.md](api-reference/scheduler-client.md) and
[event-client.md](api-reference/event-client.md) for the complete request
models, and [workflow lifecycle](workflow-lifecycle.md) for safe operational
handling of the workflows a schedule triggers.
