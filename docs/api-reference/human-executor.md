# HumanExecutor API Reference

The `HumanExecutor` class provides comprehensive human task management.

## Constructor

### `new HumanExecutor(client: ConductorClient)`

Creates a new `HumanExecutor`.

**Parameters:**

-   `client` (`ConductorClient`): An instance of `ConductorClient`.

---

## Methods

### `getTasksByFilter(state: "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "TIMED_OUT", assignee?: string, assigneeType?: "EXTERNAL_USER" | "EXTERNAL_GROUP" | "CONDUCTOR_USER" | "CONDUCTOR_GROUP", claimedBy?: string, taskName?: string, taskInputQuery?: string, taskOutputQuery?: string): Promise<HumanTaskEntry[]>`

**⚠️ DEPRECATED**: Use `search()` method instead.

Gets human tasks by a set of filter parameters.

**Parameters:**

-   `state` (`"PENDING" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "TIMED_OUT"`): The state of the tasks to filter by.
-   `assignee` (`string`, optional): The assignee of the tasks.
-   `assigneeType` (`"EXTERNAL_USER" | "EXTERNAL_GROUP" | "CONDUCTOR_USER" | "CONDUCTOR_GROUP"`, optional): The type of the assignee.
-   `claimedBy` (`string`, optional): The user who has claimed the tasks (format: `<userType>:<user>`).
-   `taskName` (`string`, optional): The name of the tasks.
-   `taskInputQuery` (`string`, optional): A query to filter tasks by their input data.
-   `taskOutputQuery` (`string`, optional): A query to filter tasks by their output data.

**Returns:**

-   `Promise<HumanTaskEntry[]>`: An array of human task entries.

---

### `search(searchParams: Partial<HumanTaskSearch>): Promise<HumanTaskEntry[]>`

Searches for human tasks using flexible search parameters.

**Parameters:**

-   `searchParams` (`Partial<HumanTaskSearch>`): The search parameters.

**Returns:**

-   `Promise<HumanTaskEntry[]>`: An array of human task entries.

**Example:**

```typescript
import { HumanExecutor } from "@io-orkes/conductor-javascript";

const humanExecutor = new HumanExecutor(client);

// Search for pending tasks
const pendingTasks = await humanExecutor.search({
  states: ["PENDING"],
  definitionNames: ["approval_task"],
  size: 20
});

console.log(`Found ${pendingTasks.length} pending tasks`);
```

---

### `pollSearch(searchParams: Partial<HumanTaskSearch>, options: PollIntervalOptions = { pollInterval: 100, maxPollTimes: 20 }): Promise<HumanTaskEntry[]>`

Polls for human tasks until a result is returned or maximum poll attempts are reached.

**Parameters:**

-   `searchParams` (`Partial<HumanTaskSearch>`): The search parameters.
-   `options` (`PollIntervalOptions`, optional): The polling options.

**Returns:**

-   `Promise<HumanTaskEntry[]>`: An array of human task entries.

**Example:**

```typescript
import { HumanExecutor } from "@io-orkes/conductor-javascript";

const humanExecutor = new HumanExecutor(client);

// Poll for new tasks
const newTasks = await humanExecutor.pollSearch(
  { states: ["PENDING"] },
  { pollInterval: 500, maxPollTimes: 10 }
);

if (newTasks.length > 0) {
  console.log(`Found ${newTasks.length} new tasks to process`);
}
```

---

### `getTaskById(taskId: string): Promise<HumanTaskEntry>`

Gets a human task by its ID.

**Parameters:**

-   `taskId` (`string`): The ID of the task.

**Returns:**

-   `Promise<HumanTaskEntry>`: The human task entry.

**Example:**

```typescript
import { HumanExecutor } from "@io-orkes/conductor-javascript";

const humanExecutor = new HumanExecutor(client);

// Get specific task details
const task = await humanExecutor.getTaskById("task_123");
console.log(`Task ${task.taskId} is ${task.state}`);
```

---

### `claimTaskAsExternalUser(taskId: string, assignee: string, options?: Record<string, boolean>): Promise<HumanTaskEntry>`

Claims a task as an external user.

**Parameters:**

-   `taskId` (`string`): The ID of the task.
-   `assignee` (`string`): The external user to assign the task to.
-   `options` (`Record<string, boolean>`, optional): Additional options including `overrideAssignment` and `withTemplate`.

**Returns:**

