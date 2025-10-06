# MetadataClient API Reference

The `MetadataClient` class provides methods for managing task and workflow definitions in Conductor.

## Constructor

### `new MetadataClient(client: ConductorClient)`

Creates a new `MetadataClient`.

**Parameters:**

-   `client` (`ConductorClient`): An instance of `ConductorClient`.

---

## Methods

### `unregisterTask(name: string): Promise<void>`

Unregisters an existing task definition by name.

**Parameters:**

-   `name` (`string`): The name of the task definition.

**Returns:**

-   `Promise<void>`

---

### `registerTask(taskDef: TaskDef): Promise<void>`

Registers a new task definition.

**Parameters:**

-   `taskDef` (`TaskDef`): The task definition to register.

**Returns:**

-   `Promise<void>`

---

### `updateTask(taskDef: TaskDef): Promise<void>`

Updates an existing task definition.

**Parameters:**

-   `taskDef` (`TaskDef`): The task definition to update.

**Returns:**

-   `Promise<void>`

---

### `registerWorkflowDef(workflowDef: WorkflowDef, overwrite: boolean = false): Promise<void>`

Creates or updates a workflow definition.

**Parameters:**

-   `workflowDef` (`WorkflowDef`): The workflow definition to register.
-   `overwrite` (`boolean`, optional): Whether to overwrite an existing workflow definition. Defaults to `false`.

**Returns:**

-   `Promise<void>`

---

### `unregisterWorkflow(workflowName: string, version: number = 1): Promise<void>`

Unregisters a workflow definition.

**Parameters:**

-   `workflowName` (`string`): The name of the workflow to unregister.
-   `version` (`number`, optional): The version of the workflow to unregister. Defaults to `1`.

**Returns:**

-   `Promise<void>`

---

## Type Definitions

### `TaskDef`
| Property | Type | Description |
| --- | --- | --- |
| `ownerApp` | `string` | The owner app of the task. |
| `createTime` | `number` | The creation time of the task. |
| `updateTime` | `number` | The last update time of the task. |
| `createdBy` | `string` | The user who created the task. |
| `updatedBy` | `string` | The user who last updated the task. |
| `name` | `string` | The name of the task. |
| `description` | `string` | The description of the task. |
| `retryCount` | `number` | The retry count. |
| `timeoutSeconds` | `number` | The timeout in seconds. |
| `inputKeys` | `string[]` | The input keys of the task. |
| `outputKeys` | `string[]` | The output keys of the task. |
| `timeoutPolicy` | `'RETRY' \| 'TIME_OUT_WF' \| 'ALERT_ONLY'` | The timeout policy of the task. |
| `retryLogic` | `'FIXED' \| 'EXPONENTIAL_BACKOFF' \| 'LINEAR_BACKOFF'` | The retry logic of the task. |
| `retryDelaySeconds` | `number` | The retry delay in seconds. |
| `responseTimeoutSeconds` | `number` | The response timeout in seconds. |
| `concurrentExecLimit` | `number` | The concurrent execution limit. |
| `inputTemplate` | `Record<string, any>` | The input template of the task. |
| `rateLimitPerFrequency` | `number` | The rate limit per frequency. |
| `rateLimitFrequencyInSeconds` | `number` | The rate limit frequency in seconds. |
| `isolationGroupId` | `string` | The isolation group ID. |
| `executionNameSpace` | `string` | The execution namespace. |
| `ownerEmail` | `string` | The owner email of the task. |
| `pollTimeoutSeconds` | `number` | The poll timeout in seconds. |
| `backoffScaleFactor` | `number` | The backoff scale factor. |
