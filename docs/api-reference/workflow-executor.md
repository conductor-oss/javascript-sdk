# WorkflowExecutor API Reference

The `WorkflowExecutor` class is your main interface for managing workflows. It provides methods to register, start, monitor, and control workflow execution.

## Constructor

### `new WorkflowExecutor(client: Client)`

Creates a new WorkflowExecutor.

**Parameters:**

- `client` (`Client`): An instance of `Client`.

---

## Methods

### `registerWorkflow(override: boolean, workflow: WorkflowDef): Promise<void>`

Registers a workflow definition with Conductor.

**Parameters:**

- `override` (`boolean`): Whether to override the existing workflow definition.
- `workflow` (`WorkflowDef`): The workflow definition.

**Returns:**

- `Promise<void>`

**Example:**

```typescript
import { WorkflowExecutor, workflow } from "@io-orkes/conductor-javascript";

const executor = new WorkflowExecutor(client);

// Register a workflow
await executor.registerWorkflow(
  true,
  workflow("email_workflow", [
    simpleTask("send_email", "email_task", { to: "user@example.com" }),
  ])
);
```

---

### `startWorkflow(workflowRequest: StartWorkflowRequest): Promise<string>`

Starts a new workflow execution.

**Parameters:**

- `workflowRequest` (`StartWorkflowRequest`): The request to start a workflow.

**Returns:**

- `Promise<string>`: The ID of the workflow instance.

**Example:**

```typescript
import { WorkflowExecutor } from "@io-orkes/conductor-javascript";

const executor = new WorkflowExecutor(client);

// Start a workflow
const executionId = await executor.startWorkflow({
  name: "email_workflow",
  version: 1,
  input: {
    to: "user@example.com",
    subject: "Welcome!",
    message: "Welcome to our platform!",
  },
});

console.log(`Workflow started with ID: ${executionId}`);
```

---

### `executeWorkflow(workflowRequest: StartWorkflowRequest, name: string, version: number, requestId: string, waitUntilTaskRef?: string): Promise<WorkflowRun>`

### `executeWorkflow(workflowRequest: StartWorkflowRequest, name: string, version: number, requestId: string, waitUntilTaskRef: string, waitForSeconds: number, consistency: Consistency, returnStrategy: ReturnStrategy): Promise<EnhancedSignalResponse>`

Executes a workflow synchronously and waits for completion. Can return different responses based on the provided parameters.

**Parameters:**

- `workflowRequest` (`StartWorkflowRequest`): The request to start a workflow.
- `name` (`string`): The name of the workflow.
- `version` (`number`): The version of the workflow.
- `requestId` (`string`): A unique ID for the request.
- `waitUntilTaskRef` (`string`, optional): The reference name of the task to wait for.
- `waitForSeconds` (`number`, optional): The number of seconds to wait for the task.
- `consistency` (`Consistency`, optional): The consistency level for the read operations.
- `returnStrategy` (`ReturnStrategy`, optional): The strategy for what data to return.

**Returns:**

- `Promise<WorkflowRun | EnhancedSignalResponse>`: A `WorkflowRun` object or a `EnhancedSignalResponse` object.

**Example:**

```typescript
import {
  WorkflowExecutor,
  ReturnStrategy,
} from "@io-orkes/conductor-javascript";

const executor = new WorkflowExecutor(client);

// Execute workflow synchronously
const workflowRun = await executor.executeWorkflow(
  {
    name: "data_processing",
    version: 1,
    input: { fileId: "file_123" },
  },
  "data_processing",
  1,
  "req_123"
);

console.log(`Workflow completed with status: ${workflowRun.status}`);
```

---

### `startWorkflows(workflowsRequest: StartWorkflowRequest[]): Promise<string>[]`

Starts multiple workflows at once.

**Parameters:**

- `workflowsRequest` (`StartWorkflowRequest[]`): An array of workflow start requests.

**Returns:**

- `Promise<string>[]`: An array of promises that resolve to the workflow instance IDs.

**Example:**

