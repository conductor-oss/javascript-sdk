# Core quickstart

**Audience:** developers writing their first Conductor workflow and worker in
TypeScript.

## Prerequisites

```shell
npm install @io-orkes/conductor-javascript
export CONDUCTOR_SERVER_URL=http://localhost:8080
```

A running server ([server-setup.md](server-setup.md)) and Node.js >= 18.

## The whole thing

Create `quickstart.ts`:

```ts
import {
  OrkesClients,
  ConductorWorkflow,
  TaskHandler,
  worker,
  simpleTask,
} from "@io-orkes/conductor-javascript";
import type { Task } from "@io-orkes/conductor-javascript";

// A worker is any TypeScript function.
@worker({ taskDefName: "greet" })
async function greet(task: Task) {
  return {
    status: "COMPLETED" as const,
    outputData: { result: `Hello ${task.inputData.name}` },
  };
}

async function main() {
  const clients = await OrkesClients.from();
  const executor = clients.getWorkflowClient();

  const workflow = new ConductorWorkflow(executor, "greetings")
    .add(simpleTask("greet_ref", "greet", { name: "${workflow.input.name}" }))
    .outputParameters({ result: "${greet_ref.output.result}" });

  await workflow.register();

  const handler = new TaskHandler({
    client: clients.getClient(),
    scanForDecorated: true,
  });
  await handler.startWorkers();

  const run = await workflow.execute({ name: "Conductor" });
  console.log(`result: ${run.output?.result}`);

  await handler.stopWorkers();
}

main();
```

```shell
npx tsx quickstart.ts
```

**Expected result:** `result: Hello Conductor`, and the execution visible in the
UI at `http://localhost:8080`.

## What each piece does

1. **`OrkesClients.from()`** reads connection config from the environment and
   builds one shared client — see
   [connection-authentication.md](connection-authentication.md).
2. **`ConductorWorkflow`** is the fluent builder. `simpleTask(ref, taskDefName,
   input)` adds a worker task; `${workflow.input.name}` is a server-evaluated
   expression, not TypeScript interpolation.
3. **`register()`** persists the definition. It defaults to `overwrite=true`, so
   re-running replaces the definition rather than failing.
4. **`@worker`** registers the function in a global registry.
   `scanForDecorated: true` makes `TaskHandler` pick it up.
5. **`startWorkers()`** is `async` — it registers task definitions before polling.
   Await it.
6. **`execute()`** starts the workflow and waits for completion.
   `startWorkflow()` returns immediately instead.

## Common failure modes

- **Task stuck in `SCHEDULED`.** No worker is polling for that `taskDefName`.
  Workers must be started *before* the workflow executes, and the name in
  `@worker({ taskDefName })` must match the name in `simpleTask(...)` exactly.
- **`result: undefined`.** The workflow's `outputParameters` reference a task ref
  that doesn't match. `greet_ref` in `simpleTask("greet_ref", ...)` and in
  `${greet_ref.output.result}` must be identical.
- **Process won't exit.** `stopWorkers()` wasn't reached. Wrap in `try`/`finally`
  for anything long-lived.
- **Connection refused.** `CONDUCTOR_SERVER_URL` points somewhere else, or the
  server isn't up.

## Decorators and tsconfig

The SDK supports both decorator styles. Class methods use TypeScript 5.0+ Stage 3
decorators and need no compiler flag; standalone functions need
`"experimentalDecorators": true`. See [workers.md](workers.md#decorator-styles).

## Cleanup

`handler.stopWorkers()` stops polling. Registered workflow and task definitions
persist on the server; remove them via the metadata client or the UI.

## Next steps

[workflows.md](workflows.md) · [workers.md](workers.md) ·
[agents/README.md](agents/README.md) — the agent layer
