# Workflow message queue (WMQ)

Consume messages pushed into a running workflow's queue using the
`PULL_WORKFLOW_MESSAGES` system task.

## Server requirement

WMQ must be enabled on the Conductor server:

```properties
conductor.workflow-message-queue.enabled=true
```

## Consuming in a plain workflow

```typescript
import { pullWorkflowMessages, ConductorWorkflow } from "@io-orkes/conductor-javascript";

const pull = pullWorkflowMessages("pull_ref", 5 /* batchSize */);

const workflow = new ConductorWorkflow(executor, "order_processing").add(pull);
```

The task completes with `output.messages` (a list) and `output.count` when
messages are available; while the queue is empty it stays `IN_PROGRESS` and
is re-evaluated roughly every second. See
[pullWorkflowMessages.ts](../src/sdk/builders/tasks/pullWorkflowMessages.ts)
and [task-generators.md](api-reference/task-generators.md#pull-workflow-messages-task)
for the full builder signature.

## Consuming in an agent

Agents dequeue from the same queue with `waitForMessageTool` instead of a
task builder — see
[agents/concepts/tools.md](agents/concepts/tools.md#waitformessagetool--workflow-message-queue).

## Pushing a message

Python's SDK exposes a `send_message`/`WorkflowClient.send_message` helper
that calls `POST /workflow/{workflowId}/messages`. That operation is not yet
in the JS SDK's generated client — there is currently no supported way to
push a message into a workflow's queue from JS. Track this as an open gap
rather than assuming a `sendMessage` method exists on any client; none does
today.