```typescript
import { WorkflowExecutor } from "@io-orkes/conductor-javascript";

const executor = new WorkflowExecutor(client);

// Start multiple workflows
const workflowRequests = [
  { name: "email_workflow", version: 1, input: { to: "user1@example.com" } },
  { name: "email_workflow", version: 1, input: { to: "user2@example.com" } },
  { name: "email_workflow", version: 1, input: { to: "user3@example.com" } },
];

const promises = executor.startWorkflows(workflowRequests);

// Wait for all to complete
const executionIds = await Promise.all(promises);
console.log(`Started ${executionIds.length} workflows:`, executionIds);
```

---

### `goBackToTask(workflowInstanceId: string, taskFinderPredicate: TaskFinderPredicate, rerunWorkflowRequestOverrides: Partial<RerunWorkflowRequest> = {}): Promise<void>`

Reruns a workflow from a specific task.

**Parameters:**

- `workflowInstanceId` (`string`): The ID of the workflow instance.
- `taskFinderPredicate` (`TaskFinderPredicate`): A function to find the task to rerun from.
- `rerunWorkflowRequestOverrides` (`Partial<RerunWorkflowRequest>`, optional): Overrides for the rerun request.

**Returns:**

- `Promise<void>`

---

### `goBackToFirstTaskMatchingType(workflowInstanceId: string, taskType: string): Promise<void>`

Reruns a workflow from the first task of a specific type.

**Parameters:**

- `workflowInstanceId` (`string`): The ID of the workflow instance.
- `taskType` (`string`): The type of the task to rerun from.

**Returns:**

- `Promise<void>`

---

### `getWorkflow(workflowInstanceId: string, includeTasks: boolean, retry: number = 0): Promise<Workflow>`

Gets the execution status of a workflow.

**Parameters:**

- `workflowInstanceId` (`string`): The ID of the workflow instance.
- `includeTasks` (`boolean`): Whether to include the tasks in the response.
- `retry` (`number`, optional): The number of times to retry on failure.

**Returns:**

- `Promise<Workflow>`: The workflow execution status.

---

### `getWorkflowStatus(workflowInstanceId: string, includeOutput: boolean, includeVariables: boolean): Promise<WorkflowStatus>`

Gets a summary of the current workflow status.

**Parameters:**

- `workflowInstanceId` (`string`): The ID of the workflow instance.
- `includeOutput` (`boolean`): Whether to include the output in the response.
- `includeVariables` (`boolean`): Whether to include the variables in the response.

**Returns:**

- `Promise<WorkflowStatus>`: The workflow status summary.

---

### `getExecution(workflowInstanceId: string, includeTasks: boolean = true): Promise<Workflow>`

Gets the execution status of a workflow, including tasks by default.

**Parameters:**

- `workflowInstanceId` (`string`): The ID of the workflow instance.
- `includeTasks` (`boolean`, optional): Whether to include the tasks in the response. Defaults to `true`.

**Returns:**

- `Promise<Workflow>`: The workflow execution status.

---

### `pause(workflowInstanceId: string): Promise<void>`

Pauses a running workflow.

**Parameters:**

- `workflowInstanceId` (`string`): The ID of the workflow instance.

**Returns:**

- `Promise<void>`

---

### `reRun(workflowInstanceId: string, rerunWorkflowRequest: Partial<RerunWorkflowRequest> = {}): Promise<string>`

Reruns a workflow with new parameters.

**Parameters:**

- `workflowInstanceId` (`string`): The ID of the workflow instance.
- `rerunWorkflowRequest` (`Partial<RerunWorkflowRequest>`, optional): Overrides for the rerun request.

**Returns:**

- `Promise<string>`: The ID of the new workflow instance.

---

### `restart(workflowInstanceId: string, useLatestDefinitions: boolean): Promise<void>`

Restarts a workflow.

**Parameters:**

- `workflowInstanceId` (`string`): The ID of the workflow instance.
- `useLatestDefinitions` (`boolean`): Whether to use the latest workflow definition.

**Returns:**

- `Promise<void>`

---

### `resume(workflowInstanceId: string): Promise<void>`

