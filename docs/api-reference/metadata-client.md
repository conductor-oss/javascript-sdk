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

### `registerTask(taskDef: ExtendedTaskDef): Promise<void>`

Registers a new task definition.

**Parameters:**

-   `taskDef` (`ExtendedTaskDef`): The task definition to register.

**Returns:**

-   `Promise<void>`

**Example:**

```typescript
import { MetadataClient, taskDefinition } from "@io-orkes/conductor-javascript";

const metadataClient = new MetadataClient(client);

// Register a single task
const taskDef = taskDefinition({
  name: "email_task",
  description: "Send an email",
  ownerEmail: "dev@example.com"
});

await metadataClient.registerTask(taskDef);
```

---

### `registerTasks(taskDefs: ExtendedTaskDef[]): Promise<void>`

Registers multiple task definitions.

**Parameters:**

-   `taskDefs` (`ExtendedTaskDef[]`): Array of task definitions to register.

**Returns:**

-   `Promise<void>`

**Example:**

```typescript
import { MetadataClient, taskDefinition } from "@io-orkes/conductor-javascript";

const metadataClient = new MetadataClient(client);

// Register multiple tasks
const taskDefs = [
  taskDefinition({ name: "email_task", description: "Send email" }),
  taskDefinition({ name: "sms_task", description: "Send SMS" })
];

await metadataClient.registerTasks(taskDefs);
```

---

### `updateTask(taskDef: ExtendedTaskDef): Promise<void>`

Updates an existing task definition.

**Parameters:**

-   `taskDef` (`ExtendedTaskDef`): The task definition to update.

**Returns:**

-   `Promise<void>`

**Example:**

```typescript
import { MetadataClient, taskDefinition } from "@io-orkes/conductor-javascript";

const metadataClient = new MetadataClient(client);

// Update an existing task
const updatedTask = taskDefinition({
  name: "email_task",
  retryCount: 5,
  timeoutSeconds: 300
});

await metadataClient.updateTask(updatedTask);
```

---

### `getTask(taskName: string): Promise<TaskDef>`

Gets an existing task definition.

**Parameters:**

-   `taskName` (`string`): The name of the task definition.

**Returns:**

-   `Promise<TaskDef>`: The task definition.

**Example:**

```typescript
import { MetadataClient } from "@io-orkes/conductor-javascript";

const metadataClient = new MetadataClient(client);

// Get task definition
const taskDef = await metadataClient.getTask("email_task");
console.log(`Task timeout: ${taskDef.timeoutSeconds}`);
```

---

### `registerWorkflowDef(workflowDef: ExtendedWorkflowDef, overwrite: boolean = false): Promise<void>`

Creates or updates a workflow definition.

**Parameters:**

-   `workflowDef` (`ExtendedWorkflowDef`): The workflow definition to register.
-   `overwrite` (`boolean`, optional): Whether to overwrite an existing workflow definition. Defaults to `false`.

**Returns:**

-   `Promise<void>`

**Example:**

```typescript
import { MetadataClient, workflow } from "@io-orkes/conductor-javascript";

const metadataClient = new MetadataClient(client);

// Register a workflow
const workflowDef = workflow("email_workflow", [
  simpleTask("send_email", "email_task", { to: "user@example.com" })
]);

await metadataClient.registerWorkflowDef(workflowDef, true);
```

---

### `getWorkflowDef(name: string, version?: number, metadata: boolean = false): Promise<WorkflowDef>`

Gets an existing workflow definition.

**Parameters:**

-   `name` (`string`): The name of the workflow definition.
-   `version` (`number`, optional): The version of the workflow definition.
-   `metadata` (`boolean`, optional): Whether to include metadata. Defaults to `false`.

**Returns:**

-   `Promise<WorkflowDef>`: The workflow definition.

**Example:**

```typescript
import { MetadataClient } from "@io-orkes/conductor-javascript";

const metadataClient = new MetadataClient(client);

// Get workflow definition
const workflowDef = await metadataClient.getWorkflowDef("email_workflow", 1);
console.log(`Workflow has ${workflowDef.tasks.length} tasks`);
```

---

### `unregisterWorkflow(workflowName: string, version: number = 1): Promise<void>`

Unregisters a workflow definition.

**Parameters:**

-   `workflowName` (`string`): The name of the workflow to unregister.
-   `version` (`number`, optional): The version of the workflow to unregister. Defaults to `1`.

**Returns:**

-   `Promise<void>`

**Example:**

```typescript
import { MetadataClient } from "@io-orkes/conductor-javascript";

const metadataClient = new MetadataClient(client);

// Unregister workflow
await metadataClient.unregisterWorkflow("email_workflow", 1);
```

---

## Type Definitions

### `ExtendedTaskDef`
Extended task definition with additional SDK-specific properties.

| Property | Type | Description |
| --- | --- | --- |
| `name` | `string` | The name of the task. |
| `taskReferenceName` | `string` | The reference name of the task. |
| `description` | `string` | The description of the task. |
| `ownerEmail` | `string` | The owner email of the task. |
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
| `pollTimeoutSeconds` | `number` | The poll timeout in seconds. |
| `backoffScaleFactor` | `number` | The backoff scale factor. |

### `ExtendedWorkflowDef`
Extended workflow definition with additional SDK-specific properties.

| Property | Type | Description |
| --- | --- | --- |
| `name` | `string` | The name of the workflow. |
| `version` | `number` | The version of the workflow. |
| `description` | `string` | The description of the workflow. |
| `ownerEmail` | `string` | The owner email of the workflow. |
| `tasks` | `WorkflowTask[]` | The tasks in the workflow. |
| `inputParameters` | `string[]` | The input parameters of the workflow. |
| `outputParameters` | `Record<string, any>` | The output parameters of the workflow. |
| `timeoutSeconds` | `number` | The timeout in seconds of the workflow. |
| `timeoutPolicy` | `'TIME_OUT_WF' \| 'ALERT_ONLY'` | The timeout policy of the workflow. |
| `variables` | `Record<string, any>` | The variables of the workflow. |
| `inputTemplate` | `Record<string, any>` | The input template of the workflow. |

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

### `WorkflowDef`
| Property | Type | Description |
| --- | --- | --- |
| `ownerApp` | `string` | The owner app of the workflow. |
| `createTime` | `number` | The creation time of the workflow. |
| `updateTime` | `number` | The last update time of the workflow. |
| `createdBy` | `string` | The user who created the workflow. |
| `updatedBy` | `string` | The user who last updated the workflow. |
| `name` | `string` | The name of the workflow. |
| `description` | `string` | The description of the workflow. |
| `version` | `number` | The version of the workflow. |
| `tasks` | `WorkflowTask[]` | The tasks in the workflow. |
| `inputParameters` | `string[]` | The input parameters of the workflow. |
| `outputParameters` | `Record<string, any>` | The output parameters of the workflow. |
| `failureWorkflow` | `string` | The failure workflow. |
| `schemaVersion` | `number` | The schema version of the workflow. |
| `restartable` | `boolean` | Whether the workflow is restartable. |
| `workflowStatusListenerEnabled` | `boolean` | Whether the workflow status listener is enabled. |
| `ownerEmail` | `string` | The owner email of the workflow. |
| `timeoutPolicy` | `'TIME_OUT_WF' \| 'ALERT_ONLY'` | The timeout policy of the workflow. |
| `timeoutSeconds` | `number` | The timeout in seconds of the workflow. |
| `variables` | `Record<string, any>` | The variables of the workflow. |
| `inputTemplate` | `Record<string, any>` | The input template of the workflow. |