-   `Promise<HumanTaskEntry>`: The claimed human task entry.

**Example:**

```typescript
import { HumanExecutor } from "@io-orkes/conductor-javascript";

const humanExecutor = new HumanExecutor(client);

// Claim task as external user
const claimedTask = await humanExecutor.claimTaskAsExternalUser(
  "task_123",
  "user@example.com",
  { overrideAssignment: false, withTemplate: true }
);

console.log(`Task claimed by ${claimedTask.claimant?.user}`);
```

---

### `claimTaskAsConductorUser(taskId: string, options?: Record<string, boolean>): Promise<HumanTaskEntry>`

Claims a task as a Conductor user.

**Parameters:**

-   `taskId` (`string`): The ID of the task.
-   `options` (`Record<string, boolean>`, optional): Additional options including `overrideAssignment` and `withTemplate`.

**Returns:**

-   `Promise<HumanTaskEntry>`: The claimed human task entry.

**Example:**

```typescript
import { HumanExecutor } from "@io-orkes/conductor-javascript";

const humanExecutor = new HumanExecutor(client);

// Claim task as conductor user
const claimedTask = await humanExecutor.claimTaskAsConductorUser(
  "task_123",
  { overrideAssignment: false, withTemplate: true }
);

console.log(`Task claimed by conductor user`);
```

---

### `releaseTask(taskId: string): Promise<void>`

Releases a claimed task.

**Parameters:**

-   `taskId` (`string`): The ID of the task.

**Returns:**

-   `Promise<void>`

**Example:**

```typescript
import { HumanExecutor } from "@io-orkes/conductor-javascript";

const humanExecutor = new HumanExecutor(client);

// Release a task
await humanExecutor.releaseTask("task_123");
console.log("Task released");
```

---

### `getTemplateByNameVersion(name: string, version: number): Promise<HumanTaskTemplate>`

Gets a human task template by name and version.

**Parameters:**

-   `name` (`string`): The name of the template.
-   `version` (`number`): The version of the template.

**Returns:**

-   `Promise<HumanTaskTemplate>`: The human task template.

**Example:**

```typescript
import { HumanExecutor } from "@io-orkes/conductor-javascript";

const humanExecutor = new HumanExecutor(client);

// Get template details
const template = await humanExecutor.getTemplateByNameVersion("approval_form", 1);
console.log(`Template version: ${template.version}`);
```

---

### `getTemplateById(templateNameVersionOne: string): Promise<HumanTaskTemplate>`

**⚠️ DEPRECATED**: Use `getTemplateByNameVersion()` instead.

Gets a human task template by ID (name with version 1).

**Parameters:**

-   `templateNameVersionOne` (`string`): The name of the template.

**Returns:**

-   `Promise<HumanTaskTemplate>`: The human task template.

---

### `updateTaskOutput(taskId: string, requestBody: Record<string, Record<string, unknown>>): Promise<void>`

Updates the output of a task without completing it.

**Parameters:**

-   `taskId` (`string`): The ID of the task.
-   `requestBody` (`Record<string, Record<string, unknown>>`): The new output data.

**Returns:**

-   `Promise<void>`

**Example:**

```typescript
import { HumanExecutor } from "@io-orkes/conductor-javascript";

const humanExecutor = new HumanExecutor(client);

// Update task output
await humanExecutor.updateTaskOutput("task_123", {
  output: {
    status: "in_progress",
    comments: "Working on approval"
  }
});
```

---

### `completeTask(taskId: string, requestBody: Record<string, Record<string, unknown>> = {}): Promise<void>`

Completes a task with the provided output data.

**Parameters:**

-   `taskId` (`string`): The ID of the task.
-   `requestBody` (`Record<string, Record<string, unknown>>`, optional): The output data.

**Returns:**

-   `Promise<void>`

**Example:**

```typescript
import { HumanExecutor } from "@io-orkes/conductor-javascript";

const humanExecutor = new HumanExecutor(client);

// Complete task
await humanExecutor.completeTask("task_123", {
  output: {
    approved: true,
    finalComments: "Approved with minor changes"
  }
});

console.log("Task completed");
```

---

## Type Definitions