Resumes a paused workflow.

**Parameters:**

- `workflowInstanceId` (`string`): The ID of the workflow instance.

**Returns:**

- `Promise<void>`

---

### `retry(workflowInstanceId: string, resumeSubworkflowTasks: boolean): Promise<void>`

Retries a workflow from the last failing task.

**Parameters:**

- `workflowInstanceId` (`string`): The ID of the workflow instance.
- `resumeSubworkflowTasks` (`boolean`): Whether to resume tasks in sub-workflows.

**Returns:**

- `Promise<void>`

---

### `search(start: number, size: number, query: string, freeText: string, sort: string = "", skipCache: boolean = false): Promise<ScrollableSearchResultWorkflowSummary>`

Searches for workflows.

**Parameters:**

- `start` (`number`): The starting offset.
- `size` (`number`): The number of results to return.
- `query` (`string`): The search query.
- `freeText` (`string`): The free text to search for.
- `sort` (`string`, optional): The sort order.
- `skipCache` (`boolean`, optional): Whether to skip the cache.

**Returns:**

- `Promise<ScrollableSearchResultWorkflowSummary>`: The search results.

---

### `skipTasksFromWorkflow(workflowInstanceId: string, taskReferenceName: string, skipTaskRequest: Partial<SkipTaskRequest>): Promise<void>`

Skips a task in a running workflow.

**Parameters:**

- `workflowInstanceId` (`string`): The ID of the workflow instance.
- `taskReferenceName` (`string`): The reference name of the task to skip.
- `skipTaskRequest` (`Partial<SkipTaskRequest>`): The request to skip the task.

**Returns:**

- `Promise<void>`

---

### `terminate(workflowInstanceId: string, reason: string): Promise<void>`

Terminates a running workflow.

**Parameters:**

- `workflowInstanceId` (`string`): The ID of the workflow instance.
- `reason` (`string`): The reason for termination.

**Returns:**

- `Promise<void>`

---

### `updateTask(taskId: string, workflowInstanceId: string, taskStatus: TaskResultStatus, outputData: Record<string, any>): Promise<string>`

Updates a task by its ID.

**Parameters:**

- `taskId` (`string`): The ID of the task.
- `workflowInstanceId` (`string`): The ID of the workflow instance.
- `taskStatus` (`TaskResultStatus`): The new status of the task.
- `outputData` (`Record<string, any>`): The output data of the task.

**Returns:**

- `Promise<string>`

---

### `updateTaskByRefName(taskReferenceName: string, workflowInstanceId: string, status: TaskResultStatus, taskOutput: Record<string, any>): Promise<string>`

Updates a task by its reference name.

**Parameters:**

- `taskReferenceName` (`string`): The reference name of the task.
- `workflowInstanceId` (`string`): The ID of the workflow instance.
- `status` (`TaskResultStatus`): The new status of the task.
- `taskOutput` (`Record<string, any>`): The output data of the task.

**Returns:**

- `Promise<string>`

---

### `getTask(taskId: string): Promise<Task>`

Gets a task by its ID.

**Parameters:**

- `taskId` (`string`): The ID of the task.

**Returns:**

- `Promise<Task>`: The task.

---

### `updateTaskSync(taskReferenceName: string, workflowInstanceId: string, status: TaskResultStatusEnum, taskOutput: Record<string, any>, workerId?: string): Promise<Workflow>`

Updates a task by its reference name synchronously and returns the complete workflow.

**Parameters:**

- `taskReferenceName` (`string`): The reference name of the task.
- `workflowInstanceId` (`string`): The ID of the workflow instance.
- `status` (`TaskResultStatusEnum`): The new status of the task.
- `taskOutput` (`Record<string, any>`): The output data of the task.
- `workerId` (`string`, optional): The ID of the worker.

**Returns:**

- `Promise<Workflow>`: The updated workflow.

---

### `signal(workflowInstanceId: string, status: TaskResultStatusEnum, taskOutput: Record<string, any>, returnStrategy: ReturnStrategy = ReturnStrategy.TARGET_WORKFLOW): Promise<EnhancedSignalResponse>`

