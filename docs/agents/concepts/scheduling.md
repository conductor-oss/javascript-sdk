# Scheduling

**Audience:** developers running Conductor agents unattended on a cron.

## Prerequisites

An agent that runs, and the scheduler module enabled on the server. Schedules are
attached at **deploy** time, not run time — see
[deploy-serve-run.md](deploy-serve-run.md).

**Capability:** scheduling requires a server with the scheduler module. On a
standalone OSS server without it, `schedules.*` calls fail rather than silently
no-op.

## Attaching schedules

Reconciliation is declarative: a list upserts those schedules and prunes the
rest, `[]` purges all, and omitting `schedules` leaves them untouched.

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
```

**Expected result:** `schedules.list({ agent: digest.name })` returns one
`ScheduleInfo`, and the agent runs at the next matching time.

**Common failure mode:** omitting `schedules` when you meant to clear them. Only
`schedules: []` purges; leaving the key out preserves whatever is already on the
server.

Note the cron format has a **seconds field** — `0 0 9 * * MON-FRI` is 09:00, not
`0 9 * * MON-FRI`.

## Lifecycle

```ts
const infos = await schedules.list({ agent: digest.name });
await schedules.pause(infos[0].name, { reason: 'cooldown' });
await schedules.resume(infos[0].name);
const execId = await schedules.runNow(infos[0].name);
const next = await schedules.previewNext('0 0 9 * * MON-FRI', { n: 5 });

await runtime.deploy(digest, { schedules: [] });   // purge all
```

**Lifecycle calls key on the wire name** — the prefixed `name` returned in
`ScheduleInfo` — not the short name you supplied. Passing `'weekday-9am'` to
`pause()` will not find the schedule; pass `infos[0].name`.

`AgentClient` also has `schedule(agent, schedules)` — see
[../reference/client.md](../reference/client.md).

## Cleanup

`runtime.deploy(agent, { schedules: [] })` removes every schedule for that agent.
A deleted agent's schedules are not cleaned up automatically.

## Next steps

[deploy · serve · run · plan](deploy-serve-run.md) ·
[../../schedules-events.md](../../schedules-events.md) — the non-agent scheduler
