# SchedulerClient API Reference

The `SchedulerClient` manages workflow scheduling and provides methods for creating, managing, and monitoring scheduled workflows.

## Constructor

### `new SchedulerClient(client: ConductorClient)`

Creates a new `SchedulerClient`.

**Parameters:**

-   `client` (`ConductorClient`): An instance of `ConductorClient`.

---

## Methods

### `saveSchedule(param: SaveScheduleRequest): Promise<void>`

Creates or updates a schedule for a specified workflow.

**Parameters:**

-   `param` (`SaveScheduleRequest`): The request to save a schedule.

**Returns:**

-   `Promise<void>`

**Example:**

```typescript
import { SchedulerClient } from "@io-orkes/conductor-javascript";

const scheduler = new SchedulerClient(client);

// Create a schedule
await scheduler.saveSchedule({
  name: "daily_report",
  cronExpression: "0 0 9 * * ?", // Daily at 9 AM
  startWorkflowRequest: {
    name: "generate_report",
    version: 1,
    input: { reportType: "daily" }
  },
  scheduleStartTime: Date.now(),
  scheduleEndTime: Date.now() + (365 * 24 * 60 * 60 * 1000) // 1 year from now
});
```

---

### `search(start: number, size: number = 100, sort: string = "", freeText: string = "*", query?: string): Promise<SearchResultWorkflowScheduleExecutionModel>`

Searches for scheduler executions.

**Parameters:**

-   `start` (`number`): The starting offset.
-   `size` (`number`, optional): The number of results to return. Defaults to 100.
-   `sort` (`string`, optional): The sort order. Defaults to `""`.
-   `freeText` (`string`, optional): The free text to search for. Defaults to `"*"`.
-   `query` (`string`, optional): The search query.

**Returns:**

-   `Promise<SearchResultWorkflowScheduleExecutionModel>`: The search results.

**Example:**

```typescript
import { SchedulerClient } from "@io-orkes/conductor-javascript";

const scheduler = new SchedulerClient(client);

// Search for failed executions
const failedExecutions = await scheduler.search(
  0,
  50,
  "scheduledTime:DESC",
  "*",
  "state:FAILED"
);

console.log(`Found ${failedExecutions.totalHits} failed executions`);
```

---

### `getSchedule(name: string): Promise<WorkflowSchedule>`

Gets an existing schedule by name.

**Parameters:**

-   `name` (`string`): The name of the schedule.

**Returns:**

-   `Promise<WorkflowSchedule>`: The schedule.

**Example:**

```typescript
import { SchedulerClient } from "@io-orkes/conductor-javascript";

const scheduler = new SchedulerClient(client);

// Get schedule details
const schedule = await scheduler.getSchedule("daily_report");
console.log(`Schedule paused: ${schedule.paused}`);
```

---

### `pauseSchedule(name: string): Promise<void>`

Pauses an existing schedule by name.

**Parameters:**

-   `name` (`string`): The name of the schedule.

**Returns:**

-   `Promise<void>`

**Example:**

```typescript
import { SchedulerClient } from "@io-orkes/conductor-javascript";

const scheduler = new SchedulerClient(client);

// Pause a schedule
await scheduler.pauseSchedule("daily_report");
console.log("Schedule paused");
```

---

### `resumeSchedule(name: string): Promise<void>`

Resumes a paused schedule by name.

**Parameters:**

-   `name` (`string`): The name of the schedule.

**Returns:**

-   `Promise<void>`

**Example:**

```typescript
import { SchedulerClient } from "@io-orkes/conductor-javascript";

const scheduler = new SchedulerClient(client);

// Resume a schedule
await scheduler.resumeSchedule("daily_report");
console.log("Schedule resumed");
```

---

### `deleteSchedule(name: string): Promise<void>`

Deletes an existing schedule by name.

**Parameters:**

-   `name` (`string`): The name of the schedule.

**Returns:**

-   `Promise<void>`

**Example:**

```typescript
import { SchedulerClient } from "@io-orkes/conductor-javascript";

const scheduler = new SchedulerClient(client);

// Delete a schedule
await scheduler.deleteSchedule("daily_report");
console.log("Schedule deleted");
```

---

### `getAllSchedules(workflowName?: string): Promise<WorkflowScheduleModel[]>`

Gets all existing workflow schedules, optionally filtering by workflow name.

**Parameters:**

-   `workflowName` (`string`, optional): The name of the workflow.

**Returns:**

-   `Promise<WorkflowScheduleModel[]>`: An array of workflow schedules.

**Example:**

```typescript
import { SchedulerClient } from "@io-orkes/conductor-javascript";

const scheduler = new SchedulerClient(client);

// Get all schedules
const schedules = await scheduler.getAllSchedules();
console.log(`Found ${schedules.length} schedules`);

// Get schedules for specific workflow
const reportSchedules = await scheduler.getAllSchedules("generate_report");
```

---

### `getNextFewSchedules(cronExpression: string, scheduleStartTime?: number, scheduleEndTime?: number, limit: number = 3): Promise<number[]>`

Gets a list of the next execution times for a schedule.

**Parameters:**

-   `cronExpression` (`string`): The cron expression for the schedule.
-   `scheduleStartTime` (`number`, optional): The start time for the schedule.
-   `scheduleEndTime` (`number`, optional): The end time for the schedule.
-   `limit` (`number`, optional): The number of execution times to return. Defaults to 3.

**Returns:**

-   `Promise<number[]>`: An array of the next execution times (in milliseconds since epoch).

**Example:**

