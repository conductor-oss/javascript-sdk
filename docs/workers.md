# Writing Workers with the Javascript SDK

A worker is responsible for executing a task.
Operator and System tasks are handled by the Conductor server, while user defined tasks needs to have a worker created that awaits the work to be scheduled by the server for it to be executed.

Worker framework provides features such as polling threads, metrics and server communication.

### Design Principles for Workers

Each worker embodies design pattern and follows certain basic principles:

1. Workers are stateless and do not implement a workflow specific logic.
2. Each worker executes a very specific task and produces well-defined output given specific inputs.
3. Workers are meant to be idempotent (or should handle cases where the task that is partially executed gets rescheduled due to timeouts etc.)
4. Workers do not implement the logic to handle retries etc, that is taken care by the Conductor server.

### Creating Task Workers

Task worker is implemented using a function that confirms to the following function

```typescript
import { ConductorWorker, Task } from "@io-orkes/conductor-javascript";

const worker: ConductorWorker = {
  taskDefName: "task-def-name",
  execute: async (
    task: Task
  ): Promise<Omit<TaskResult, "workflowInstanceId" | "taskId">> => {},
};
```

Worker returns a object as the output of the task execution. The object is just a json that follows the TaskResult interface.
If an `error` is returned, the task is marked as `FAILED`

#### Task worker that returns an object

```typescript
import { ConductorWorker, Task } from "@io-orkes/conductor-javascript";

const worker: ConductorWorker = {
  taskDefName: "task-def-name",
  execute: async (task: Task) => {
    // Sample output
    return {
      outputData: {
        hello: "From your worker",
      },
      status: "COMPLETED",
    };
  },
};
```

#### Controlling execution for long-running tasks

For the long-running tasks you might want to spawn another process/routine and update the status of the task at a later point and complete the
execution function without actually marking the task as `COMPLETED`. Use `TaskResult` Interface that allows you to specify more fined grained control.

Here is an example of a task execution function that returns with `IN_PROGRESS` status asking server to push the task again in 60 seconds.

```typescript
const worker: ConductorWorker = {
  taskDefName: "task-def-name",
  execute: async (task: Task) => {
    // Sample output
    return {
      outputData: {},
      status: "IN_PROGRESS",
      callbackAfterSeconds: 60,
    };
  },
  pollInterval: 100, // optional
  concurrency: 2, // optional
};
```

## Starting Workers

`TaskRunner` interface is used to start the workers, which takes care of polling server for the work, executing worker code and updating the results back to the server.

```typescript
import {
  OrkesApiConfig,
  orkesConductorClient,
  TaskRunner,
} from "@io-orkes/conductor-javascript";

const clientPromise = orkesConductorClient({
  keyId: "XXX", // optional
  keySecret: "XXXX", // optional
  serverUrl: "https://play.orkes.io/api",
});

const client = await clientPromise;

const taskDefName = "HelloWorldWorker";

const customWorker: ConductorWorker = {
taskDefName,
  execute: async ({ inputData, taskId }) => {
    return {
      outputData: {
        greeting: "Hello World",
      },
      status: "COMPLETED",
    };
  },
};
// Worker Options will take precedence over options defined in the manager

const manager = new TaskManager(client, [customWorker], {
  options: { pollInterval: 100, concurrency: 1 },
});

manager.startPolling();
// You can update all worker settings at once using
manager.updatePollingOptions({ pollInterval: 100, concurrency: 1 });

// You can update a single worker setting using :
manager.updatePollingOptionForWorker(taskDefName, {
  pollInterval: 100,
  concurrency: 1,
});

manager.isPolling // Will resolve to true

await manager.stopPolling();

manager.isPolling // Will resolve to false

```

## Task Management APIs

### Get Task Details

```typescript
import {
  WorkflowExecutor,
  TaskResultStatus,
} from "@io-orkes/conductor-javascript";

const clientPromise = orkesConductorClient({
  keyId: "XXX", // optional
  keySecret: "XXXX", // optional
  serverUrl: "https://play.orkes.io/api",
});

const client = await clientPromise;
const executor = new WorkflowExecutor(client);

const taskDetails = await executor.getTask(someTaskId);
```

### Updating the Task result outside the worker implementation

#### Update task by Reference Name

```typescript
executor.updateTaskByRefName(
  taskReferenceName,
  workflowInstanceId,
  "COMPLETED",
  { some: { output: "value" } }
);
```

#### Update task by id

```typescript
await executor.updateTask(taskId, executionId, "COMPLETED", newChange);
```

### More Docs

* [Getting Started](getting-started.md)
* [Create Workflows](create.md)
* [Execute Workflows](execute.md)
* [Search for entities](search.md)
* [About](about.md)

