# Schedules and events

**Audience:** developers triggering workflows on a cron or from an external event.

## Prerequisites

A registered workflow ([workflows.md](workflows.md)) and a server with the
scheduler module.

**Capability:** scheduling requires the scheduler module. On a standalone OSS server
without it, scheduler calls fail rather than silently no-op.

## Schedules

```ts
const scheduler = clients.getSchedulerClient();

await scheduler.saveSchedule({
  name: "nightly-report",
  cronExpression: "0 0 0 * * *",
  workflowName: "report_flow",
  workflowInput: { scope: "daily" },
});
```

**Expected result:** the schedule appears in the UI and fires at the next matching
time.

**The cron format has a seconds field.** `0 0 0 * * *` is midnight. A five-field
expression like `0 0 * * *` means something different from what a crontab-trained
reader expects, and is the single most common mistake here.

Lifecycle: `getSchedule`, `pauseSchedule`, `resumeSchedule`, `deleteSchedule`, plus
typed helpers `pause`, `resume`, `runNow`, `previewNext`, and
`reconcile(agentName, desired)`.

`previewNext(cron, { n })` is the cheapest way to confirm an expression means what
you think before you rely on it.

Pause and resume issue PUT first and fall back to GET on HTTP 405, because
per-schedule verbs differ by Conductor server family. One client works against both
OSS/embedded and Orkes.

## Agent schedules

Conductor agents attach schedules **declaratively at deploy time** rather than
through the scheduler client:

```ts
await runtime.deploy(agent, {
  schedules: [new Schedule({ name: "weekday-9am", cron: "0 0 9 * * MON-FRI" })],
});
```

A list upserts those and prunes the rest, `[]` purges all, and omitting the key
leaves them untouched. Lifecycle calls key on the **wire name** from
`ScheduleInfo`, not the short name you supplied. See
[agents/concepts/scheduling.md](agents/concepts/scheduling.md).

## Events

Event handlers react to messages on an external queue or an internal Conductor
event, and can start a workflow or complete a task.

```ts
const events = clients.getEventClient();

await events.registerEventHandler({
  name: "order_created_handler",
  event: "sqs:order-created",
  actions: [{
    action: "start_workflow",
    start_workflow: { name: "order_flow", input: { orderId: "${payload.orderId}" } },
  }],
  active: true,
});
```

`${payload.…}` is evaluated by the server against the incoming event body.

**Common failure modes:**

- A handler registered with `active: false` — it exists and never fires.
- An event sink not configured on the server. The handler is valid; nothing
  delivers to it.
- An unresolvable `${payload.…}` path passes through literally rather than erroring.

## Workflow message queue

Agents can dequeue messages pushed to their own workflow message queue with
`waitForMessageTool`, backed by Conductor's `PULL_WORKFLOW_MESSAGES`. That is a
pull model inside a running execution, distinct from event handlers, which start
executions. See
[agents/concepts/tools.md](agents/concepts/tools.md#waitformessagetool--workflow-message-queue).

## Cleanup

Schedules and event handlers persist until deleted. Pause rather than delete when
you want to keep the definition.

## Next steps

[workflow-lifecycle.md](workflow-lifecycle.md) ·
[agents/concepts/scheduling.md](agents/concepts/scheduling.md) ·
[api-map.md](api-map.md)
