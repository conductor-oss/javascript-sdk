# TaskClient API Reference

The `TaskClient` provides capabilities for monitoring and debugging tasks within your workflow executions.

## Constructor

### `new TaskClient(client: ConductorClient)`

Creates a new TaskClient.

**Parameters:**

-   `client` (`ConductorClient`): An instance of `ConductorClient`.

---

## Methods

### `search(start: number, size: number, sort: string = "", freeText: string, query: string): Promise<SearchResultTaskSummary>`

Searches for tasks.

**Parameters:**

-   `start` (`number`): The starting offset.
-   `size` (`number`): The number of results to return.
-   `sort` (`string`, optional): The sort order. Defaults to `""`.
-   `freeText` (`string`): The free text to search for.
-   `query` (`string`): The search query.

**Returns:**

-   `Promise<SearchResultTaskSummary>`: The search results.

**Example:**

```typescript
import { TaskClient } from "@io-orkes/conductor-javascript";

const taskClient = new TaskClient(client);

// Search for failed tasks
const failedTasks = await taskClient.search(
  0,
  100,
  "startTime:DESC",
  "*",
  "status:FAILED"
);

console.log(`Found ${failedTasks.totalHits} failed tasks`);
```

---

### `getTask(taskId: string): Promise<Task>`

Gets a task by its ID.

**Parameters:**

-   `taskId` (`string`): The ID of the task.

**Returns:**

-   `Promise<Task>`: The task details.

**Example:**

```typescript
import { TaskClient } from "@io-orkes/conductor-javascript";

const taskClient = new TaskClient(client);

// Get task details
const task = await taskClient.getTask("task_123");
console.log(`Task ${task.taskId} status: ${task.status}`);
```

---

### `updateTaskResult(workflowId: string, taskRefName: string, status: TaskResultStatus, outputData: Record<string, unknown>): Promise<string>`

Updates the result of a task.

**Parameters:**

-   `workflowId` (`string`): The ID of the workflow instance.
-   `taskRefName` (`string`): The reference name of the task.
-   `status` (`TaskResultStatus`): The new status of the task.
-   `outputData` (`Record<string, unknown>`): The output data of the task.

**Returns:**

-   `Promise<string>`: The ID of the updated task.

**Example:**

```typescript
import { TaskClient, TaskResultStatus } from "@io-orkes/conductor-javascript";

const taskClient = new TaskClient(client);

// Update task result
const taskId = await taskClient.updateTaskResult(
  "workflow_123",
  "process_data_ref",
  TaskResultStatus.COMPLETED,
  { result: "success", processed: true }
);

console.log(`Updated task: ${taskId}`);
```

---

## Type Definitions

### `SearchResultTaskSummary`
| Property | Type | Description |
| --- | --- | --- |
| `totalHits` | `number` | The total number of hits. |
| `results` | `TaskSummary[]` | The search results. |

### `TaskSummary`
| Property | Type | Description |
| --- | --- | --- |
| `workflowId` | `string` | The ID of the workflow instance. |
| `workflowType` | `string` | The type of the workflow. |
| `correlationId` | `string` | The correlation ID of the workflow. |
| `scheduledTime` | `number` | The scheduled time of the task. |
| `startTime` | `number` | The start time of the task. |
| `updateTime` | `number` | The last update time of the task. |
| `endTime` | `number` | The end time of the task. |
| `status` | `string` | The status of the task. |
| `reasonForIncompletion` | `string` | The reason for incompletion. |
| `workerId` | `string` | The ID of the worker. |
| `taskDefName` | `string` | The name of the task definition. |
| `taskId` | `string` | The ID of the task. |
| `taskRefName` | `string` | The reference name of the task. |
| `taskType` | `string` | The type of the task. |
| `input` | `Record<string, any>` | The input data for the task. |
| `output` | `Record<string, any>` | The output data for the task. |
| `logs` | `TaskExecLog[]` | The execution logs of the task. |

### `TaskResultStatus`
Task result status type derived from the TaskResult status field. Represents the possible status values for a task.

```typescript
type TaskResultStatus = "IN_PROGRESS" | "FAILED" | "FAILED_WITH_TERMINAL_ERROR" | "COMPLETED"
```

**Status Values:**
- `"IN_PROGRESS"` - Task is currently running
- `"FAILED"` - Task failed but can be retried
- `"FAILED_WITH_TERMINAL_ERROR"` - Task failed and cannot be retried
- `"COMPLETED"` - Task completed successfully

### `TaskExecLog`
| Property | Type | Description |
| --- | --- | --- |
| `log` | `string` | The log message. |
| `taskId` | `string` | The ID of the task. |
| `createdTime` | `number` | The creation time of the log. |

