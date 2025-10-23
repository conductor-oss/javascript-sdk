# TaskClient API Reference

The `TaskClient` provides capabilities for monitoring and debugging tasks within your workflow executions.

## Constructor

### `new TaskClient(client: Client)`

Creates a new TaskClient.

**Parameters:**

-   `client` (`Client`): An instance of `Client`.

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
| `correlationId` | `string` | The correlation ID of the workflow. |
| `endTime` | `string` | The end time of the task. |
| `executionTime` | `number` | The execution time of the task. |
| `externalInputPayloadStoragePath` | `string` | The path to external input payload storage. |
| `externalOutputPayloadStoragePath` | `string` | The path to external output payload storage. |
| `input` | `string` | The input data for the task (JSON string). |
| `output` | `string` | The output data for the task (JSON string). |
| `queueWaitTime` | `number` | The queue wait time. |
| `reasonForIncompletion` | `string` | The reason for incompletion. |
| `scheduledTime` | `string` | The scheduled time of the task. |
| `startTime` | `string` | The start time of the task. |
| `status` | `'IN_PROGRESS' \| 'CANCELED' \| 'FAILED' \| 'FAILED_WITH_TERMINAL_ERROR' \| 'COMPLETED' \| 'COMPLETED_WITH_ERRORS' \| 'SCHEDULED' \| 'TIMED_OUT' \| 'SKIPPED'` | The status of the task. |
| `taskDefName` | `string` | The name of the task definition. |
| `taskId` | `string` | The ID of the task. |
| `taskReferenceName` | `string` | The reference name of the task. |
| `taskType` | `string` | The type of the task. |
| `updateTime` | `string` | The last update time of the task. |
| `workflowId` | `string` | The ID of the workflow instance. |
| `workflowPriority` | `number` | The priority of the workflow. |
| `workflowType` | `string` | The type of the workflow. |

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
| `callbackAfterSeconds` | `number` | The callback after seconds. |
| `callbackFromWorker` | `boolean` | Whether the callback is from a worker. |
| `correlationId` | `string` | The correlation ID of the task. |
| `domain` | `string` | The domain of the task. |
| `endTime` | `number` | The end time of the task. |
| `executed` | `boolean` | Whether the task was executed. |
| `executionNameSpace` | `string` | The execution namespace. |
| `externalInputPayloadStoragePath` | `string` | The path to the external input payload storage. |
| `externalOutputPayloadStoragePath` | `string` | The path to the external output payload storage. |
| `firstStartTime` | `number` | The first start time of the task. |
| `inputData` | `Record<string, any>` | The input data for the task. |
| `isolationGroupId` | `string` | The isolation group ID. |
| `iteration` | `number` | The iteration number. |
| `loopOverTask` | `boolean` | Whether the task is a loop over task. |
| `outputData` | `Record<string, any>` | The output data of the task. |
| `parentTaskId` | `string` | The ID of the parent task. |
| `pollCount` | `number` | The poll count. |
| `queueWaitTime` | `number` | The queue wait time. |
| `rateLimitFrequencyInSeconds` | `number` | The rate limit frequency in seconds. |
| `rateLimitPerFrequency` | `number` | The rate limit per frequency. |
| `reasonForIncompletion` | `string` | The reason for incompletion. |
| `referenceTaskName` | `string` | The reference name of the task. |
| `responseTimeoutSeconds` | `number` | The response timeout in seconds. |
| `retried` | `boolean` | Whether the task was retried. |
| `retriedTaskId` | `string` | The ID of the retried task. |
| `retryCount` | `number` | The retry count. |
| `scheduledTime` | `number` | The scheduled time of the task. |
| `seq` | `number` | The sequence number of the task. |
| `startDelayInSeconds` | `number` | The start delay in seconds. |
| `startTime` | `number` | The start time of the task. |
| `status` | `'IN_PROGRESS' \| 'CANCELED' \| 'FAILED' \| 'FAILED_WITH_TERMINAL_ERROR' \| 'COMPLETED' \| 'COMPLETED_WITH_ERRORS' \| 'SCHEDULED' \| 'TIMED_OUT' \| 'SKIPPED'` | The status of the task. |
| `subWorkflowId` | `string` | The ID of the sub-workflow. |
| `subworkflowChanged` | `boolean` | Whether the sub-workflow was changed. |
| `taskDefName` | `string` | The name of the task definition. |
| `taskDefinition` | `TaskDef` | The task definition. |
| `taskId` | `string` | The ID of the task. |
| `taskType` | `string` | The type of the task. |
| `updateTime` | `number` | The last update time of the task. |
| `workflowInstanceId` | `string` | The ID of the workflow instance. |
| `workflowPriority` | `number` | The priority of the workflow. |
| `workflowTask` | `WorkflowTask` | The workflow task definition. |
| `workflowType` | `string` | The type of the workflow. |
| `workerId` | `string` | The ID of the worker. |
