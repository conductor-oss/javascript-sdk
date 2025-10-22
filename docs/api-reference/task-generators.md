### Task Generators Reference

This section provides code examples for each task type generator. Use these to build your workflow task lists.

**Note:** These generators create workflow task references. To register task metadata (retry policies, timeouts, rate limits), use `taskDefinition()` or `MetadataClient` (see [Metadata](#metadata)).

#### Simple Task

*Requires Custom Workers* - Executes custom business logic via workers you implement.

```typescript
import { simpleTask } from "@io-orkes/conductor-javascript";

const task = simpleTask(
  "task_ref",          // taskReferenceName (required)
  "task_name",         // name (required): must match worker's taskDefName
  {                    // inputParameters (required)
    inputParam: "value"
  },
  false                // optional (optional): if true, workflow continues on failure
);
```

#### HTTP Task

*System Task* - Makes HTTP/REST API calls.

```typescript
import { httpTask } from "@io-orkes/conductor-javascript";

const task = httpTask(
  "http_ref",
  {
    uri: "http://api.example.com/data",
    method: "GET",
    headers: { "Authorization": "Bearer token" },
    connectionTimeOut: 5000,
    readTimeOut: 10000
  },
  false,  // asyncComplete (optional)
  false   // optional (optional): workflow continues on failure
);
```

#### Switch Task

*System Task* - Provides conditional branching based on input values.

```typescript
import { switchTask } from "@io-orkes/conductor-javascript";

const task = switchTask(
  "switch_ref",
  "input.status",      // expression to evaluate
  {
    "active": [simpleTask("active_task", "process_active", {})],
    "inactive": [simpleTask("inactive_task", "process_inactive", {})]
  },
  [simpleTask("default_task", "process_default", {})],  // defaultCase (optional)
  false  // optional (optional): workflow continues on failure
);
```

#### Fork-Join Task

*System Task* - Executes multiple task branches in parallel and waits for all to complete.

```typescript
import { forkJoinTask } from "@io-orkes/conductor-javascript";

const task = forkJoinTask("fork_ref", [
  [simpleTask("task1", "process_1", {})],
  [simpleTask("task2", "process_2", {})],
  [simpleTask("task3", "process_3", {})]
]);
```

#### Do-While Task

*System Task* - Executes a loop with a condition evaluated after each iteration.

```typescript
import { doWhileTask } from "@io-orkes/conductor-javascript";

const task = doWhileTask("while_ref", "workflow.variables.counter < 10", [
  simpleTask("loop_task", "process_item", {
    index: "${workflow.variables.counter}"
  }),
  setVariableTask("increment", {
    variableName: "counter",
    value: "${workflow.variables.counter + 1}"
  })
]);
```

#### Sub-Workflow Task

*System Task* - Executes another workflow as a task.

```typescript
import { subWorkflowTask } from "@io-orkes/conductor-javascript";

const task = subWorkflowTask(
  "sub_ref",
  "child_workflow",  // workflowName
  1,                 // version (optional): uses latest if not specified
  false              // optional (optional)
);

// Set input parameters
task.inputParameters = { inputParam: "value" };
```

#### Event Task

*System Task* - Publishes events to external eventing systems.

```typescript
import { eventTask } from "@io-orkes/conductor-javascript";

const task = eventTask("event_ref", "event_name", {
  sink: "event_sink",
  asyncComplete: true
});
```

#### Wait Task

*System Task* - Pauses workflow execution for a specified duration or until a specific time.

```typescript
import { waitTaskDuration, waitTaskUntil } from "@io-orkes/conductor-javascript";

// Wait for a duration (e.g., "30s", "5m", "1h", "2d")
const taskDuration = waitTaskDuration(
  "wait_ref",
  "30s",      // duration string
  false       // optional (optional)
);

// Wait until a specific time (ISO 8601 format)
const taskUntil = waitTaskUntil(
  "wait_until_ref",
  "2025-12-31T23:59:59Z",  // ISO 8601 timestamp
  false                     // optional (optional)
);
```

#### Terminate Task

*System Task* - Terminates workflow execution with a specified status.

```typescript
import { terminateTask } from "@io-orkes/conductor-javascript";

const task = terminateTask(
  "terminate_ref",
  "FAILED",         // status: "COMPLETED" or "FAILED"
  "Error message"   // terminationReason (optional)
);
```

#### Set Variable Task

*System Task* - Sets or updates workflow variables.

```typescript
import { setVariableTask } from "@io-orkes/conductor-javascript";

const task = setVariableTask("var_ref", {
  variableName: "result",
  value: "computed_value"
});
```

#### JSON JQ Transform Task

*System Task* - Transforms JSON data using JQ expressions.

```typescript
import { jsonJqTask } from "@io-orkes/conductor-javascript";

const task = jsonJqTask("transform_ref", ".data.items[] | {id: .id, name: .name}");
```

#### Kafka Publish Task

*System Task* - Publishes messages to Kafka topics.

```typescript
import { kafkaPublishTask } from "@io-orkes/conductor-javascript";

const task = kafkaPublishTask("kafka_ref", "topic_name", {
  message: "Hello Kafka!"
}, {
  key: "message_key",
  partition: 0
});
```

#### Inline Task

*System Task* - Executes JavaScript code inline within the workflow.

```typescript
import { inlineTask } from "@io-orkes/conductor-javascript";

const task = inlineTask("inline_ref", `
  function execute(input) {
    return { result: input.value * 2 };
  }
`);
```

#### Dynamic Fork Task

*System Task* - Dynamically creates parallel task executions based on input.

```typescript
import { dynamicForkTask } from "@io-orkes/conductor-javascript";

const task = dynamicForkTask("dynamic_ref", "input.tasks", "task_name");
```

#### Join Task

*System Task* - Synchronization point for forked tasks.

```typescript
import { joinTask } from "@io-orkes/conductor-javascript";

const task = joinTask("join_ref");
```

#### Human Task

*System Task* - Pauses workflow until a person completes an action (approval, form submission, etc.).

```typescript
import { humanTask } from "@io-orkes/conductor-javascript";

const task = humanTask("human_ref", "approval_task", {
  assignee: "user@example.com",
  form: {
    fields: [
      { name: "approved", type: "boolean", required: true },
      { name: "comments", type: "text", required: false }
    ]
  }
});
```
