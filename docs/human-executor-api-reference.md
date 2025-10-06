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