```typescript
import { SchedulerClient } from "@io-orkes/conductor-javascript";

const scheduler = new SchedulerClient(client);

// Get next 5 execution times
const nextTimes = await scheduler.getNextFewSchedules(
  "0 0 9 * * ?", // Daily at 9 AM
  Date.now(),
  Date.now() + (30 * 24 * 60 * 60 * 1000), // Next 30 days
  5
);

console.log("Next execution times:");
nextTimes.forEach(time => {
  console.log(new Date(time).toISOString());
});
```

---

### `pauseAllSchedules(): Promise<void>`

Pauses all scheduling in the Conductor server instance (for debugging purposes only).

**Returns:**

-   `Promise<void>`

**Example:**

```typescript
import { SchedulerClient } from "@io-orkes/conductor-javascript";

const scheduler = new SchedulerClient(client);

// Pause all schedules (for maintenance)
await scheduler.pauseAllSchedules();
console.log("All schedules paused");
```

---

### `requeueAllExecutionRecords(): Promise<void>`

Requeues all execution records that may have failed or been missed.

**Returns:**

-   `Promise<void>`

**Example:**

```typescript
import { SchedulerClient } from "@io-orkes/conductor-javascript";

const scheduler = new SchedulerClient(client);

// Requeue failed executions
await scheduler.requeueAllExecutionRecords();
console.log("All execution records requeued");
```

---

### `resumeAllSchedules(): Promise<void>`

Resumes all scheduling in the Conductor server instance.

**Returns:**

-   `Promise<void>`

**Example:**

```typescript
import { SchedulerClient } from "@io-orkes/conductor-javascript";

const scheduler = new SchedulerClient(client);

// Resume all schedules after maintenance
await scheduler.resumeAllSchedules();
console.log("All schedules resumed");
```

---

## Type Definitions

### `SaveScheduleRequest`

Request object for creating or updating a schedule.

| Property | Type | Description |
| --- | --- | --- |
| `name` | `string` | The name of the schedule. |
| `cronExpression` | `string` | The cron expression for the schedule. |
| `runCatchupScheduleInstances` | `boolean` | Whether to run catch-up schedule instances. |
| `paused` | `boolean` | Whether the schedule is paused. |
| `startWorkflowRequest` | `StartWorkflowRequest` | The request to start a workflow. |
| `createdBy` | `string` | The user who created the schedule. |
| `updatedBy` | `string` | The user who last updated the schedule. |
| `scheduleStartTime` | `number` | The start time for the schedule. |
| `scheduleEndTime` | `number` | The end time for the schedule. |

### `WorkflowSchedule`

Schedule object returned by the API.

| Property | Type | Description |
| --- | --- | --- |
| `name` | `string` | The name of the schedule. |
| `cronExpression` | `string` | The cron expression for the schedule. |
| `runCatchupScheduleInstances` | `boolean` | Whether to run catch-up schedule instances. |
| `paused` | `boolean` | Whether the schedule is paused. |
| `startWorkflowRequest` | `StartWorkflowRequest` | The request to start a workflow. |
| `scheduleStartTime` | `number` | The start time for the schedule. |
| `scheduleEndTime` | `number` | The end time for the schedule. |
| `createTime` | `number` | The creation time of the schedule. |
| `updatedTime` | `number` | The last update time of the schedule. |
| `createdBy` | `string` | The user who created the schedule. |
| `updatedBy` | `string` | The user who last updated the schedule. |

### `WorkflowScheduleModel`

Simplified schedule model returned by `getAllSchedules()`.

| Property | Type | Description |
| --- | --- | --- |
| `name` | `string` | The name of the schedule. |
| `cronExpression` | `string` | The cron expression for the schedule. |
| `paused` | `boolean` | Whether the schedule is paused. |
| `workflowName` | `string` | The name of the workflow. |
| `workflowVersion` | `string` | The version of the workflow. |

### `SearchResultWorkflowScheduleExecutionModel`

Search results for schedule executions.

| Property | Type | Description |
| --- | --- | --- |
| `totalHits` | `number` | The total number of hits. |
| `results` | `WorkflowScheduleExecutionModel[]` | The search results. |

### `WorkflowScheduleExecutionModel`

Individual schedule execution record.

| Property | Type | Description |
| --- | --- | --- |
| `executionId` | `string` | The ID of the execution. |
| `scheduleName` | `string` | The name of the schedule. |
| `scheduledTime` | `number` | The scheduled time of the execution. |
| `executionTime` | `number` | The execution time. |
| `workflowName` | `string` | The name of the workflow. |
| `workflowId` | `string` | The ID of the workflow instance. |
| `reason` | `string` | The reason for the execution status. |
| `stackTrace` | `string` | The stack trace for a failed execution. |
| `startWorkflowRequest` | `StartWorkflowRequest` | The request to start a workflow. |
| `state` | `'POLLED' \| 'FAILED' \| 'EXECUTED'` | The state of the execution. |

### `StartWorkflowRequest`

Request object for starting a workflow.

| Property | Type | Description |
| --- | --- | --- |
| `name` | `string` | The name of the workflow. |
| `version` | `number` | The version of the workflow. |
| `correlationId` | `string` | The correlation ID of the workflow. |
| `input` | `Record<string, any>` | The input data for the workflow. |
| `taskToDomain` | `Record<string, string>` | A map of task reference names to domains. |
| `workflowDef` | `WorkflowDef` | The workflow definition. |
| `externalInputPayloadStoragePath` | `string` | The path to the external input payload storage. |
| `idempotencyKey` | `string` | The idempotency key for the workflow. |
| `idempotencyStrategy` | `'FAIL' \| 'RETURN_EXISTING'` | The idempotency strategy for the workflow. |
| `priority` | `number` | The priority of the workflow. |
| `createdBy` | `string` | The user who created the workflow. |

### `WorkflowDef`

Workflow definition object.

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