Signals a workflow task and returns data based on the specified return strategy.

**Parameters:**

- `workflowInstanceId` (`string`): The ID of the workflow instance to signal.
- `status` (`TaskResultStatusEnum`): The task status to set.
- `taskOutput` (`Record<string, any>`): The output data for the task.
- `returnStrategy` (`ReturnStrategy`, optional): The strategy for what data to return. Defaults to `TARGET_WORKFLOW`.

**Returns:**

- `Promise<EnhancedSignalResponse>`: The response from the signal.

---

### `signalAsync(workflowInstanceId: string, status: TaskResultStatusEnum, taskOutput: Record<string, any>): Promise<void>`

Signals a workflow task asynchronously (fire-and-forget).

**Parameters:**

- `workflowInstanceId` (`string`): The ID of the workflow instance to signal.
- `status` (`TaskResultStatusEnum`): The task status to set.
- `taskOutput` (`Record<string, any>`): The output data for the task.

**Returns:**

- `Promise<void>`

---

## Type Definitions

### `Consistency`

```typescript
enum Consistency {
  SYNCHRONOUS = "SYNCHRONOUS",
  DURABLE = "DURABLE",
  REGION_DURABLE = "REGION_DURABLE",
}
```

### `ReturnStrategy`

```typescript
enum ReturnStrategy {
  TARGET_WORKFLOW = "TARGET_WORKFLOW",
  BLOCKING_WORKFLOW = "BLOCKING_WORKFLOW",
  BLOCKING_TASK = "BLOCKING_TASK",
  BLOCKING_TASK_INPUT = "BLOCKING_TASK_INPUT",
}
```

### `TaskResultStatusEnum`

```typescript
enum TaskResultStatusEnum {
  IN_PROGRESS = "IN_PROGRESS",
  FAILED = "FAILED",
  FAILED_WITH_TERMINAL_ERROR = "FAILED_WITH_TERMINAL_ERROR",
  COMPLETED = "COMPLETED",
}
```

### `StartWorkflowRequest`

