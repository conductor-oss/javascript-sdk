# TaskManager API Reference

The `TaskManager` is responsible for initializing and managing the runners that poll and work different task queues.

## Constructor

### `new TaskManager(client: ConductorClient, workers: Array<ConductorWorker>, config: TaskManagerConfig = {})`

Creates a new TaskManager.

**Parameters:**

-   `client` (`ConductorClient`): An instance of `ConductorClient`.
-   `workers` (`Array<ConductorWorker>`): An array of `ConductorWorker` instances.
-   `config` (`TaskManagerConfig`, optional): Configuration for the `TaskManager`.

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

---

### `updatePollingOptions(options: Partial<TaskManagerOptions>): void`

Updates the polling options for all workers.

**Parameters:**

-   `options` (`Partial<TaskManagerOptions>`): The new polling options.

---

### `startPolling(): void`

Starts polling for tasks for all workers.

---

### `stopPolling(): Promise<void>`

Stops polling for tasks for all workers.

---

### `sanityCheck(): void`

Performs a sanity check on the workers, ensuring there are no duplicates and that at least one worker is present. Throws an error if the check fails.

---

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
| `logger` | `ConductorLogger` | A logger instance. |
| `options` | `Partial<TaskManagerOptions>` | The options for the `TaskManager`. |
| `onError` | `TaskErrorHandler` | A function to handle errors. |
| `maxRetries` | `number` | The maximum number of retries for a task. |

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
