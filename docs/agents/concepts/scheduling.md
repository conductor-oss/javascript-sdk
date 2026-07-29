# Scheduling

Attach cron schedules to an agent at deploy time. Reconciliation is
declarative: a list upserts those and prunes the rest; `[]` purges all;
omitting `schedules` leaves them untouched.

```ts
import { Agent, AgentRuntime, Schedule, schedules } from '@io-orkes/conductor-javascript/agents';

const digest = new Agent({ name: 'eng_digest', model, instructions: 'Write a digest.' });

await runtime.deploy(digest, {
  schedules: [
    new Schedule({
      name: 'weekday-9am',
      cron: '0 0 9 * * MON-FRI',
      timezone: 'America/Los_Angeles',
      input: { channel: '#eng' },
      description: 'Weekday morning digest',
    }),
  ],
});

// Inspect / control via the `schedules` namespace
const infos = await schedules.list({ agent: digest.name });
await schedules.pause(infos[0].name, { reason: 'cooldown' });
await schedules.resume(infos[0].name);
const execId = await schedules.runNow(infos[0].name);
const next = await schedules.previewNext('0 0 9 * * MON-FRI', { n: 5 });

await runtime.deploy(digest, { schedules: [] });   // purge all
```

Lifecycle calls (`get`/`pause`/`resume`/`delete`/`runNow`) key on the **wire
name** (the prefixed `name` returned in `ScheduleInfo`), not the short name
you supplied. The `AgentClient` also has `schedule(agent, schedules)` (see
[control plane](../reference/client.md)).

Agent schedules ride the SDK's core `SchedulerClient` — the same client every
other Conductor workflow uses, not a separate agent-only facade — so pause/
resume/delete/list behave identically to scheduling a plain workflow. Deploy
the agent (`runtime.deploy`) before scheduling it: a schedule referencing an
undeployed workflow definition will fail at fire time, not at save time. Use
stable schedule names and idempotent workflow input, since a scheduled fire
that overlaps a retry or a manual `runNow` should be safe to run twice.

## Next steps

Read [runtime modes](deploy-serve-run.md) and the
[Schedules / SchedulerClient reference](../reference/api.md#schedules--schedulerclient).