```typescript
type StartWorkflowRequest = {
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

### `WorkflowDef`

```typescript
interface WorkflowDef {
  name: string;
  description?: string;
  version?: number;
  tasks: WorkflowTask[];
  inputParameters?: string[];
  outputParameters?: Record<string, any>;
  failureWorkflow?: string;
  schemaVersion?: number;
  restartable?: boolean;
  workflowStatusListenerEnabled?: boolean;
  workflowStatusListenerSink?: string;
  ownerEmail?: string;
  ownerApp?: string;
  timeoutPolicy?: "TIME_OUT_WF" | "ALERT_ONLY";
  timeoutSeconds?: number;
  variables?: Record<string, any>;
  inputTemplate?: Record<string, any>;
  inputSchema?: SchemaDef;
  outputSchema?: SchemaDef;
  enforceSchema?: boolean;
  maskedFields?: string[];
  rateLimitConfig?: RateLimitConfig;
  cacheConfig?: CacheConfig;
  metadata?: Record<string, any>;
  createTime?: number;
  updateTime?: number;
  createdBy?: string;
  updatedBy?: string;
}
```

### `CacheConfig`

```typescript
export type CacheConfig = {
  key?: string;
  ttlInSecond?: number;
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
interface WorkflowTask {
  name: string;
  taskReferenceName: string;
  type: string;
  description?: string;
  optional?: boolean;
  inputParameters?: Record<string, any>;
  asyncComplete?: boolean;
  startDelay?: number;
  retryCount?: number;
  evaluatorType?: string;
  expression?: string;
  decisionCases?: Record<string, WorkflowTask[]>;
  defaultCase?: WorkflowTask[];
  forkTasks?: WorkflowTask[][];
  joinOn?: string[];
  joinStatus?: string;
  loopCondition?: string;
  loopOver?: WorkflowTask[];
  dynamicTaskNameParam?: string;
  dynamicForkTasksParam?: string;
  dynamicForkTasksInputParamName?: string;
  defaultExclusiveJoinTask?: string[];
  caseExpression?: string;
  caseValueParam?: string;
  sink?: string;
  taskDefinition?: TaskDef;
  rateLimited?: boolean;
  permissive?: boolean;
  cacheConfig?: CacheConfig;
  onStateChange?: Record<string, StateChangeEvent[]>;
  scriptExpression?: string;
  subWorkflowParam?: SubWorkflowParams;
}
```

### `SubWorkflowParams`

```typescript
export type SubWorkflowParams = {
  idempotencyKey?: string;
  idempotencyStrategy?: "FAIL" | "RETURN_EXISTING" | "FAIL_ON_RUNNING";
  name?: string;
  taskToDomain?: {
    [key: string]: string;
  };
  version?: number;
  workflowDefinition?: WorkflowDef;
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

### `WorkflowRun`

```typescript
type WorkflowRun = {
  correlationId?: string;
  createTime?: number;
  createdBy?: string;
  input?: {
    [key: string]: unknown;
  };
  output?: {
    [key: string]: unknown;
  };
  priority?: number;
  requestId?: string;
  responseType?:
    | "TARGET_WORKFLOW"
    | "BLOCKING_WORKFLOW"
    | "BLOCKING_TASK"
    | "BLOCKING_TASK_INPUT";
  status?:
    | "RUNNING"
    | "COMPLETED"
    | "FAILED"
    | "TIMED_OUT"
    | "TERMINATED"
    | "PAUSED";
  targetWorkflowId?: string;
  targetWorkflowStatus?: string;
  tasks?: Array<Task>;
  updateTime?: number;
  variables?: {
    [key: string]: unknown;
  };
  workflowId?: string;
};
```

### `EnhancedSignalResponse`

```typescript
interface EnhancedSignalResponse extends SignalResponse {
  correlationId?: string;
  input?: {
    [key: string]: unknown;
  };
  output?: {
    [key: string]: unknown;
  };
  requestId?: string;
  responseType?:
    | "TARGET_WORKFLOW"
    | "BLOCKING_WORKFLOW"
    | "BLOCKING_TASK"
    | "BLOCKING_TASK_INPUT";
  targetWorkflowId?: string;
  targetWorkflowStatus?: string;
  workflowId?: string;
  priority?: number;
  variables?: Record<string, unknown>;
  tasks?: Task[];
  createdBy?: string;
  createTime?: number;
  status?: string;
  updateTime?: number;
  taskType?: string;
  taskId?: string;
  referenceTaskName?: string;
  retryCount?: number;
  taskDefName?: string;
  workflowType?: string;
  isTargetWorkflow(): boolean;
  isBlockingWorkflow(): boolean;
  isBlockingTask(): boolean;
  isBlockingTaskInput(): boolean;
  getWorkflow(): Workflow;
  getBlockingTask(): Task;
  getTaskInput(): Record<string, unknown>;
  getWorkflowId(): string;
  getTargetWorkflowId(): string;
  hasWorkflowData(): boolean;
  hasTaskData(): boolean;
  getResponseType(): string;
  isTerminal(): boolean;
  isRunning(): boolean;
  isPaused(): boolean;
  getSummary(): string;
  toDebugJSON(): Record<string, unknown>;
  toString(): string;
}
```

### `TaskFinderPredicate`

```typescript
type TaskFinderPredicate = (task: Task) => boolean;
```

### `RerunWorkflowRequest`

```typescript
type RerunWorkflowRequest = {
  correlationId?: string;
  reRunFromTaskId?: string;
  reRunFromWorkflowId?: string;
  taskInput?: {
    [key: string]: unknown;
  };
  workflowInput?: {
    [key: string]: unknown;
  };
};
```

### `Workflow`

```typescript
type Workflow = {
  correlationId?: string;
  createTime?: number;
  createdBy?: string;
  endTime?: number;
  event?: string;
  externalInputPayloadStoragePath?: string;
  externalOutputPayloadStoragePath?: string;
  failedReferenceTaskNames?: Array<string>;
  failedTaskNames?: Array<string>;
  history?: Array<Workflow>;
  idempotencyKey?: string;
  input?: {
    [key: string]: unknown;
  };
  lastRetriedTime?: number;
  output?: {
    [key: string]: unknown;
  };
  ownerApp?: string;
  parentWorkflowId?: string;
  parentWorkflowTaskId?: string;
  priority?: number;
  rateLimitKey?: string;
  rateLimited?: boolean;
  reRunFromWorkflowId?: string;
  reasonForIncompletion?: string;
  startTime?: number;
  status?:
    | "RUNNING"
    | "COMPLETED"
    | "FAILED"
    | "TIMED_OUT"
    | "TERMINATED"
    | "PAUSED";
  taskToDomain?: {
    [key: string]: string;
  };
  tasks?: Array<Task>;
  updateTime?: number;
  updatedBy?: string;
  variables?: {
    [key: string]: unknown;
  };
  workflowDefinition?: WorkflowDef;
  workflowId?: string;
  workflowName?: string;
  workflowVersion?: number;
};
```

### `WorkflowStatus`

```typescript
type WorkflowStatus = {
  correlationId?: string;
  output?: {
    [key: string]: unknown;
  };
  status?:
    | "RUNNING"
    | "COMPLETED"
    | "FAILED"
    | "TIMED_OUT"
    | "TERMINATED"
    | "PAUSED";
  variables?: {
    [key: string]: unknown;
  };
  workflowId?: string;
};
```

### `ScrollableSearchResultWorkflowSummary`

```typescript
type ScrollableSearchResultWorkflowSummary = {
  queryId?: string;
  results?: Array<WorkflowSummary>;
  totalHits?: number;
};
```

### `WorkflowSummary`

```typescript
export type WorkflowSummary = {
  correlationId?: string;
  createdBy?: string;
  endTime?: string;
  event?: string;
  executionTime?: number;
  externalInputPayloadStoragePath?: string;
  externalOutputPayloadStoragePath?: string;
  failedReferenceTaskNames?: string;
  failedTaskNames?: Array<string>;
  idempotencyKey?: string;
  input?: string;
  inputSize?: number;
  output?: string;
  outputSize?: number;
  priority?: number;
  reasonForIncompletion?: string;
  startTime?: string;
  status?:
    | "RUNNING"
    | "COMPLETED"
    | "FAILED"
    | "TIMED_OUT"
    | "TERMINATED"
    | "PAUSED";
  taskToDomain?: {
    [key: string]: string;
  };
  updateTime?: string;
  version?: number;
  workflowId?: string;
  workflowType?: string;
};
```

### `SkipTaskRequest`

```typescript
type SkipTaskRequest = {
  taskInput?: {
    [key: string]: unknown;
  };
  taskOutput?: {
    [key: string]: unknown;
  };
};
```

### `TaskResultStatus`

```typescript
type TaskResultStatus =
  | "IN_PROGRESS"
  | "FAILED"
  | "FAILED_WITH_TERMINAL_ERROR"
  | "COMPLETED";
```

### `TaskDef`

```typescript
type TaskDef = {
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
  retryLogic?: "FIXED" | "EXPONENTIAL_BACKOFF" | "LINEAR_BACKOFF";
  timeoutPolicy?: "RETRY" | "TIME_OUT_WF" | "ALERT_ONLY";
  timeoutSeconds: number;
  totalTimeoutSeconds: number;
  updateTime?: number;
  updatedBy?: string;
};
```

### `Task`

```typescript
type Task = {
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
  status?:
    | "IN_PROGRESS"
    | "CANCELED"
    | "FAILED"
    | "FAILED_WITH_TERMINAL_ERROR"
    | "COMPLETED"
    | "COMPLETED_WITH_ERRORS"
    | "SCHEDULED"
    | "TIMED_OUT"
    | "SKIPPED";
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
  type: "JSON" | "AVRO" | "PROTOBUF";
  updateTime?: number;
  updatedBy?: string;
  version: number;
};
```
