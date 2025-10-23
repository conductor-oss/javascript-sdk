# MetadataClient API Reference

The `MetadataClient` class provides methods for managing task and workflow definitions in Conductor.

## Constructor

### `new MetadataClient(client: Client)`

Creates a new `MetadataClient`.

**Parameters:**

-   `client` (`Client`): An instance of `Client`.

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
Extended task definition with comprehensive configuration options for task registration and management.

```typescript
interface ExtendedTaskDef {
  name: string;
  description?: string;
  ownerEmail?: string;
  ownerApp?: string;
  retryCount?: number;
  timeoutSeconds?: number;
  timeoutPolicy?: 'RETRY' | 'TIME_OUT_WF' | 'ALERT_ONLY';
  retryLogic?: 'FIXED' | 'EXPONENTIAL_BACKOFF' | 'LINEAR_BACKOFF';
  retryDelaySeconds?: number;
  responseTimeoutSeconds?: number;
  concurrentExecLimit?: number;
  inputKeys?: string[];
  outputKeys?: string[];
  inputTemplate?: Record<string, unknown>;
  rateLimitPerFrequency?: number;
  rateLimitFrequencyInSeconds?: number;
  pollTimeoutSeconds?: number;
  backoffScaleFactor?: number;
  executionNameSpace?: string;
  isolationGroupId?: string;
  tags?: Array<{ key: string; value: string }>;
  inputSchema?: SchemaDef;
  outputSchema?: SchemaDef;
  baseType?: string;
  enforceSchema?: boolean;
  overwriteTags?: boolean;
  createTime?: number;
  updateTime?: number;
  createdBy?: string;
  updatedBy?: string;
  totalTimeoutSeconds?: number;
}
```

## `TaskDef`
Task definition containing the configuration for a task.

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

### `ExtendedWorkflowDef`
Extended workflow definition with comprehensive configuration options for workflow registration and management.

```typescript
export type ExtendedWorkflowDef = {
  cacheConfig?: CacheConfig;
  createTime?: number;
  createdBy?: string;
  description?: string;
  enforceSchema?: boolean;
  failureWorkflow?: string;
  inputParameters?: Array<string>;
  inputSchema?: SchemaDef;
  inputTemplate?: {
    [key: string]: unknown;
  };
  maskedFields?: Array<string>;
  metadata?: {
    [key: string]: unknown;
  };
  name: string;
  outputParameters?: {
    [key: string]: unknown;
  };
  outputSchema?: SchemaDef;
  overwriteTags?: boolean;
  ownerApp?: string;
  ownerEmail?: string;
  rateLimitConfig?: RateLimitConfig;
  restartable?: boolean;
  schemaVersion?: number;
  tags?: Array<Tag>;
  tasks: Array<WorkflowTask>;
  timeoutPolicy?: 'TIME_OUT_WF' | 'ALERT_ONLY';
  timeoutSeconds: number;
  updateTime?: number;
  updatedBy?: string;
  variables?: {
    [key: string]: unknown;
  };
  version?: number;
  workflowStatusListenerEnabled?: boolean;
  workflowStatusListenerSink?: string;
};
```

### `WorkflowDef`
Workflow definition containing the configuration for a workflow.

```typescript
export type WorkflowDef = {
  cacheConfig?: CacheConfig;
  createTime?: number;
  createdBy?: string;
  description?: string;
  enforceSchema?: boolean;
  failureWorkflow?: string;
  inputParameters?: Array<string>;
  inputSchema?: SchemaDef;
  inputTemplate?: {
    [key: string]: unknown;
  };
  maskedFields?: Array<string>;
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
  tasks: Array<WorkflowTask>;
  timeoutPolicy?: 'TIME_OUT_WF' | 'ALERT_ONLY';
  timeoutSeconds: number;
  updateTime?: number;
  updatedBy?: string;
  variables?: {
    [key: string]: unknown;
  };
  version?: number;
  workflowStatusListenerEnabled?: boolean;
  workflowStatusListenerSink?: string;
};
```

### `WorkflowTask`
Definition of a task within a workflow.

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
  type: string;
  workflowTaskType?: string;
};
```

### `SchemaDef`
Schema definition for input/output validation.

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

### `CacheConfig`
Configuration for workflow/task caching.

```typescript
export type CacheConfig = {
  key?: string;
  ttlInSecond?: number;
};
```

### `Tag`
Tag definition for categorizing workflows and tasks.

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

### `RateLimitConfig`
Configuration for rate limiting workflows.

```typescript
export type RateLimitConfig = {
  concurrentExecLimit?: number;
  rateLimitKey?: string;
};
```

This type provides all the configuration options available when registering or updating task definitions with the metadata service.
