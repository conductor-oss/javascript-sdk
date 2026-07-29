# Core workflow and worker quickstart

**Prerequisites:** Node.js >= 18, `npm install @io-orkes/conductor-javascript`,
and a reachable Conductor server from [server setup](server-setup.md).

```shell
npx ts-node examples/quickstart.ts
```

Expected result: the workflow completes and prints `result: Hello Conductor`.
The example registers a `greetings` workflow, starts a `@worker`-decorated
task handler, executes the workflow, and prints its output. If the task stays
`SCHEDULED`, verify the worker is polling the exact `taskDefName` before the
workflow runs.

See the root [README's 60-Second Quickstart](../README.md#60-second-quickstart)
for the full walkthrough. Continue with [workers](workers.md) or
[workflows](workflows.md).
