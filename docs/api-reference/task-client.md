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

The following types can be imported when using the TaskClient. All types are displayed as full TypeScript definitions.

### `TaskClient`

```typescript
export class TaskClient {
  public readonly _client: Client;

  constructor(client: Client);

  search(
    start: number,
    size: number,
    sort?: string,
    freeText: string,
    query: string
  ): Promise<SearchResultTaskSummary>;

  getTask(taskId: string): Promise<Task>;

  updateTaskResult(
    workflowId: string,
    taskRefName: string,
    status: TaskResultStatus,
    outputData: Record<string, unknown>
  ): Promise<string>;
}
```

### `Client`

```typescript
export type Client = CoreClient<
  RequestFn,
  Config,
  MethodFn,
  BuildUrlFn,
  SseFn
> & {
  interceptors: Middleware<Request, Response, unknown, ResolvedRequestOptions>;
};
```

### `TaskResultStatus`

```typescript
export type TaskResultStatus = NonNullable<TaskResult["status"]>;
```

Represents the possible status values for a task result:
- `"IN_PROGRESS"` - Task is currently running
- `"FAILED"` - Task failed but can be retried
- `"FAILED_WITH_TERMINAL_ERROR"` - Task failed and cannot be retried
- `"COMPLETED"` - Task completed successfully

### `SearchResultTaskSummary`

```typescript
export type SearchResultTaskSummary = {
  results?: Array<TaskSummary>;
  totalHits?: number;
};
```

### `TaskSummary`

```typescript
export type TaskSummary = {
  correlationId?: string;
  endTime?: string;
  executionTime?: number;
  externalInputPayloadStoragePath?: string;
  externalOutputPayloadStoragePath?: string;
  input?: string;
  output?: string;
  queueWaitTime?: number;
  reasonForIncompletion?: string;
  scheduledTime?: string;
  startTime?: string;
  status?: 'IN_PROGRESS' | 'CANCELED' | 'FAILED' | 'FAILED_WITH_TERMINAL_ERROR' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'SCHEDULED' | 'TIMED_OUT' | 'SKIPPED';
  taskDefName?: string;
  taskId?: string;
  taskReferenceName?: string;
  taskType?: string;
  updateTime?: string;
  workflowId?: string;
  workflowPriority?: number;
  workflowType?: string;
};
```

### `Task`

```typescript
export type Task = {
  callbackAfterSeconds?: number;
  callbackFromWorker?: boolean;
  correlationId?: string;
  domain?: string;
  endTime?: number;
  executed?: boolean;
  executionNameSpace?: string;
  externalInputPayloadStoragePath?: string;
  externalOutputPayloadStoragePath?: string;
  firstStartTime?: number;
  inputData?: {
    [key: string]: unknown;
  };
  isolationGroupId?: string;
  iteration?: number;
  loopOverTask?: boolean;
  outputData?: {
    [key: string]: unknown;
  };
  parentTaskId?: string;
  pollCount?: number;
  queueWaitTime?: number;
  rateLimitFrequencyInSeconds?: number;
  rateLimitPerFrequency?: number;
  reasonForIncompletion?: string;
  referenceTaskName?: string;
  responseTimeoutSeconds?: number;
  retried?: boolean;
  retriedTaskId?: string;
  retryCount?: number;
  scheduledTime?: number;
  seq?: number;
  startDelayInSeconds?: number;
  startTime?: number;
  status?: 'IN_PROGRESS' | 'CANCELED' | 'FAILED' | 'FAILED_WITH_TERMINAL_ERROR' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'SCHEDULED' | 'TIMED_OUT' | 'SKIPPED';
  subWorkflowId?: string;
  subworkflowChanged?: boolean;
  taskDefName?: string;
  taskDefinition?: TaskDef;
  taskId?: string;
  taskType?: string;
  updateTime?: number;
  workerId?: string;
  workflowInstanceId?: string;
  workflowPriority?: number;
  workflowTask?: WorkflowTask;
  workflowType?: string;
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
  updatedBy?: string;
};
```

### `TaskResult`

```typescript
export type TaskResult = {
  callbackAfterSeconds?: number;
  extendLease?: boolean;
  externalOutputPayloadStoragePath?: string;
  logs?: Array<TaskExecLog>;
  outputData?: {
    [key: string]: unknown;
  };
  reasonForIncompletion?: string;
  status?: 'IN_PROGRESS' | 'FAILED' | 'FAILED_WITH_TERMINAL_ERROR' | 'COMPLETED';
  subWorkflowId?: string;
  taskId: string;
  workerId?: string;
  workflowInstanceId: string;
};
```

### `TaskExecLog`

```typescript
export type TaskExecLog = {
  createdTime?: number;
  log?: string;
  taskId?: string;
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
  updatedBy?: string;
  version: number;
};
```

### `TaskListSearchResultSummary`

```typescript
export type TaskListSearchResultSummary = {
  results?: Array<Task>;
  summary?: {
    [key: string]: number;
  };
  totalHits?: number;
};
```
