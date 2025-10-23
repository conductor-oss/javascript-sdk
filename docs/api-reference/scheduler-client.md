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

```typescript
export type SaveScheduleRequest = {
  createdBy?: string;
  cronExpression: string;
  description?: string;
  name: string;
  paused?: boolean;
  runCatchupScheduleInstances?: boolean;
  scheduleEndTime?: number;
  scheduleStartTime?: number;
  startWorkflowRequest: StartWorkflowRequest;
  updatedBy?: string;
  zoneId?: string;
};
```

### `WorkflowSchedule`

```typescript
export type WorkflowSchedule = {
  createTime?: number;
  createdBy?: string;
  cronExpression?: string;
  description?: string;
  name?: string;
  paused?: boolean;
  pausedReason?: string;
  runCatchupScheduleInstances?: boolean;
  scheduleEndTime?: number;
  scheduleStartTime?: number;
  startWorkflowRequest?: StartWorkflowRequest;
  tags?: Tag[];
  updatedBy?: string;
  updatedTime?: number;
  zoneId?: string;
};
```

### `WorkflowScheduleModel`

```typescript
export type WorkflowScheduleModel = {
  createTime?: number;
  createdBy?: string;
  cronExpression?: string;
  description?: string;
  name?: string;
  orgId?: string;
  paused?: boolean;
  pausedReason?: string;
  queueMsgId?: string;
  runCatchupScheduleInstances?: boolean;
  scheduleEndTime?: number;
  scheduleStartTime?: number;
  startWorkflowRequest?: StartWorkflowRequest;
  tags?: Tag[];
  updatedBy?: string;
  updatedTime?: number;
  zoneId?: string;
};
```

### `SearchResultWorkflowScheduleExecutionModel`

```typescript
export type SearchResultWorkflowScheduleExecutionModel = {
  results?: WorkflowScheduleExecutionModel[];
  totalHits?: number;
};
```

### `WorkflowScheduleExecutionModel`

```typescript
export type WorkflowScheduleExecutionModel = {
  executionId?: string;
  executionTime?: number;
  orgId?: string;
  queueMsgId?: string;
  reason?: string;
  scheduleName?: string;
  scheduledTime?: number;
  stackTrace?: string;
  startWorkflowRequest?: StartWorkflowRequest;
  state?: 'POLLED' | 'FAILED' | 'EXECUTED';
  workflowId?: string;
  workflowName?: string;
  zoneId?: string;
};
```

### `StartWorkflowRequest`