### `TaskDef`
| Property | Type | Description |
| --- | --- | --- |
| `name` | `string` | The name of the task. |
| `timeoutSeconds` | `number` | The timeout in seconds. |
| `totalTimeoutSeconds` | `number` | The total timeout in seconds. |
| `description` | `string` | The description of the task. |
| `retryCount` | `number` | The retry count. |
| `retryLogic` | `'FIXED' \| 'EXPONENTIAL_BACKOFF' \| 'LINEAR_BACKOFF'` | The retry logic of the task. |
| `retryDelaySeconds` | `number` | The retry delay in seconds. |
| `timeoutPolicy` | `'RETRY' \| 'TIME_OUT_WF' \| 'ALERT_ONLY'` | The timeout policy of the task. |
| `responseTimeoutSeconds` | `number` | The response timeout in seconds. |
| `inputKeys` | `string[]` | The input keys of the task. |
| `outputKeys` | `string[]` | The output keys of the task. |
| `inputTemplate` | `Record<string, any>` | The input template of the task. |
| `concurrentExecLimit` | `number` | The concurrent execution limit. |
| `rateLimitPerFrequency` | `number` | The rate limit per frequency. |
| `rateLimitFrequencyInSeconds` | `number` | The rate limit frequency in seconds. |
| `isolationGroupId` | `string` | The isolation group ID. |
| `executionNameSpace` | `string` | The execution namespace. |
| `ownerApp` | `string` | The owner app of the task. |
| `ownerEmail` | `string` | The owner email of the task. |
| `pollTimeoutSeconds` | `number` | The poll timeout in seconds. |
| `backoffScaleFactor` | `number` | The backoff scale factor. |
| `baseType` | `string` | The base type of the task. |
| `enforceSchema` | `boolean` | Whether to enforce schema validation. |
| `inputSchema` | `SchemaDef` | The input schema definition. |
| `outputSchema` | `SchemaDef` | The output schema definition. |
| `createTime` | `number` | The creation time of the task. |
| `updateTime` | `number` | The last update time of the task. |
| `createdBy` | `string` | The user who created the task. |
| `updatedBy` | `string` | The user who last updated the task. |

### `Task`
| Property | Type | Description |
| --- | --- | --- |
| `taskType` | `string` | The type of the task. |
| `status` | `'IN_PROGRESS' \| 'CANCELED' \| 'FAILED' \| 'FAILED_WITH_TERMINAL_ERROR' \| 'COMPLETED' \| 'COMPLETED_WITH_ERRORS' \| 'SCHEDULED' \| 'TIMED_OUT' \| 'SKIPPED'` | The status of the task. |
| `inputData` | `Record<string, any>` | The input data for the task. |
| `referenceTaskName` | `string` | The reference name of the task. |
| `retryCount` | `number` | The retry count. |
| `seq` | `number` | The sequence number of the task. |
| `correlationId` | `string` | The correlation ID of the task. |
| `pollCount` | `number` | The poll count. |
| `taskDefName` | `string` | The name of the task definition. |
| `scheduledTime` | `number` | The scheduled time of the task. |
| `startTime` | `number` | The start time of the task. |
| `endTime` | `number` | The end time of the task. |
| `updateTime` | `number` | The last update time of the task. |
| `startDelayInSeconds` | `number` | The start delay in seconds. |
| `retriedTaskId` | `string` | The ID of the retried task. |
| `retried` | `boolean` | Whether the task was retried. |
| `executed` | `boolean` | Whether the task was executed. |
| `callbackFromWorker` | `boolean` | Whether the callback is from a worker. |
| `responseTimeoutSeconds` | `number` | The response timeout in seconds. |
| `workflowInstanceId` | `string` | The ID of the workflow instance. |
| `workflowType` | `string` | The type of the workflow. |
| `taskId` | `string` | The ID of the task. |
| `reasonForIncompletion` | `string` | The reason for incompletion. |
| `callbackAfterSeconds` | `number` | The callback after seconds. |
| `workerId` | `string` | The ID of the worker. |
| `outputData` | `Record<string, any>` | The output data of the task. |
| `domain` | `string` | The domain of the task. |
| `rateLimitPerFrequency` | `number` | The rate limit per frequency. |
| `rateLimitFrequencyInSeconds` | `number` | The rate limit frequency in seconds. |
| `externalInputPayloadStoragePath`| `string` | The path to the external input payload storage. |
| `externalOutputPayloadStoragePath`| `string` | The path to the external output payload storage. |
| `workflowPriority` | `number` | The priority of the workflow. |
| `executionNameSpace` | `string` | The execution namespace. |
| `isolationGroupId` | `string` | The isolation group ID. |
| `iteration` | `number` | The iteration number. |
| `subWorkflowId` | `string` | The ID of the sub-workflow. |
| `subworkflowChanged` | `boolean` | Whether the sub-workflow was changed. |
| `queueWaitTime` | `number` | The queue wait time. |
| `taskDefinition` | `TaskDef` | The task definition. |
| `loopOverTask` | `boolean` | Whether the task is a loop over task. |
