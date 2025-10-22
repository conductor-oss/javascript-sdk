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

Gets human tasks by a set of filter parameters.

**Parameters:**

-   `state` (`"PENDING" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "TIMED_OUT"`): The state of the tasks to filter by.
-   `assignee` (`string`, optional): The assignee of the tasks.
-   `assigneeType` (`"EXTERNAL_USER" | "EXTERNAL_GROUP" | "CONDUCTOR_USER" | "CONDUCTOR_GROUP"`, optional): The type of the assignee.
-   `claimedBy` (`string`, optional): The user who has claimed the tasks.
-   `taskName` (`string`, optional): The name of the tasks.
-   `taskInputQuery` (`string`, optional): A query to filter tasks by their input data.
-   `taskOutputQuery` (`string`, optional): A query to filter tasks by their output data.

**Returns:**

-   `Promise<HumanTaskEntry[]>`: An array of human task entries.

---

### `search(searchParams: Partial<HumanTaskSearch>): Promise<HumanTaskEntry[]>`

Searches for human tasks.

**Parameters:**

-   `searchParams` (`Partial<HumanTaskSearch>`): The search parameters.

**Returns:**

-   `Promise<HumanTaskEntry[]>`: An array of human task entries.

---

### `pollSearch(searchParams: Partial<HumanTaskSearch>, options: PollIntervalOptions = { pollInterval: 100, maxPollTimes: 20 }): Promise<HumanTaskEntry[]>`

Polls for human tasks until a result is returned.

**Parameters:**

-   `searchParams` (`Partial<HumanTaskSearch>`): The search parameters.
-   `options` (`PollIntervalOptions`, optional): The polling options.

**Returns:**

-   `Promise<HumanTaskEntry[]>`: An array of human task entries.

---

### `getTaskById(taskId: string): Promise<HumanTaskEntry>`

Gets a human task by its ID.

**Parameters:**

-   `taskId` (`string`): The ID of the task.

**Returns:**

-   `Promise<HumanTaskEntry>`: The human task entry.

---

### `claimTaskAsExternalUser(taskId: string, assignee: string, options?: Record<string, boolean>): Promise<HumanTaskEntry>`

Claims a task as an external user.

**Parameters:**

-   `taskId` (`string`): The ID of the task.
-   `assignee` (`string`): The external user to assign the task to.
-   `options` (`Record<string, boolean>`, optional): Additional options.

**Returns:**

-   `Promise<HumanTaskEntry>`: The claimed human task entry.

---

### `claimTaskAsConductorUser(taskId: string, options?: Record<string, boolean>): Promise<HumanTaskEntry>`

Claims a task as a Conductor user.

**Parameters:**

-   `taskId` (`string`): The ID of the task.
-   `options` (`Record<string, boolean>`, optional): Additional options.

**Returns:**

-   `Promise<HumanTaskEntry>`: The claimed human task entry.

---

### `releaseTask(taskId: string): Promise<void>`

Releases a task.

**Parameters:**

-   `taskId` (`string`): The ID of the task.

**Returns:**

-   `Promise<void>`

---

### `getTemplateByNameVersion(name: string, version: number): Promise<HumanTaskTemplate>`

Gets a human task template by name and version.

**Parameters:**

-   `name` (`string`): The name of the template.
-   `version` (`number`): The version of the template.

**Returns:**

-   `Promise<HumanTaskTemplate>`: The human task template.

---

### `getTemplateById(templateNameVersionOne: string): Promise<HumanTaskTemplate>`

Gets a human task template by ID (name with version 1).

**Parameters:**

-   `templateNameVersionOne` (`string`): The name of the template.

**Returns:**

-   `Promise<HumanTaskTemplate>`: The human task template.

---

### `updateTaskOutput(taskId: string, requestBody: Record<string, Record<string, any>>): Promise<void>`

Updates the output of a task.

**Parameters:**

-   `taskId` (`string`): The ID of the task.
-   `requestBody` (`Record<string, Record<string, any>>`): The new output data.

**Returns:**

-   `Promise<void>`

---

### `completeTask(taskId: string, requestBody: Record<string, Record<string, any>> = {}): Promise<void>`

Completes a task.

**Parameters:**

-   `taskId` (`string`): The ID of the task.
-   `requestBody` (`Record<string, Record<string, any>>`, optional): The output data.

**Returns:**

-   `Promise<void>`

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
