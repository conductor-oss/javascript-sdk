# Workflows

Use `ConductorWorkflow` to build a workflow definition from typed task
builders, then register it and run it through `WorkflowExecutor`.

```typescript
import { ConductorWorkflow, simpleTask } from "@io-orkes/conductor-javascript";

const workflow = new ConductorWorkflow(executor, "greetings")
  .add(simpleTask("greet_ref", "greet", { name: "${workflow.input.name}" }))
  .outputParameters({ result: "${greet_ref.output.result}" });

await workflow.register();
const run = await workflow.execute({ name: "Conductor" });
```

Typed builders exist for HTTP calls, wait, switch/branching, fork-join,
do-while, sub-workflows, and event tasks — see
[task-generators.md](api-reference/task-generators.md) and the root
[README's "What You Can Build"](../README.md#what-you-can-build) section for
runnable snippets of each. Keep versioned definitions compatible with
callers; never place secrets in workflow input.

See [workflow-executor.md](api-reference/workflow-executor.md) for the full
registration/execution API and [workflow lifecycle](workflow-lifecycle.md)
for pause/resume/retry/terminate.
