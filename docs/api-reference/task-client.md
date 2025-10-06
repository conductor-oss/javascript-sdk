# TaskClient API Reference

The `TaskClient` provides capabilities for monitoring and debugging tasks within your workflow executions.

## Constructor

### `new TaskClient(client: ConductorClient)`

Creates a new TaskClient.

**Parameters:**

-   `client` (`ConductorClient`): An instance of `ConductorClient`.

---

## Methods

### `search(start: number, size: number, sort: string = "", freeText: string, query: string): Promise<SearchResultTask>`

Searches for tasks.

**Parameters:**

-   `start` (`number`): The starting offset.
-   `size` (`number`): The number of results to return.
-   `sort` (`string`, optional): The sort order.
-   `freeText` (`string`): The free text to search for.
-   `query` (`string`): The search query.

**Returns:**

-   `Promise<SearchResultTask>`: The search results.

---

### `getTask(taskId: string): Promise<Task>`

Gets a task by its ID.

**Parameters:**

-   `taskId` (`string`): The ID of the task.

**Returns:**

-   `Promise<Task>`: The task.

---

### `updateTaskResult(workflowId: string, taskReferenceName: string, status: TaskResultStatus, outputData: Record<string, unknown>): Promise<TaskResult>`

Updates the result of a task.

**Parameters:**

-   `workflowId` (`string`): The ID of the workflow instance.
-   `taskReferenceName` (`string`): The reference name of the task.
-   `status` (`TaskResultStatus`): The new status of the task.
-   `outputData` (`Record<string, unknown>`): The output data of the task.

**Returns:**

-   `Promise<TaskResult>`: The result of the task update.

---

## Type Definitions

### `SearchResultTask`
| Property | Type | Description |
| --- | --- | --- |
| `totalHits` | `number` | The total number of hits. |
| `results` | `Task[]` | The search results. |

### `TaskResult`
| Property | Type | Description |
| --- | --- | --- |
| `workflowInstanceId` | `string` | The ID of the workflow instance. |
| `taskId` | `string` | The ID of the task. |
| `reasonForIncompletion` | `string` | The reason for incompletion. |
| `callbackAfterSeconds` | `number` | The callback after seconds. |
| `workerId` | `string` | The ID of the worker. |
| `status` | `'IN_PROGRESS' \| 'FAILED' \| 'FAILED_WITH_TERMINAL_ERROR' \| 'COMPLETED'` | The status of the task. |
| `outputData` | `Record<string, any>` | The output data of the task. |
| `logs` | `TaskExecLog[]` | The execution logs of the task. |
| `externalOutputPayloadStoragePath`| `string` | The path to the external output payload storage. |
| `subWorkflowId` | `string` | The ID of the sub-workflow. |

### `TaskExecLog`
| Property | Type | Description |
| --- | --- | --- |
| `log` | `string` | The log message. |
| `taskId` | `string` | The ID of the task. |
| `createdTime` | `number` | The creation time of the log. |
