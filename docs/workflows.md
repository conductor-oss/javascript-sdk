# Workflows

**Audience:** developers authoring workflow definitions with the
`ConductorWorkflow` DSL and task builders.

## Prerequisites

A client ([connection-authentication.md](connection-authentication.md)) and a
first workflow working ([core-quickstart.md](core-quickstart.md)).

## The builder

```ts
import { ConductorWorkflow, simpleTask } from "@io-orkes/conductor-javascript";

const workflow = new ConductorWorkflow(executor, "order_flow")
  .add(simpleTask("validate_ref", "validate_order", { orderId: "${workflow.input.orderId}" }))
  .add(simpleTask("charge_ref", "charge_card", { orderId: "${workflow.input.orderId}" }))
  .outputParameters({ status: "${charge_ref.output.status}" });

await workflow.register();
```

`${...}` expressions are evaluated by the **server**, not by TypeScript. They
reference workflow input (`${workflow.input.x}`) or a prior task's output by its
reference name (`${validate_ref.output.y}`).

There is also a simpler factory for flat workflows:

```ts
import { workflow } from "@io-orkes/conductor-javascript";

const wf = workflow({ name: "simple", tasks: [/* ... */] });
```

**Expected result:** `register()` resolves and the definition appears in the UI.

## Task builder argument order

Task builders take the **task reference name first**, then the task definition
name:

```ts
simpleTask("greet_ref", "greet", { name: "..." });
//          ^ref         ^taskDefName
```

This is the opposite of what most people expect, and getting it backwards
produces a workflow that registers fine and then hangs, because no worker polls
for a task type named `greet_ref`. If a task sits in `SCHEDULED`, check this
first.

## Control flow

**HTTP calls without a worker:**

```ts
httpTask("call_api", {
  uri: "https://api.example.com/orders/${workflow.input.orderId}",
  method: "POST",
  body: { items: "${workflow.input.items}" },
  headers: { Authorization: "Bearer ${workflow.input.token}" },
});
```

**Wait:**

```ts
.add(simpleTask("step1_ref", "process_order", {}))
.add(waitTaskDuration("cool_down", "10s"))
.add(simpleTask("step2_ref", "send_confirmation", {}))
```

**Fork/join:**

```ts
workflow.fork([
  [simpleTask("email_ref", "send_email", {})],
  [simpleTask("sms_ref", "send_sms", {})],
  [simpleTask("push_ref", "send_push", {})],
]);
```

**Conditional branching:**

```ts
switchTask("route_ref", "${workflow.input.tier}", {
  premium: [simpleTask("fast_ref", "fast_track", {})],
  standard: [simpleTask("normal_ref", "standard_process", {})],
});
```

Builders live under `src/sdk/builders/tasks/`, including 13 LLM task builders
under `tasks/llm/`.

## Registration

`register()` defaults to **`overwrite=true`**. Re-registering replaces the
definition in place rather than erroring or creating a version — convenient in
development, and a foot-gun if two environments share a server, since the last
writer wins.

```ts
await workflow.register();          // overwrite
await workflow.register(false);     // fail if it already exists
```

## Task definitions

`taskDefinition({ name, ... })` creates a task definition explicitly. Workers
registered through `TaskHandler` with `registerTaskDef: true` register theirs
automatically on `startWorkers()`.

## Common failure modes

- **Task stuck in `SCHEDULED`** — see the argument-order note above, or no worker
  is running.
- **`${...}` appearing literally in output** — the expression referenced a ref or
  field that doesn't exist. The server leaves unresolvable expressions as-is
  rather than erroring.
- **A definition change not taking effect** — a running execution uses the
  definition it started with; re-register and start a new execution.

## Next steps

[workflow-lifecycle.md](workflow-lifecycle.md) · [workers.md](workers.md) ·
[workflow-testing.md](workflow-testing.md)
