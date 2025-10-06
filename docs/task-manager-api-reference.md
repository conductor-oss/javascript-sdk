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
