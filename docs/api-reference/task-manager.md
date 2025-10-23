# TaskManager API Reference

The `TaskManager` is responsible for initializing and managing the runners that poll and work different task queues.

## Constructor

### `new TaskManager(client: ConductorClient, workers: Array<ConductorWorker>, config: TaskManagerConfig = {})`

Creates a new TaskManager.

**Parameters:**

-   `client` (`ConductorClient`): An instance of `ConductorClient`.
-   `workers` (`Array<ConductorWorker>`): An array of `ConductorWorker` instances.
-   `config` (`TaskManagerConfig`, optional): Configuration for the `TaskManager`.

**Example:**

```typescript
import { TaskManager } from "@io-orkes/conductor-javascript";

const workers = [
  {
    taskDefName: "email_task",
    execute: async (task) => {
      // Task execution logic
      return {
        status: "COMPLETED",
        outputData: { sent: true }
      };
    }
  }
];

const taskManager = new TaskManager(client, workers, {
  options: {
    concurrency: 5,
    pollInterval: 100
  },
  maxRetries: 3
});
```

---

## Properties

### `isPolling: boolean`

Returns whether the `TaskManager` is currently polling for tasks.

---

## Methods

### `updatePollingOptionForWorker(workerTaskDefName: string, options: Partial<TaskManagerOptions>): void`

Updates the polling options for a specific worker.

**Parameters:**

-   `workerTaskDefName` (`string`): The task definition name of the worker.
-   `options` (`Partial<TaskManagerOptions>`): The new polling options.

**Example:**

```typescript
import { TaskManager } from "@io-orkes/conductor-javascript";

const taskManager = new TaskManager(client, workers);

// Update polling options for a specific worker
taskManager.updatePollingOptionForWorker("email_task", {
  concurrency: 10,
  pollInterval: 500
});
```

---

### `updatePollingOptions(options: Partial<TaskManagerOptions>): void`

Updates the polling options for all workers.

**Parameters:**

-   `options` (`Partial<TaskManagerOptions>`): The new polling options.

**Example:**

```typescript
import { TaskManager } from "@io-orkes/conductor-javascript";

const taskManager = new TaskManager(client, workers);

// Update polling options for all workers
taskManager.updatePollingOptions({
  concurrency: 5,
  pollInterval: 200
});
```

---

### `startPolling(): void`

Starts polling for tasks for all workers.

**Example:**

```typescript
import { TaskManager } from "@io-orkes/conductor-javascript";

const taskManager = new TaskManager(client, workers);

// Start polling for tasks
taskManager.startPolling();
console.log(`Polling started: ${taskManager.isPolling}`);
```

---

### `stopPolling(): Promise<void>`

Stops polling for tasks for all workers.

**Example:**

```typescript
import { TaskManager } from "@io-orkes/conductor-javascript";

const taskManager = new TaskManager(client, workers);

// Stop polling for tasks
await taskManager.stopPolling();
console.log(`Polling stopped: ${taskManager.isPolling}`);
```

---

### `sanityCheck(): void`

Performs a sanity check on the workers, ensuring there are no duplicates and that at least one worker is present. Throws an error if the check fails.

**Example:**

```typescript
import { TaskManager } from "@io-orkes/conductor-javascript";

const taskManager = new TaskManager(client, workers);

// Perform sanity check
try {
  taskManager.sanityCheck();
  console.log("All workers are valid");
} catch (error) {
  console.error("Worker configuration error:", error.message);
}
```

## Type Definitions

### `ConductorWorker`
| Property | Type | Description |
| --- | --- | --- |
| `taskDefName` | `string` | The name of the task definition. |
| `execute` | `(task: Task) => Promise<Omit<TaskResult, "workflowInstanceId" \| "taskId">>` | The function that executes the task. |
| `domain` | `string` | The domain of the worker. |
| `concurrency` | `number` | The number of polling instances to run concurrently. |
| `pollInterval` | `number` | The interval in milliseconds to poll for tasks. |

### `TaskManagerConfig`
| Property | Type | Description |
| --- | --- | --- |
| `logger` | `ConductorLogger` | A logger instance. If not provided, a `DefaultLogger` will be used. |
| `options` | `Partial<TaskManagerOptions>` | The options for the `TaskManager`. |
| `onError` | `TaskErrorHandler` | A function to handle errors. If not provided, a no-op error handler will be used. |
| `maxRetries` | `number` | The maximum number of retries for a task. Defaults to 3. |

### `TaskManagerOptions`
| Property | Type | Description |
| --- | --- | --- |
| `workerID` | `string` | The ID of the worker. |
| `domain` | `string` | The domain of the worker. |
| `pollInterval` | `number` | The interval in milliseconds to poll for tasks. |
| `concurrency` | `number` | The number of polling instances to run concurrently. |
| `batchPollingTimeout` | `number` | The timeout in milliseconds for batch polling. |

### `TaskErrorHandler`
`TaskErrorHandler` is a function that takes an `Error` and an optional `Task` and handles the error.
`(error: Error, task?: Task) => void`
