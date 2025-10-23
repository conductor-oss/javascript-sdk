# TaskManager API Reference

The `TaskManager` is responsible for initializing and managing the runners that poll and work different task queues.

## Constructor

### `new TaskManager(client: Client, workers: Array<ConductorWorker>, config: TaskManagerConfig = {})`

Creates a new TaskManager.

**Parameters:**

-   `client` (`Client`): An instance of `Client`.
-   `workers` (`Array<ConductorWorker>`): An array of `ConductorWorker` instances.
-   `config` (`TaskManagerConfig`, optional): Configuration for the `TaskManager`.

**Example:**

```typescript
import { TaskManager } from "@io-orkes/conductor-javascript";

const workers = [
  {
    taskDefName: "email_task",
    execute: async (task) => {
      // Task execution logic
      return {
        status: "COMPLETED",
        outputData: { sent: true }
      };
    }
  }
];

const taskManager = new TaskManager(client, workers, {
  options: {
    concurrency: 5,
    pollInterval: 100
  },
  maxRetries: 3
});
```

---

## Properties

### `isPolling: boolean`

Returns whether the `TaskManager` is currently polling for tasks.

---

## Methods

### `updatePollingOptionForWorker(workerTaskDefName: string, options: Partial<TaskManagerOptions>): void`

Updates the polling options for a specific worker.

**Parameters:**

-   `workerTaskDefName` (`string`): The task definition name of the worker.
-   `options` (`Partial<TaskManagerOptions>`): The new polling options.

**Example:**

```typescript
import { TaskManager } from "@io-orkes/conductor-javascript";

const taskManager = new TaskManager(client, workers);

// Update polling options for a specific worker
taskManager.updatePollingOptionForWorker("email_task", {
  concurrency: 10,
  pollInterval: 500
});
```

---

### `updatePollingOptions(options: Partial<TaskManagerOptions>): void`

Updates the polling options for all workers.

**Parameters:**

-   `options` (`Partial<TaskManagerOptions>`): The new polling options.

**Example:**

```typescript
import { TaskManager } from "@io-orkes/conductor-javascript";

const taskManager = new TaskManager(client, workers);

// Update polling options for all workers
taskManager.updatePollingOptions({
  concurrency: 5,
  pollInterval: 200
});
```

---

### `startPolling(): void`

Starts polling for tasks for all workers.

**Example:**

```typescript
import { TaskManager } from "@io-orkes/conductor-javascript";

const taskManager = new TaskManager(client, workers);

// Start polling for tasks
taskManager.startPolling();
console.log(`Polling started: ${taskManager.isPolling}`);
```

---

### `stopPolling(): Promise<void>`

Stops polling for tasks for all workers.

**Example:**

```typescript
import { TaskManager } from "@io-orkes/conductor-javascript";

const taskManager = new TaskManager(client, workers);

// Stop polling for tasks
await taskManager.stopPolling();
console.log(`Polling stopped: ${taskManager.isPolling}`);
```

---

### `sanityCheck(): void`

Performs a sanity check on the workers, ensuring there are no duplicates and that at least one worker is present. Throws an error if the check fails.

**Example:**

```typescript
import { TaskManager } from "@io-orkes/conductor-javascript";

const taskManager = new TaskManager(client, workers);

// Perform sanity check
try {
  taskManager.sanityCheck();
  console.log("All workers are valid");
} catch (error) {
  console.error("Worker configuration error:", error.message);
}
```

## Type Definitions

### `TaskManagerConfig`

```typescript
export interface TaskManagerConfig {
  logger?: ConductorLogger;
  options?: Partial<TaskManagerOptions>;
  onError?: TaskErrorHandler;
  maxRetries?: number;
}
```

### `TaskManagerOptions`

```typescript
export type TaskManagerOptions = TaskRunnerOptions;
```

### `TaskRunnerOptions`

```typescript
export interface TaskRunnerOptions {
  workerID: string;
  domain: string | undefined;
  pollInterval?: number;
  concurrency?: number;
  batchPollingTimeout?: number;
}
```

### `ConductorWorker`

```typescript
export interface ConductorWorker {
  taskDefName: string;
  execute: (
    task: Task
  ) => Promise<Omit<TaskResult, "workflowInstanceId" | "taskId">>;
  domain?: string;
  concurrency?: number;
  pollInterval?: number;
}
```

### `TaskErrorHandler`

```typescript
export type TaskErrorHandler = (error: Error, task?: Task) => void;
```

### `ConductorLogger`

```typescript
export interface ConductorLogger {
  info(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}
```

### `DefaultLogger`

```typescript
export declare class DefaultLogger implements ConductorLogger {
  constructor(config?: DefaultLoggerConfig);

  info(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}
```

### `DefaultLoggerConfig`

```typescript
export interface DefaultLoggerConfig {
  level?: ConductorLogLevel;
  tags?: object[];
}
```

### `ConductorLogLevel`

```typescript
export type ConductorLogLevel = keyof typeof LOG_LEVELS;
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

### `TaskResultStatusEnum`

```typescript
export enum TaskResultStatusEnum {
  IN_PROGRESS = "IN_PROGRESS",
  FAILED = "FAILED",
  FAILED_WITH_TERMINAL_ERROR = "FAILED_WITH_TERMINAL_ERROR",
  COMPLETED = "COMPLETED"
}
```

### `RunnerArgs`

```typescript
export interface RunnerArgs {
  worker: ConductorWorker;
  client: Client;
  options: TaskRunnerOptions;
  logger?: ConductorLogger;
  onError?: TaskErrorHandler;
  concurrency?: number;
  maxRetries?: number;
}
```
