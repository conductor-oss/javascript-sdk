# Workflow testing

`WorkflowExecutor.testWorkflow()` evaluates a workflow definition against
Conductor's `POST /api/workflow/test` endpoint with controlled, mocked task
outputs — no live workers required. Cover successful paths, retryable and
terminal failures, branching, timeouts, and workflow outputs.

```shell
npx ts-node examples/test-workflows.ts
```

Expected result: the script prints the simulated workflow's status and
output for each scenario without executing any real worker code. Do not run
examples with production credentials unless their external side effects have
been reviewed.

See [test-workflows.ts](../examples/test-workflows.ts) for the runnable
example and [workflow-executor.md](api-reference/workflow-executor.md) for
`testWorkflow()`'s full signature.
