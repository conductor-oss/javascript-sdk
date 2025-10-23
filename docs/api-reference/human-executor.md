# HumanExecutor API Reference

The `HumanExecutor` class provides comprehensive human task management.

## Constructor

### `new HumanExecutor(client: Client)`

Creates a new `HumanExecutor`.

**Parameters:**

- `client` (`Client`): An instance of `Client`.

---

## Methods

### `getTasksByFilter(state: "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "TIMED_OUT", assignee?: string, assigneeType?: "EXTERNAL_USER" | "EXTERNAL_GROUP" | "CONDUCTOR_USER" | "CONDUCTOR_GROUP", claimedBy?: string, taskName?: string, taskInputQuery?: string, taskOutputQuery?: string): Promise<HumanTaskEntry[]>`

**⚠️ DEPRECATED**: Use `search()` method instead.

Gets human tasks by a set of filter parameters.

**Parameters:**

- `state` (`"PENDING" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "TIMED_OUT"`): The state of the tasks to filter by.
- `assignee` (`string`, optional): The assignee of the tasks.
- `assigneeType` (`"EXTERNAL_USER" | "EXTERNAL_GROUP" | "CONDUCTOR_USER" | "CONDUCTOR_GROUP"`, optional): The type of the assignee.
- `claimedBy` (`string`, optional): The user who has claimed the tasks (format: `<userType>:<user>`).
- `taskName` (`string`, optional): The name of the tasks.
- `taskInputQuery` (`string`, optional): A query to filter tasks by their input data.
- `taskOutputQuery` (`string`, optional): A query to filter tasks by their output data.

**Returns:**

- `Promise<HumanTaskEntry[]>`: An array of human task entries.

---

### `search(searchParams: Partial<HumanTaskSearch>): Promise<HumanTaskEntry[]>`

Searches for human tasks using flexible search parameters.

**Parameters:**

- `searchParams` (`Partial<HumanTaskSearch>`): The search parameters.

**Returns:**

- `Promise<HumanTaskEntry[]>`: An array of human task entries.

**Example:**

```typescript
import { HumanExecutor } from "@io-orkes/conductor-javascript";

const humanExecutor = new HumanExecutor(client);

// Search for pending tasks
const pendingTasks = await humanExecutor.search({
  states: ["PENDING"],
  definitionNames: ["approval_task"],
  size: 20,
});

console.log(`Found ${pendingTasks.length} pending tasks`);
```

---

### `pollSearch(searchParams: Partial<HumanTaskSearch>, options: PollIntervalOptions = { pollInterval: 100, maxPollTimes: 20 }): Promise<HumanTaskEntry[]>`

Polls for human tasks until a result is returned or maximum poll attempts are reached.

**Parameters:**

- `searchParams` (`Partial<HumanTaskSearch>`): The search parameters.
- `options` (`PollIntervalOptions`, optional): The polling options.

**Returns:**

- `Promise<HumanTaskEntry[]>`: An array of human task entries.

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

- `taskId` (`string`): The ID of the task.

**Returns:**

- `Promise<HumanTaskEntry>`: The human task entry.

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

- `taskId` (`string`): The ID of the task.
- `assignee` (`string`): The external user to assign the task to.
- `options` (`Record<string, boolean>`, optional): Additional options including `overrideAssignment` and `withTemplate`.

**Returns:**

- `Promise<HumanTaskEntry>`: The claimed human task entry.

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

- `taskId` (`string`): The ID of the task.
- `options` (`Record<string, boolean>`, optional): Additional options including `overrideAssignment` and `withTemplate`.

**Returns:**

- `Promise<HumanTaskEntry>`: The claimed human task entry.

**Example:**

```typescript
import { HumanExecutor } from "@io-orkes/conductor-javascript";

const humanExecutor = new HumanExecutor(client);

// Claim task as conductor user
const claimedTask = await humanExecutor.claimTaskAsConductorUser("task_123", {
  overrideAssignment: false,
  withTemplate: true,
});

console.log(`Task claimed by conductor user`);
```

---

### `releaseTask(taskId: string): Promise<void>`

Releases a claimed task.

**Parameters:**

- `taskId` (`string`): The ID of the task.

**Returns:**

- `Promise<void>`

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

- `name` (`string`): The name of the template.
- `version` (`number`): The version of the template.

**Returns:**

- `Promise<HumanTaskTemplate>`: The human task template.

**Example:**

```typescript
import { HumanExecutor } from "@io-orkes/conductor-javascript";

const humanExecutor = new HumanExecutor(client);

// Get template details
const template = await humanExecutor.getTemplateByNameVersion(
  "approval_form",
  1
);
console.log(`Template version: ${template.version}`);
```

---

### `getTemplateById(templateNameVersionOne: string): Promise<HumanTaskTemplate>`

**⚠️ DEPRECATED**: Use `getTemplateByNameVersion()` instead.

Gets a human task template by ID (name with version 1).

**Parameters:**

- `templateNameVersionOne` (`string`): The name of the template.

**Returns:**

- `Promise<HumanTaskTemplate>`: The human task template.

---

### `updateTaskOutput(taskId: string, requestBody: Record<string, Record<string, unknown>>): Promise<void>`

Updates the output of a task without completing it.

**Parameters:**

- `taskId` (`string`): The ID of the task.
- `requestBody` (`Record<string, Record<string, unknown>>`): The new output data.

**Returns:**

- `Promise<void>`