```typescript
export type StartWorkflowRequest = {
  correlationId?: string;
  createdBy?: string;
  externalInputPayloadStoragePath?: string;
  idempotencyKey?: string;
  idempotencyStrategy?: 'FAIL' | 'RETURN_EXISTING' | 'FAIL_ON_RUNNING';
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

### `Tag`

```typescript
export type Tag = {
  key?: string;
  /**
   * @deprecated
   */
  type?: string;
};
```

### `WorkflowDef`

```typescript
export type WorkflowDef = {
  cacheConfig?: CacheConfig;
  createTime?: number;
  createdBy?: string;
  description?: string;
  enforceSchema?: boolean;
  failureWorkflow?: string;
  inputParameters?: string[];
  inputSchema?: SchemaDef;
  inputTemplate?: {
    [key: string]: unknown;
  };
  maskedFields?: string[];
  metadata?: {
    [key: string]: unknown;
  };
  name: string;
  outputParameters?: {
    [key: string]: unknown;
  };
  outputSchema?: SchemaDef;
  ownerApp?: string;
  ownerEmail?: string;
  rateLimitConfig?: RateLimitConfig;
  restartable?: boolean;
  schemaVersion?: number;
  tasks: WorkflowTask[];
  timeoutPolicy?: 'TIME_OUT_WF' | 'ALERT_ONLY';
  timeoutSeconds: number;
  updateTime?: number;
  updatedBy?: string;
};
```

### `CacheConfig`

```typescript
export type CacheConfig = {
  key?: string;
  ttlInSecond?: number;
};
```

### `SchemaDef`

```typescript
export type SchemaDef = {
  createTime?: number;
  createdBy?: string;
  data?: {
    [key: string]: unknown;
  };
  externalRef?: string;
  name: string;
  ownerApp?: string;
  type: 'JSON' | 'AVRO' | 'PROTOBUF';
  updateTime?: number;
};
```

### `RateLimitConfig`

```typescript
export type RateLimitConfig = {
  concurrentExecLimit?: number;
  rateLimitKey?: string;
};
```

### `WorkflowTask`

```typescript
export type WorkflowTask = {
  asyncComplete?: boolean;
  cacheConfig?: CacheConfig;
  /**
   * @deprecated
   */
  caseExpression?: string;
  /**
   * @deprecated
   */
  caseValueParam?: string;
  decisionCases?: {
    [key: string]: Array<WorkflowTask>;
  };
  defaultCase?: Array<WorkflowTask>;
  defaultExclusiveJoinTask?: Array<string>;
  description?: string;
  /**
   * @deprecated
   */
  dynamicForkJoinTasksParam?: string;
  dynamicForkTasksInputParamName?: string;
  dynamicForkTasksParam?: string;
  dynamicTaskNameParam?: string;
  evaluatorType?: string;
  expression?: string;
  forkTasks?: Array<Array<WorkflowTask>>;
  inputParameters?: {
    [key: string]: unknown;
  };
  joinOn?: Array<string>;
  joinStatus?: string;
  loopCondition?: string;
  loopOver?: Array<WorkflowTask>;
  name: string;
  onStateChange?: {
    [key: string]: Array<StateChangeEvent>;
  };
  optional?: boolean;
  permissive?: boolean;
  rateLimited?: boolean;
  retryCount?: number;
  scriptExpression?: string;
  sink?: string;
  startDelay?: number;
  subWorkflowParam?: SubWorkflowParams;
  taskDefinition?: TaskDef;
  taskReferenceName: string;
  type?: string;
};
```

### `StateChangeEvent`

```typescript
export type StateChangeEvent = {
  payload?: {
    [key: string]: unknown;
  };
  type: string;
};
```

### `SubWorkflowParams`

```typescript
export type SubWorkflowParams = {
  idempotencyKey?: string;
  idempotencyStrategy?: 'FAIL' | 'RETURN_EXISTING' | 'FAIL_ON_RUNNING';
  name?: string;
  taskToDomain?: {
    [key: string]: string;
  };
  version?: number;
  workflowDefinition?: WorkflowDef;
};
```

### `TaskDef`

```typescript
export type TaskDef = {
  backoffScaleFactor?: number;
  baseType?: string;
  concurrentExecLimit?: number;
  createTime?: number;
  createdBy?: string;
  description?: string;
  enforceSchema?: boolean;
  executionNameSpace?: string;
  inputKeys?: Array<string>;
  inputSchema?: SchemaDef;
  inputTemplate?: {
    [key: string]: unknown;
  };
  isolationGroupId?: string;
  name: string;
  outputKeys?: Array<string>;
  outputSchema?: SchemaDef;
  ownerApp?: string;
  ownerEmail?: string;
  pollTimeoutSeconds?: number;
  rateLimitFrequencyInSeconds?: number;
  rateLimitPerFrequency?: number;
  responseTimeoutSeconds?: number;
  retryCount?: number;
  retryDelaySeconds?: number;
  retryLogic?: 'FIXED' | 'EXPONENTIAL_BACKOFF' | 'LINEAR_BACKOFF';
  timeoutPolicy?: 'RETRY' | 'TIME_OUT_WF' | 'ALERT_ONLY';
  timeoutSeconds: number;
  totalTimeoutSeconds: number;
  updateTime?: number;
};
```