### `HumanTaskEntry`
| Property | Type | Description |
| --- | --- | --- |
| `assignee` | `HumanTaskUser` | The user assigned to the task. |
| `claimant`| `HumanTaskUser` | The user who has claimed the task. |
| `createdBy` | `string` | The user who created the task. |
| `createdOn` | `number` | The time the task was created. |
| `definitionName`| `string` | The name of the task definition. |
| `displayName` | `string` | The display name of the task. |
| `humanTaskDef`| `HumanTaskDefinition` | The task definition. |
| `input` | `Record<string, any>` | The input data for the task. |
| `output`| `Record<string, any>` | The output data for the task. |
| `state` | `'PENDING' \| 'ASSIGNED' \| 'IN_PROGRESS' \| 'COMPLETED' \| 'TIMED_OUT' \| 'DELETED'` | The state of the task. |
| `taskId`| `string` | The ID of the task. |
| `taskRefName` | `string` | The reference name of the task. |
| `updatedBy` | `string` | The user who last updated the task. |
| `updatedOn` | `number` | The time the task was last updated. |
| `workflowId`| `string` | The ID of the workflow instance. |
| `workflowName`| `string` | The name of the workflow. |

### `HumanTaskUser`
| Property | Type | Description |
| --- | --- | --- |
| `user` | `string` | The user or group ID. |
| `userType`| `'EXTERNAL_USER' \| 'EXTERNAL_GROUP' \| 'CONDUCTOR_USER' \| 'CONDUCTOR_GROUP'` | The type of the user. |

### `HumanTaskDefinition`
| Property | Type | Description |
| --- | --- | --- |
| `assignmentCompletionStrategy` | `'LEAVE_OPEN' \| 'TERMINATE'` | The strategy for completing the assignment. |
| `assignments` | `HumanTaskAssignment[]` | A list of assignments for the task. |
| `taskTriggers` | `HumanTaskTrigger[]` | A list of triggers for the task. |
| `userFormTemplate` | `UserFormTemplate` | The user form template for the task. |

### `HumanTaskAssignment`
| Property | Type | Description |
| --- | --- | --- |
| `assignee` | `HumanTaskUser` | The user or group assigned to the task. |
| `slaMinutes` | `number` | The service level agreement in minutes. |

### `HumanTaskTrigger`
| Property | Type | Description |
| --- | --- | --- |
| `startWorkflowRequest` | `StartWorkflowRequest` | The request to start a workflow. |
| `triggerType` | `'ASSIGNEE_CHANGED' \| 'PENDING' \| 'IN_PROGRESS' \| 'ASSIGNED' \| 'COMPLETED' \| 'TIMED_OUT'` | The type of the trigger. |

### `UserFormTemplate`
| Property | Type | Description |
| --- | --- | --- |
| `name` | `string` | The name of the template. |
| `version` | `number` | The version of the template. |

### `StartWorkflowRequest`
| Property | Type | Description |
| --- | --- | --- |
| `name` | `string` | The name of the workflow. |
| `version` | `number` | The version of the workflow. |
| `correlationId` | `string` | The correlation ID of the workflow. |
| `input` | `Record<string, any>` | The input data for the workflow. |
| `taskToDomain` | `Record<string, string>` | A map of task reference names to domains. |
| `workflowDef` | `WorkflowDef` | The workflow definition. |
| `externalInputPayloadStoragePath`| `string` | The path to the external input payload storage. |
| `idempotencyKey` | `string` | The idempotency key for the workflow. |
| `idempotencyStrategy` | `'FAIL' \| 'RETURN_EXISTING'` | The idempotency strategy for the workflow. |
| `priority` | `number` | The priority of the workflow. |
| `createdBy` | `string` | The user who created the workflow. |

### `HumanTaskSearch`
| Property | Type | Description |
| --- | --- | --- |
| `size` | `number` | The number of results to return. |
| `states` | `string[]` | A list of states to filter by. |
| `taskInputQuery` | `string` | A query to filter tasks by their input data. |
| `taskOutputQuery` | `string` | A query to filter tasks by their output data. |
| `definitionNames` | `string[]` | A list of task definition names to filter by. |
| `taskRefNames` | `string[]` | A list of task reference names to filter by. |
| `claimants` | `HumanTaskUser[]` | A list of claimants to filter by. |
| `assignees` | `HumanTaskUser[]` | A list of assignees to filter by. |
| `start` | `number` | The starting offset. |

### `PollIntervalOptions`
| Property | Type | Description |
| --- | --- | --- |
| `pollInterval` | `number` | The interval in milliseconds to poll for tasks. |
| `maxPollTimes` | `number` | The maximum number of times to poll for tasks. |

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