**Example:**

```typescript
import { HumanExecutor } from "@io-orkes/conductor-javascript";

const humanExecutor = new HumanExecutor(client);

// Update task output
await humanExecutor.updateTaskOutput("task_123", {
  output: {
    status: "in_progress",
    comments: "Working on approval",
  },
});
```

---

### `completeTask(taskId: string, requestBody: Record<string, Record<string, unknown>> = {}): Promise<void>`

Completes a task with the provided output data.

**Parameters:**

- `taskId` (`string`): The ID of the task.
- `requestBody` (`Record<string, Record<string, unknown>>`, optional): The output data.

**Returns:**

- `Promise<void>`

**Example:**

```typescript
import { HumanExecutor } from "@io-orkes/conductor-javascript";

const humanExecutor = new HumanExecutor(client);

// Complete task
await humanExecutor.completeTask("task_123", {
  output: {
    approved: true,
    finalComments: "Approved with minor changes",
  },
});

console.log("Task completed");
```

---

## Type Definitions

### `HumanTaskEntry`

```typescript
export type HumanTaskEntry = {
  assignee?: HumanTaskUser;
  claimant?: HumanTaskUser;
  createdBy?: string;
  createdOn?: number;
  definitionName?: string;
  displayName?: string;
  humanTaskDef?: HumanTaskDefinition;
  input?: {
    [key: string]: unknown;
  };
  output?: {
    [key: string]: unknown;
  };
  ownerApp?: string;
  state?:
    | "PENDING"
    | "ASSIGNED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "TIMED_OUT"
    | "DELETED";
  taskId?: string;
  taskRefName?: string;
  updatedBy?: string;
  updatedOn?: number;
  workflowId?: string;
  workflowName?: string;
};
```

### `HumanTaskUser`

```typescript
export type HumanTaskUser = {
  user?: string;
  userType?:
    | "EXTERNAL_USER"
    | "EXTERNAL_GROUP"
    | "CONDUCTOR_USER"
    | "CONDUCTOR_GROUP";
};
```

### `HumanTaskDefinition`

```typescript
export type HumanTaskDefinition = {
  assignmentCompletionStrategy?: "LEAVE_OPEN" | "TERMINATE";
  assignments?: Array<HumanTaskAssignment>;
  displayName?: string;
  fullTemplate?: HumanTaskTemplate;
  taskTriggers?: Array<HumanTaskTrigger>;
  userFormTemplate?: UserFormTemplate;
};
```

### `HumanTaskAssignment`

```typescript
export type HumanTaskAssignment = {
  assignee?: HumanTaskUser;
  slaMinutes?: number;
};
```

### `HumanTaskTrigger`

```typescript
export type HumanTaskTrigger = {
  startWorkflowRequest?: StartWorkflowRequest;
  triggerType?:
    | "ASSIGNEE_CHANGED"
    | "CLAIMANT_CHANGED"
    | "PENDING"
    | "IN_PROGRESS"
    | "ASSIGNED"
    | "COMPLETED"
    | "TIMED_OUT";
};
```

### `HumanTaskTemplate`

```typescript
export type HumanTaskTemplate = {
  createTime?: number;
  createdBy?: string;
  jsonSchema: {
    [key: string]: unknown;
  };
  name: string;
  ownerApp?: string;
  tags?: Array<Tag>;
  templateUI: {
    [key: string]: unknown;
  };
  updateTime?: number;
  updatedBy?: string;
  version: number;
};
```

### `UserFormTemplate`

```typescript
export type UserFormTemplate = {
  name?: string;
  version?: number;
};
```

### `StartWorkflowRequest`

```typescript
export type StartWorkflowRequest = {
  correlationId?: string;
  createdBy?: string;
  externalInputPayloadStoragePath?: string;
  idempotencyKey?: string;
  idempotencyStrategy?: "FAIL" | "RETURN_EXISTING" | "FAIL_ON_RUNNING";
  input?: {
    [key: string]: unknown;
  };
  name: string;
  priority?: number;
  taskToDomain?: {
    [key: string]: string;
  };
  version?: number;
  workflowDef?: WorkflowDef;
};
```

### `HumanTaskSearch`

```typescript
export type HumanTaskSearch = {
  assignees?: Array<HumanTaskUser>;
  claimants?: Array<HumanTaskUser>;
  definitionNames?: Array<string>;
  displayNames?: Array<string>;
  fullTextQuery?: string;
  searchType?: "ADMIN" | "INBOX";
  size?: number;
  start?: number;
  states?: Array<
    | "PENDING"
    | "ASSIGNED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "TIMED_OUT"
    | "DELETED"
  >;
  taskInputQuery?: string;
  taskOutputQuery?: string;
  taskRefNames?: Array<string>;
  updateEndTime?: number;
  updateStartTime?: number;
  workflowIds?: Array<string>;
  workflowNames?: Array<string>;
};
```

### `PollIntervalOptions`

```typescript
export interface PollIntervalOptions {
  pollInterval: number;
  maxPollTimes: number;
}
```

### `HumanTaskSearchResult`

```typescript
export type HumanTaskSearchResult = {
  hits?: number;
  pageSizeLimit?: number;
  results?: Array<HumanTaskEntry>;
  start?: number;
  totalHits?: number;
};
```

### `Tag`

```typescript
export type Tag = {
  key?: string;
  /**
   * @deprecated
   */
  type?: string;
  value?: string;
};
```
