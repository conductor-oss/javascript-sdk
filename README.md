# Conductor JavaScript/TypeScript SDK

The `@io-orkes/conductor-javascript` SDK provides a comprehensive TypeScript/JavaScript client for building workflows and task workers with Netflix Conductor and Orkes Conductor.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Authentication & Configuration](#authentication--configuration)
- [Core Concepts](#core-concepts)
- [Task Types](#task-types)
- [Workflow Management](#workflow-management)
- [Worker Management](#worker-management)
- [Task Management](#task-management)
- [Scheduler Management](#scheduler-management)
- [Service Registry](#service-registry)
- [Human Tasks](#human-tasks)
- [Metadata Management](#metadata-management)
- [Error Handling](#error-handling)
- [Logging](#logging)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

## Installation

Install the SDK using npm or yarn:

```bash
npm install @io-orkes/conductor-javascript
```

or

```bash
yarn add @io-orkes/conductor-javascript
```

## Quick Start

Here's a simple example to get you started:

```typescript
import { 
  orkesConductorClient, 
  WorkflowExecutor, 
  TaskManager,
  simpleTask,
  workflow 
} from "@io-orkes/conductor-javascript";

// 1. Create client
const client = await orkesConductorClient({
  serverUrl: "https://play.orkes.io/api",
  keyId: "your-key-id",
  keySecret: "your-key-secret"
});

// 2. Create workflow executor
const executor = new WorkflowExecutor(client);

// 3. Define a simple workflow
const myWorkflow = workflow("hello_world", [
  simpleTask("greet_task", "greeting_task", { message: "Hello World!" })
]);

// 4. Register workflow
await executor.registerWorkflow(true, myWorkflow);

// 5. Start workflow execution
const executionId = await executor.startWorkflow({
  name: "hello_world",
  version: 1,
  input: { name: "Developer" }
});

console.log(`Workflow started with ID: ${executionId}`);
```

## Authentication & Configuration

### Access Control Setup

The SDK supports authentication using API keys. See [Access Control](https://orkes.io/content/docs/getting-started/concepts/access-control) for more details on role-based access control with Conductor and generating API keys.

### Configuration Options

```typescript
import { OrkesApiConfig, orkesConductorClient } from "@io-orkes/conductor-javascript";

const config: Partial<OrkesApiConfig> = {
  serverUrl: "https://play.orkes.io/api", // server api url
  keyId: "your-key-id",                  // authentication key
  keySecret: "your-key-secret",          // authentication secret
  refreshTokenInterval: 0,               // optional: token refresh interval, 0 = no refresh (default: 30min)
  maxHttp2Connections: 1,              // optional: max HTTP2 connections (default: 1)
  useEnvVars: false                      // DEPRECATED: has no effect
};

const client = await orkesConductorClient(config);
```

### Environment Variables

You can configure authentication using environment variables:

```bash
CONDUCTOR_SERVER_URL=https://play.orkes.io/api
CONDUCTOR_AUTH_KEY=your-key-id
CONDUCTOR_AUTH_SECRET=your-key-secret
CONDUCTOR_MAX_HTTP2_CONNECTIONS=1
```
Environment variables are prioritized over config variables.

### Custom Fetch Function

You can provide a custom fetch function for HTTP requests:

```typescript
const client = await orkesConductorClient(config, fetch);
```

## Core Concepts

### Tasks
Tasks are individual units of work that can be executed by workers or handled by the Conductor server.

### Workflows
Workflows are the main orchestration units in Conductor. They define a sequence of tasks and their dependencies.

### Workers
Workers are applications that execute specific types of tasks. They poll for work and execute tasks assigned to them.

### Scheduler
The scheduler allows you to schedule workflows to run at specific times or intervals, enabling automated workflow execution based on time-based triggers.

## Task Types

The SDK provides generators for various task types. These generators can be used in two ways:

1. **Creating Workflows** - Use task generators to build workflow definitions
2. **Registering Metadata** - Use task generators to create task definitions for registration

### Available Task Generators

### Simple Task

```typescript
import { simpleTask } from "@io-orkes/conductor-javascript";

const task = simpleTask("task_ref", "task_name", {
  inputParam: "value"
}, false); // optional parameter
```

### HTTP Task

```typescript
import { httpTask } from "@io-orkes/conductor-javascript";

const task = httpTask("http_ref", "http://api.example.com/data", {
  method: "GET",
  headers: { "Authorization": "Bearer token" },
  connectionTimeOut: 5000,
  readTimeOut: 10000
});
```

### Switch Task

```typescript
import { switchTask } from "@io-orkes/conductor-javascript";

const task = switchTask("switch_ref", "input.status", {
  "active": [simpleTask("active_task", "process_active", {})],
  "inactive": [simpleTask("inactive_task", "process_inactive", {})],
  "default": [simpleTask("default_task", "process_default", {})]
});
```

### Fork-Join Task

```typescript
import { forkJoinTask } from "@io-orkes/conductor-javascript";

const task = forkJoinTask("fork_ref", [
  [simpleTask("task1", "process_1", {})],
  [simpleTask("task2", "process_2", {})],
  [simpleTask("task3", "process_3", {})]
]);
```

### Do-While Task

```typescript
import { doWhileTask } from "@io-orkes/conductor-javascript";

const task = doWhileTask("while_ref", "workflow.variables.counter < 10", [
  simpleTask("loop_task", "process_item", {
    index: "${workflow.variables.counter}"
  }),
  setVariableTask("increment", {
    variableName: "counter",
    value: "${workflow.variables.counter + 1}"
  })
]);
```

### Sub-Workflow Task

```typescript
import { subWorkflowTask } from "@io-orkes/conductor-javascript";

const task = subWorkflowTask("sub_ref", "child_workflow", 1, {
  inputParam: "value"
}, "COMPLETED"); // wait for completion status
```

### Event Task

```typescript
import { eventTask } from "@io-orkes/conductor-javascript";

const task = eventTask("event_ref", "event_name", {
  sink: "event_sink",
  asyncComplete: true
});
```

### Wait Task

```typescript
import { waitTask } from "@io-orkes/conductor-javascript";

const task = waitTask("wait_ref", 30); // wait 30 seconds
```

### Terminate Task

```typescript
import { terminateTask } from "@io-orkes/conductor-javascript";

const task = terminateTask("terminate_ref", "FAILED", "Error message");
```

### Set Variable Task

```typescript
import { setVariableTask } from "@io-orkes/conductor-javascript";

const task = setVariableTask("var_ref", {
  variableName: "result",
  value: "computed_value"
});
```

### JSON JQ Transform Task

```typescript
import { jsonJqTask } from "@io-orkes/conductor-javascript";

const task = jsonJqTask("transform_ref", ".data.items[] | {id: .id, name: .name}");
```

### Kafka Publish Task

```typescript
import { kafkaPublishTask } from "@io-orkes/conductor-javascript";

const task = kafkaPublishTask("kafka_ref", "topic_name", {
  message: "Hello Kafka!"
}, {
  key: "message_key",
  partition: 0
});
```

### Inline Task

```typescript
import { inlineTask } from "@io-orkes/conductor-javascript";

const task = inlineTask("inline_ref", `
  function execute(input) {
    return { result: input.value * 2 };
  }
`);
```

### Dynamic Fork Task

```typescript
import { dynamicForkTask } from "@io-orkes/conductor-javascript";

const task = dynamicForkTask("dynamic_ref", "input.tasks", "task_name");
```

### Join Task

```typescript
import { joinTask } from "@io-orkes/conductor-javascript";

const task = joinTask("join_ref");
```

### Human Task

```typescript
import { humanTask } from "@io-orkes/conductor-javascript";

const task = humanTask("human_ref", "approval_task", {
  assignee: "user@example.com",
  form: {
    fields: [
      { name: "approved", type: "boolean", required: true },
      { name: "comments", type: "text", required: false }
    ]
  }
});
```

### Usage Examples

#### In Workflow Creation
```typescript
import { workflow, simpleTask, httpTask } from "@io-orkes/conductor-javascript";

const myWorkflow = workflow("order_processing", [
  simpleTask("validate_order", "validate_order_task", {}),
  httpTask("call_payment", "https://api.payment.com/charge", {
    method: "POST",
    headers: { "Authorization": "Bearer token" }
  }),
  simpleTask("send_confirmation", "send_email_task", {})
]);
```

#### In Metadata Registration
```typescript
import { MetadataClient, simpleTask, httpTask } from "@io-orkes/conductor-javascript";

const metadataClient = new MetadataClient(client);

// Register individual task definitions
await metadataClient.registerTask(simpleTask("validate_order", "validate_order_task", {}));
await metadataClient.registerTask(httpTask("call_payment", "https://api.payment.com/charge", {
  method: "POST",
  headers: { "Authorization": "Bearer token" }
}));
```

## Workflow Management

### WorkflowExecutor

The `WorkflowExecutor` class provides methods for managing workflows:

```typescript
import { WorkflowExecutor } from "@io-orkes/conductor-javascript";

const executor = new WorkflowExecutor(client);
```

### Workflow Factory

The `workflow` function provides a convenient way to create workflow definitions:

```typescript
import { workflow, simpleTask } from "@io-orkes/conductor-javascript";

const myWorkflow = workflow("workflow_name", [
  simpleTask("task1", "process_1", {}),
  simpleTask("task2", "process_2", {})
]);
```

#### Register Workflow

```typescript
const workflowDef = {
  name: "my_workflow",
  version: 1,
  ownerEmail: "developer@example.com",
  tasks: [/* task definitions */],
  inputParameters: [],
  outputParameters: {},
  timeoutSeconds: 0
};

await executor.registerWorkflow(true, workflowDef);
```

#### Start Workflow

```typescript
const executionId = await executor.startWorkflow({
  name: "my_workflow",
  version: 1,
  input: { /* workflow input */ }
});
```

#### Get Workflow Status

```typescript
const workflowStatus = await executor.getWorkflow(executionId, true);
console.log(`Status: ${workflowStatus.status}`);
```

The `getWorkflow()` method returns a `Workflow` object with the following properties:

```typescript
interface Workflow {
  // Basic identification
  workflowId?: string;
  workflowName?: string;
  workflowVersion?: number;
  
  // Status and timing
  status?: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TIMED_OUT' | 'TERMINATED' | 'PAUSED';
  createTime?: number;
  updateTime?: number;
  startTime?: number;
  endTime?: number;
  lastRetriedTime?: number;
  
  // Data
  input?: Record<string, any>;
  output?: Record<string, any>;
  variables?: Record<string, any>;
  
  // Relationships
  parentWorkflowId?: string;
  parentWorkflowTaskId?: string;
  reRunFromWorkflowId?: string;
  correlationId?: string;
  
  // Tasks and execution
  tasks?: Array<Task>;
  failedReferenceTaskNames?: Array<string>;
  taskToDomain?: Record<string, string>;
  
  // Configuration
  priority?: number;
  externalInputPayloadStoragePath?: string;
  externalOutputPayloadStoragePath?: string;
  
  // Metadata
  ownerApp?: string;
  createdBy?: string;
  updatedBy?: string;
  reasonForIncompletion?: string;
  event?: string;
  workflowDefinition?: WorkflowDef;
}
```

#### Pause Workflow

```typescript
await executor.pauseWorkflow(executionId, "Pausing for maintenance");
```

#### Resume Workflow

```typescript
await executor.resumeWorkflow(executionId);
```

#### Terminate Workflow

```typescript
await executor.terminateWorkflow(executionId, "Terminating due to error");
```

#### Workflow Search

```typescript
const searchResults = await executor.searchWorkflows({
  query: "status:RUNNING",
  start: 0,
  size: 10
});
```

## Worker Management

### Overview

Workers are applications that execute specific types of tasks. The SDK provides two main approaches for managing workers:

- **TaskManager** - High-level interface for managing multiple workers (recommended)
- **TaskRunner** - Low-level interface for individual worker control

### Worker Design Principles

When creating workers, follow these principles:

#### 1. Stateless Workers
Workers should be stateless and not rely on external state:

```typescript
// ✅ Good - Stateless
const worker: ConductorWorker = {
  taskDefName: "process_data",
  execute: async (task) => {
    const result = await processData(task.inputData);
    return { outputData: result, status: "COMPLETED" };
  }
};

// ❌ Bad - Stateful
let processedCount = 0;
const worker: ConductorWorker = {
  taskDefName: "process_data",
  execute: async (task) => {
    processedCount++; // This creates state dependency
    return { outputData: { count: processedCount }, status: "COMPLETED" };
  }
};
```

#### 2. Idempotent Operations
Workers should produce the same result when executed multiple times:

```typescript
// ✅ Good - Idempotent
const worker: ConductorWorker = {
  taskDefName: "update_user",
  execute: async (task) => {
    const { userId, data } = task.inputData;
    await updateUser(userId, data); // Safe to retry
    return { outputData: { updated: true }, status: "COMPLETED" };
  }
};
```

#### 3. Specific Task Types
Each worker should handle one specific task type:

```typescript
// ✅ Good - Specific
const emailWorker: ConductorWorker = {
  taskDefName: "send_email",
  execute: async (task) => {
    await sendEmail(task.inputData);
    return { outputData: { sent: true }, status: "COMPLETED" };
  }
};

// ❌ Bad - Generic
const genericWorker: ConductorWorker = {
  taskDefName: "do_anything",
  execute: async (task) => {
    // Handles multiple different operations - hard to maintain
    if (task.inputData.type === "email") { /* ... */ }
    else if (task.inputData.type === "sms") { /* ... */ }
    // ...
  }
};
```

### TaskManager (Recommended)

`TaskManager` is the high-level interface that manages multiple workers and their corresponding `TaskRunner` instances. It's the recommended approach for most use cases.

```typescript
import { TaskManager, ConductorWorker, DefaultLogger } from "@io-orkes/conductor-javascript";

const workers: ConductorWorker[] = [
  {
    taskDefName: "greeting_task",
    execute: async (task) => {
      return {
        outputData: { greeting: "Hello!" },
        status: "COMPLETED"
      };
    }
  }
];

const manager = new TaskManager(client, workers, {
  logger: new DefaultLogger(),
  options: {
    pollInterval: 1000,
    concurrency: 2,
    workerID: "worker-group-1",
    domain: "production",
    batchPollingTimeout: 100
  },
  onError: (error) => console.error("Worker error:", error),
  maxRetries: 3
});

// Start all workers
await manager.startPolling();

// Update polling options
manager.updatePollingOptions({ pollInterval: 500 });

// Stop all workers
await manager.shutdown();
```

### TaskRunner (Low-level)

`TaskRunner` is the low-level interface used internally by `TaskManager`. It handles individual worker execution, polling the server for work, and updating results back to the server. Use this when you need fine-grained control over a single worker.

```typescript
import { TaskRunner, ConductorWorker, DefaultLogger } from "@io-orkes/conductor-javascript";

const worker: ConductorWorker = {
  taskDefName: "HelloWorldWorker",
  execute: async ({ inputData, taskId }) => {
    return {
      outputData: { greeting: "Hello World" },
      status: "COMPLETED"
    };
  }
};

const taskRunner = new TaskRunner({
  worker: worker,
  taskResource: client.taskResource,
  options: {
    pollInterval: 1000,
    concurrency: 1,
    workerID: "my-worker"
  },
  logger: new DefaultLogger()
});

// Start the worker
await taskRunner.startPolling();

// Stop the worker
await taskRunner.shutdown();
```

### Configuration Options

#### TaskManager Configuration

```typescript
interface TaskManagerConfig {
  logger?: ConductorLogger;
  options?: Partial<TaskManagerOptions>;
  onError?: TaskErrorHandler;
  maxRetries?: number;
}

interface TaskManagerOptions {
  workerID?: string;           // Unique worker identifier
  pollInterval?: number;       // Polling interval in milliseconds
  domain?: string;            // Task domain for isolation
  concurrency?: number;       // Number of concurrent executions
  batchPollingTimeout?: number; // Batch polling timeout
}
```

#### TaskRunner Configuration

```typescript
interface TaskRunnerOptions {
  workerID?: string;
  pollInterval?: number;
  domain?: string;
  concurrency?: number;
  batchPollingTimeout?: number;
}
```

### When to Use Each Approach

- **Use TaskManager** when you have multiple workers or want the convenience of managing all workers together
- **Use TaskRunner** when you need fine-grained control over a single worker or want to implement custom worker management logic

## Task Management

### TaskClient

The `TaskClient` provides additional task management capabilities for querying and updating existing tasks:

```typescript
import { TaskClient } from "@io-orkes/conductor-javascript";

const taskClient = new TaskClient(client);

// Search tasks
const searchResults = await taskClient.search(0, 10, "", "*", "status:COMPLETED");

// Get task by ID
const task = await taskClient.getTask(taskId);

// Update task result
await taskClient.updateTaskResult(
  workflowId,
  taskReferenceName,
  "COMPLETED",
  { result: "success" }
);
```

### Task Status and Monitoring

Tasks in Conductor have various statuses that indicate their current state:

- **SCHEDULED**: Task is scheduled for execution
- **IN_PROGRESS**: Task is currently being executed
- **COMPLETED**: Task completed successfully
- **COMPLETED_WITH_ERRORS**: Task completed but with errors
- **FAILED**: Task execution failed
- **FAILED_WITH_TERMINAL_ERROR**: Task failed with a terminal error (no retries)
- **TIMED_OUT**: Task execution timed out
- **CANCELED**: Task was canceled
- **SKIPPED**: Task was skipped

### Task Search and Filtering

You can search for tasks using various criteria:

```typescript
// Search by status
const completedTasks = await taskClient.search(0, 10, "", "*", "status:COMPLETED");

// Search by workflow
const workflowTasks = await taskClient.search(0, 10, "", "*", "workflowId:workflow-123");

// Search by task type
const simpleTasks = await taskClient.search(0, 10, "", "*", "taskType:SIMPLE");

// Search by free text
const textSearch = await taskClient.search(0, 10, "", "error", "");

// Search with sorting
const sortedTasks = await taskClient.search(0, 10, "startTime:DESC", "*", "status:FAILED");
```

### Task Debugging

When debugging task execution issues:

```typescript
try {
  // Get detailed task information
  const task = await taskClient.getTask(taskId);

  console.log("Task Status:", task.status);
  console.log("Task Input:", task.inputData);
  console.log("Task Output:", task.outputData);
  console.log("Retry Count:", task.retryCount);
  console.log("Execution Time:", task.endTime - task.startTime);

  // Check for failed tasks
  const failedTasks = await taskClient.search(0, 50, "", "*", "status:FAILED");
  failedTasks.results.forEach(task => {
    console.log(`Task ${task.taskId} failed: ${task.reasonForIncompletion}`);
  });
} catch (error) {
  console.error("Error debugging tasks:", error);
}
```

### Task Search Parameters

The `search` method accepts the following parameters:

- `start`: Starting index for pagination (default: 0)
- `size`: Number of results to return (default: 100)
- `sort`: Sort field and direction (e.g., "startTime:DESC", "status:ASC")
- `freeText`: Free text search term (use "*" for all)
- `query`: Structured query string (e.g., "status:FAILED", "workflowId:workflow-123")

### Common Search Queries

```typescript
// Find all failed tasks
const failedTasks = await taskClient.search(0, 100, "startTime:DESC", "*", "status:FAILED");

// Find tasks for a specific workflow
const workflowTasks = await taskClient.search(0, 100, "", "*", "workflowId:my-workflow-123");

// Find tasks by worker ID
const workerTasks = await taskClient.search(0, 100, "", "*", "workerId:worker-123");

// Find tasks with specific input data
const inputTasks = await taskClient.search(0, 100, "", "*", "inputData.orderId:order-123");

// Find tasks that timed out
const timeoutTasks = await taskClient.search(0, 100, "endTime:DESC", "*", "status:TIMED_OUT");
```

## Scheduler Management

### SchedulerClient

The `SchedulerClient` manages workflow scheduling:

```typescript
import { SchedulerClient } from "@io-orkes/conductor-javascript";

const scheduler = new SchedulerClient(client);

// Create a schedule
await scheduler.saveSchedule({
  name: "daily_report",
  cronExpression: "0 0 9 * * ?", // Every day at 9 AM
  startWorkflowRequest: {
    name: "report_workflow",
    version: 1,
    input: { reportType: "daily" }
  }
});

// Get schedule
const schedule = await scheduler.getSchedule("daily_report");

// Pause schedule
await scheduler.pauseSchedule("daily_report");

// Resume schedule
await scheduler.resumeSchedule("daily_report");

// Delete schedule
await scheduler.deleteSchedule("daily_report");

// Get all schedules
const allSchedules = await scheduler.getAllSchedules();

// Get next few execution times
const nextExecutions = await scheduler.getNextFewSchedules(
  "0 0 9 * * ?",
  Date.now(),
  Date.now() + 7 * 24 * 60 * 60 * 1000, // Next 7 days
  5
);

// Search schedule executions
const executions = await scheduler.search(0, 10, "", "", "status:RUNNING");

// Pause all schedules (debugging only)
await scheduler.pauseAllSchedules();

// Resume all schedules
await scheduler.resumeAllSchedules();

// Requeue all execution records
await scheduler.requeueAllExecutionRecords();
```

## Service Registry

### ServiceRegistryClient

The `ServiceRegistryClient` manages service registrations and circuit breakers:

```typescript
import { ServiceRegistryClient } from "@io-orkes/conductor-javascript";

const serviceRegistry = new ServiceRegistryClient(client);

// Register a service
await serviceRegistry.addOrUpdateService({
  name: "user-service",
  type: "HTTP",
  serviceURI: "https://api.example.com/users",
  circuitBreakerConfig: {
    failureRateThreshold: 50.0,
    slidingWindowSize: 10,
    minimumNumberOfCalls: 5,
    waitDurationInOpenState: 60000
  }
});

// Get all registered services
const services = await serviceRegistry.getRegisteredServices();

// Get specific service
const service = await serviceRegistry.getService("user-service");

// Add service method
await serviceRegistry.addOrUpdateServiceMethod("user-service", {
  operationName: "getUser",
  methodName: "getUser",
  methodType: "GET",
  inputType: "string",
  outputType: "User",
  requestParams: [
    {
      name: "id",
      type: "Path",
      required: true,
      schema: { type: "string" }
    }
  ]
});

// Circuit breaker management
await serviceRegistry.openCircuitBreaker("user-service");
await serviceRegistry.closeCircuitBreaker("user-service");
const status = await serviceRegistry.getCircuitBreakerStatus("user-service");

// Proto file management (for gRPC services)
await serviceRegistry.setProtoData("grpc-service", "user.proto", protoBlob);
const protoData = await serviceRegistry.getProtoData("grpc-service", "user.proto");
const allProtos = await serviceRegistry.getAllProtos("grpc-service");
await serviceRegistry.deleteProto("grpc-service", "user.proto");

// Service discovery
const methods = await serviceRegistry.discover("user-service", true);

// Remove service
await serviceRegistry.removeService("user-service");
```

## Metadata Management

### MetadataClient

The `MetadataClient` class provides methods for managing task and workflow definitions:

```typescript
import { MetadataClient } from "@io-orkes/conductor-javascript";

const metadataClient = new MetadataClient(client);
```

### Task Definition Factory

The `taskDefinition` function provides a convenient way to create task definitions:

```typescript
import { taskDefinition } from "@io-orkes/conductor-javascript";

const taskDef = taskDefinition("task_name", {
  timeoutSeconds: 300,
  retryCount: 3,
  retryDelaySeconds: 60,
  responseTimeoutSeconds: 300,
  pollTimeoutSeconds: 300,
  pollIntervalSeconds: 30,
  concurrentExecLimit: 10,
  rateLimitPerFrequency: 100,
  rateLimitFrequencyInSeconds: 60,
  ownerEmail: "owner@example.com",
  description: "Task description",
  inputTemplate: {
    param1: "default_value"
  },
  outputTemplate: {
    result: "computed_value"
  },
  inputKeys: ["param1", "param2"],
  outputKeys: ["result"],
  tags: ["tag1", "tag2"],
  executionNameSpace: "namespace",
  isolationGroupId: "isolation_group",
  maxConcurrentExecutions: 5
});
```

#### Register Task Definition

```typescript
const taskDef = {
  name: "process_order",
  description: "Process customer order",
  timeoutSeconds: 300,
  retryCount: 3,
  retryDelaySeconds: 60,
  responseTimeoutSeconds: 300,
  pollTimeoutSeconds: 300,
  pollIntervalSeconds: 30,
  concurrentExecLimit: 10,
  rateLimitPerFrequency: 100,
  rateLimitFrequencyInSeconds: 60,
  ownerEmail: "owner@example.com",
  inputTemplate: {
    orderId: "string",
    customerId: "string"
  },
  outputTemplate: {
    processedOrderId: "string",
    status: "string"
  },
  inputKeys: ["orderId", "customerId"],
  outputKeys: ["processedOrderId", "status"],
  tags: ["order", "processing"],
  executionNameSpace: "orders",
  isolationGroupId: "order_processing",
  maxConcurrentExecutions: 5
};

await metadataClient.registerTask(taskDef);
```

#### Update Task Definition

```typescript
const updatedTaskDef = {
  ...taskDef,
  timeoutSeconds: 600, // Increased timeout
  retryCount: 5 // Increased retry count
};

await metadataClient.updateTask(taskDef.name, updatedTaskDef);
```

#### Unregister Task Definition

```typescript
await metadataClient.unregisterTask("process_order");
```

#### Register Workflow Definition

```typescript
const workflowDef = {
  name: "order_processing_workflow",
  version: 1,
  description: "Complete order processing workflow",
  tasks: [
    {
      name: "validate_order",
      taskReferenceName: "validate_order_ref",
      type: "SIMPLE",
      inputParameters: {
        orderId: "${workflow.input.orderId}"
      }
    },
    {
      name: "process_payment",
      taskReferenceName: "process_payment_ref",
      type: "SIMPLE",
      inputParameters: {
        orderId: "${workflow.input.orderId}",
        amount: "${workflow.input.amount}"
      }
    },
    {
      name: "send_confirmation",
      taskReferenceName: "send_confirmation_ref",
      type: "SIMPLE",
      inputParameters: {
        orderId: "${workflow.input.orderId}",
        customerEmail: "${workflow.input.customerEmail}"
      }
    }
  ],
  inputParameters: ["orderId", "amount", "customerEmail"],
  outputParameters: {
    processedOrderId: "${validate_order_ref.output.processedOrderId}",
    paymentStatus: "${process_payment_ref.output.status}",
    confirmationSent: "${send_confirmation_ref.output.sent}"
  },
  failureWorkflow: "order_failure_workflow",
  restartable: true,
  workflowStatusListenerEnabled: true,
  schemaVersion: 2,
  ownerEmail: "workflow-owner@example.com",
  timeoutPolicy: "ALERT_ONLY",
  timeoutSeconds: 3600,
  variables: {
    maxRetries: 3,
    retryDelay: 60
  }
};

await metadataClient.registerWorkflowDef(workflowDef);
```

#### Unregister Workflow Definition

```typescript
await metadataClient.unregisterWorkflow("order_processing_workflow", 1);
```

### TemplateClient

The `TemplateClient` class provides methods for managing human task templates:

```typescript
import { TemplateClient } from "@io-orkes/conductor-javascript";

const templateClient = new TemplateClient(client);
```

#### Register Form Template

```typescript
const formTemplate = {
  name: "approval_form",
  version: 1,
  description: "Order approval form template",
  formTemplate: {
    name: "Order Approval Form",
    fields: [
      {
        name: "approved",
        type: "boolean",
        required: true,
        label: "Approve Order",
        description: "Check to approve the order"
      },
      {
        name: "comments",
        type: "text",
        required: false,
        label: "Comments",
        description: "Additional comments about the approval decision",
        maxLength: 500
      },
      {
        name: "approver_name",
        type: "text",
        required: true,
        label: "Approver Name",
        description: "Name of the person approving the order"
      },
      {
        name: "approval_date",
        type: "date",
        required: true,
        label: "Approval Date",
        description: "Date of approval"
      }
    ],
    validationRules: [
      {
        field: "approved",
        rule: "required",
        message: "Approval decision is required"
      },
      {
        field: "approver_name",
        rule: "minLength:2",
        message: "Approver name must be at least 2 characters"
      }
    ]
  },
  uiTemplate: {
    name: "Order Approval UI",
    template: `
      <div class="approval-form">
        <h2>Order Approval</h2>
        <div class="form-group">
          <label>
            <input type="checkbox" name="approved" required>
            Approve Order
          </label>
        </div>
        <div class="form-group">
          <label for="comments">Comments:</label>
          <textarea name="comments" rows="4" cols="50" maxlength="500"></textarea>
        </div>
        <div class="form-group">
          <label for="approver_name">Approver Name:</label>
          <input type="text" name="approver_name" required minlength="2">
        </div>
        <div class="form-group">
          <label for="approval_date">Approval Date:</label>
          <input type="date" name="approval_date" required>
        </div>
      </div>
    `,
    styles: `
      .approval-form {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        font-family: Arial, sans-serif;
      }
      .form-group {
        margin-bottom: 15px;
      }
      .form-group label {
        display: block;
        margin-bottom: 5px;
        font-weight: bold;
      }
      .form-group input,
      .form-group textarea {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
      }
      .form-group input[type="checkbox"] {
        width: auto;
        margin-right: 8px;
      }
    `
  },
  tags: ["approval", "order", "form"],
  ownerEmail: "template-owner@example.com"
};

await templateClient.registerTemplate(formTemplate);
```

#### Register UI Template

```typescript
const uiTemplate = {
  name: "custom_ui_template",
  version: 1,
  description: "Custom UI template for human tasks",
  uiTemplate: {
    name: "Custom Task UI",
    template: `
      <div class="custom-task-ui">
        <h1>Custom Task Interface</h1>
        <div class="task-content">
          <p>Task: {{taskName}}</p>
          <p>Description: {{taskDescription}}</p>
          <div class="task-inputs">
            <!-- Dynamic form fields based on task input -->
            {{#each taskInputs}}
            <div class="input-field">
              <label for="{{name}}">{{label}}:</label>
              <input type="{{type}}" name="{{name}}" value="{{value}}" {{#if required}}required{{/if}}>
            </div>
            {{/each}}
          </div>
          <div class="task-actions">
            <button type="button" onclick="completeTask()">Complete Task</button>
            <button type="button" onclick="failTask()">Fail Task</button>
          </div>
        </div>
      </div>
    `,
    styles: `
      .custom-task-ui {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
        background-color: #f5f5f5;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }
      .custom-task-ui h1 {
        color: #333;
        text-align: center;
        margin-bottom: 30px;
      }
      .task-content {
        background-color: white;
        padding: 20px;
        border-radius: 6px;
        margin-bottom: 20px;
      }
      .input-field {
        margin-bottom: 15px;
      }
      .input-field label {
        display: block;
        margin-bottom: 5px;
        font-weight: 600;
        color: #555;
      }
      .input-field input {
        width: 100%;
        padding: 10px;
        border: 2px solid #e1e1e1;
        border-radius: 4px;
        font-size: 14px;
        transition: border-color 0.3s ease;
      }
      .input-field input:focus {
        outline: none;
        border-color: #007bff;
      }
      .task-actions {
        text-align: center;
        margin-top: 20px;
      }
      .task-actions button {
        background-color: #007bff;
        color: white;
        border: none;
        padding: 12px 24px;
        margin: 0 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.3s ease;
      }
      .task-actions button:hover {
        background-color: #0056b3;
      }
      .task-actions button:last-child {
        background-color: #dc3545;
      }
      .task-actions button:last-child:hover {
        background-color: #c82333;
      }
    `,
    scripts: `
      function completeTask() {
        const formData = new FormData(document.querySelector('.custom-task-ui'));
        const outputData = {};
        for (let [key, value] of formData.entries()) {
          outputData[key] = value;
        }
        
        // Send completion data to Conductor
        fetch('/api/tasks/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            taskId: '{{taskId}}',
            outputData: outputData,
            status: 'COMPLETED'
          })
        })
        .then(response => response.json())
        .then(data => {
          alert('Task completed successfully!');
          window.close();
        })
        .catch(error => {
          console.error('Error completing task:', error);
          alert('Error completing task. Please try again.');
        });
      }
      
      function failTask() {
        const reason = prompt('Please provide a reason for failing the task:');
        if (reason) {
          fetch('/api/tasks/fail', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              taskId: '{{taskId}}',
              reasonForIncompletion: reason,
              status: 'FAILED'
            })
          })
          .then(response => response.json())
          .then(data => {
            alert('Task marked as failed.');
            window.close();
          })
          .catch(error => {
            console.error('Error failing task:', error);
            alert('Error failing task. Please try again.');
          });
        }
      }
    `
  },
  tags: ["ui", "custom", "template"],
  ownerEmail: "ui-developer@example.com"
};

await templateClient.registerTemplate(uiTemplate);
```

## Human Tasks

### HumanExecutor

The `HumanExecutor` class provides comprehensive human task management:

```typescript
import { HumanExecutor } from "@io-orkes/conductor-javascript";

const humanExecutor = new HumanExecutor(client);

// Search human tasks
const tasks = await humanExecutor.search({
  states: ["PENDING", "ASSIGNED"],
  assignees: [{ userType: "EXTERNAL_USER", user: "john@example.com" }],
  taskRefNames: ["approval_task"],
  taskInputQuery: "priority:high",
  size: 10,
  start: 0
});

// Poll for tasks until found
const polledTasks = await humanExecutor.pollSearch({
  states: ["PENDING"],
  assignees: [{ userType: "EXTERNAL_USER", user: "john@example.com" }]
}, {
  pollInterval: 1000,
  maxPollTimes: 30
});

// Get task by ID
const task = await humanExecutor.getTaskById(taskId);

// Claim task as external user
const claimedTask = await humanExecutor.claimTaskAsExternalUser(
  taskId, 
  "john@example.com",
  { overrideAssignment: false, withTemplate: true }
);

// Claim task as conductor user
const conductorClaimedTask = await humanExecutor.claimTaskAsConductorUser(
  taskId,
  { overrideAssignment: false, withTemplate: true }
);

// Release task
await humanExecutor.releaseTask(taskId);

// Update task output
await humanExecutor.updateTaskOutput(taskId, {
  output: {
    approved: true,
    comments: "Approved with conditions"
  }
});

// Complete task
await humanExecutor.completeTask(taskId, {
  output: {
    approved: true,
    comments: "Task completed"
  }
});

// Get template by name and version
const template = await humanExecutor.getTemplateByNameVersion("approval_template", 1);

// Get template by ID (deprecated, use getTemplateByNameVersion)
const templateById = await humanExecutor.getTemplateById("approval_template");
```

## SDK Factory Functions

The `MetadataClient` manages task and workflow definitions:

```typescript
import { MetadataClient } from "@io-orkes/conductor-javascript";

const metadataClient = new MetadataClient(client);

// Register a task definition
await metadataClient.registerTask({
  name: "email_sender",
  description: "Sends email notifications",
  timeoutSeconds: 300,
  retryCount: 3,
  retryDelaySeconds: 60,
  retryLogic: "FIXED",
  timeoutPolicy: "RETRY",
  inputKeys: ["to", "subject", "body"],
  outputKeys: ["messageId", "status"],
  rateLimitPerFrequency: 100,
  rateLimitFrequencyInSeconds: 60
});

// Update an existing task definition
await metadataClient.updateTask({
  name: "email_sender",
  description: "Updated email sender task",
  timeoutSeconds: 600, // Increased timeout
  retryCount: 5,       // Increased retries
  // ... other properties
});

// Unregister a task definition
await metadataClient.unregisterTask("email_sender");

// Register a workflow definition
await metadataClient.registerWorkflowDef({
  name: "notification_workflow",
  version: 1,
  description: "Sends notifications to users",
  tasks: [
    simpleTask("send_email", "email_sender", {}),
    simpleTask("send_sms", "sms_sender", {})
  ],
  inputParameters: ["userId", "message"],
  outputParameters: {
    emailSent: "${send_email.output.success}",
    smsSent: "${send_sms.output.success}"
  },
  timeoutSeconds: 3600,
  timeoutPolicy: "ALERT_ONLY",
  retryPolicy: {
    retryCount: 2,
    retryDelaySeconds: 120,
    retryLogic: "EXPONENTIAL_BACKOFF"
  }
}, true); // overwrite = true

// Unregister a workflow definition
await metadataClient.unregisterWorkflow("notification_workflow", 1);
```

### TemplateClient

The `TemplateClient` manages human task templates:

```typescript
import { TemplateClient } from "@io-orkes/conductor-javascript";

const templateClient = new TemplateClient(client);

// Register a human task template
await templateClient.registerTemplate({
  name: "approval_template",
  version: 1,
  description: "Template for approval tasks",
  formTemplate: {
    fields: [
      {
        name: "approved",
        type: "boolean",
        required: true,
        description: "Whether the request is approved"
      },
      {
        name: "comments",
        type: "text",
        required: false,
        description: "Additional comments"
      },
      {
        name: "priority",
        type: "select",
        required: true,
        options: ["low", "medium", "high"],
        defaultValue: "medium"
      }
    ]
  },
  uiTemplate: {
    template: `
      <div class="approval-form">
        <h3>Approval Request</h3>
        <div class="field">
          <label>Approved:</label>
          <input type="checkbox" name="approved" />
        </div>
        <div class="field">
          <label>Comments:</label>
          <textarea name="comments" rows="4"></textarea>
        </div>
        <div class="field">
          <label>Priority:</label>
          <select name="priority">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>
    `
  }
}, false); // asNewVersion = false

// Register a new version of existing template
await templateClient.registerTemplate({
  name: "approval_template",
  version: 2,
  description: "Updated approval template with new fields",
  formTemplate: {
    fields: [
      {
        name: "approved",
        type: "boolean",
        required: true
      },
      {
        name: "comments",
        type: "text",
        required: false
      },
      {
        name: "approver",
        type: "text",
        required: true,
        description: "Name of the approver"
      },
      {
        name: "approvalDate",
        type: "date",
        required: true,
        description: "Date of approval"
      }
    ]
  }
}, true); // asNewVersion = true
```

## SDK Factory Functions

### Workflow Factory

```typescript
import { workflow } from "@io-orkes/conductor-javascript";

const myWorkflow = workflow("workflow_name", [
  simpleTask("task1", "process_1", {}),
  simpleTask("task2", "process_2", {})
]);
```

### Task Definition Factory

```typescript
import { taskDefinition } from "@io-orkes/conductor-javascript";

const taskDef = taskDefinition("task_name", {
  timeoutSeconds: 300,
  retryCount: 3,
  retryDelaySeconds: 60,
  retryLogic: "FIXED",
  timeoutPolicy: "RETRY",
  inputKeys: ["param1", "param2"],
  outputKeys: ["result"],
  rateLimitPerFrequency: 100,
  rateLimitFrequencyInSeconds: 60
});
```

## Error Handling

### Worker Error Handling

```typescript
const worker: ConductorWorker = {
  taskDefName: "error_prone_task",
  execute: async (task) => {
    try {
      const result = await riskyOperation(task.inputData);
      return {
        outputData: result,
        status: "COMPLETED"
      };
    } catch (error) {
      return {
        outputData: {},
        status: "FAILED",
        reasonForIncompletion: error.message
      };
    }
  }
};
```

### Task Manager Error Handling

```typescript
const manager = new TaskManager(client, workers, {
  onError: (error, task) => {
    console.error(`Error processing task ${task.taskId}:`, error);
    // Custom error handling logic
  },
  maxRetries: 3
});
```

### Workflow Error Handling

```typescript
try {
  const executionId = await executor.startWorkflow({
    name: "workflow_name",
    version: 1,
    input: {}
  });
} catch (error) {
  console.error("Failed to start workflow:", error);
}
```

## Logging

### Default Logger

```typescript
import { DefaultLogger } from "@io-orkes/conductor-javascript";

const logger = new DefaultLogger();
```

### Custom Logger

```typescript
import { ConductorLogger } from "@io-orkes/conductor-javascript";

class CustomLogger implements ConductorLogger {
  info(message: string, ...args: any[]): void {
    console.log(`[INFO] ${message}`, ...args);
  }
  
  error(message: string, ...args: any[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  }
  
  debug(message: string, ...args: any[]): void {
    console.debug(`[DEBUG] ${message}`, ...args);
  }
}

const manager = new TaskManager(client, workers, {
  logger: new CustomLogger()
});
```

## Best Practices

### Worker Design

1. **Stateless**: Workers should be stateless and not maintain workflow-specific state
2. **Idempotent**: Workers should handle cases where tasks are rescheduled due to timeouts
3. **Specific**: Each worker should execute a very specific task with well-defined inputs/outputs
4. **No Retry Logic**: Let Conductor handle retries; workers should focus on task execution

### Workflow Design

1. **Clear Naming**: Use descriptive names for workflows and tasks
2. **Versioning**: Always version your workflows
3. **Input Validation**: Validate workflow inputs
4. **Error Handling**: Include proper error handling in workflows

### Performance

1. **Polling Intervals**: Adjust polling intervals based on your workload
2. **Concurrency**: Set appropriate concurrency levels for workers
3. **Batch Polling**: Use batch polling for better performance
4. **Connection Pooling**: Configure HTTP connection pooling with `maxHttp2Connections`

### Security

1. **Environment Variables**: Use environment variables for sensitive configuration
2. **Access Control**: Implement proper access control
3. **Input Validation**: Validate all inputs to prevent injection attacks
4. **Secure Communication**: Use HTTPS for all communications

## API Reference

### Core Classes

- `WorkflowExecutor`: Main class for workflow management
- `TaskManager`: Manages multiple workers
- `TaskRunner`: Handles individual worker execution
- `TaskClient`: Additional task management capabilities
- `SchedulerClient`: Manages workflow scheduling
- `ServiceRegistryClient`: Manages service registrations and circuit breakers
- `HumanExecutor`: Comprehensive human task management
- `TemplateClient`: Manages human task templates
- `MetadataClient`: Manages task and workflow definitions
- `ConductorWorker`: Interface for defining workers

### Task Generators

- `simpleTask()`: Creates simple tasks
- `httpTask()`: Creates HTTP tasks
- `switchTask()`: Creates conditional tasks
- `forkJoinTask()`: Creates parallel execution tasks
- `doWhileTask()`: Creates loop tasks
- `subWorkflowTask()`: Creates sub-workflow tasks
- `eventTask()`: Creates event-driven tasks
- `waitTask()`: Creates wait tasks
- `terminateTask()`: Creates termination tasks
- `setVariableTask()`: Creates variable setting tasks
- `jsonJqTask()`: Creates JSON transformation tasks
- `kafkaPublishTask()`: Creates Kafka publishing tasks
- `inlineTask()`: Creates inline script tasks
- `dynamicForkTask()`: Creates dynamic fork tasks
- `joinTask()`: Creates join tasks
- `humanTask()`: Creates human tasks

### Factory Functions

- `workflow()`: Creates workflow definitions
- `taskDefinition()`: Creates task definitions

### Configuration Options

#### OrkesApiConfig
- `serverUrl`: Conductor server URL
- `keyId`: Authentication key ID
- `keySecret`: Authentication key secret
- `refreshTokenInterval`: Token refresh interval (0 = no refresh)
- `maxHttp2Connections`: Maximum HTTP2 connections (default: 1)
- `useEnvVars`: DEPRECATED, has no effect

#### TaskManagerOptions
- `pollInterval`: Polling interval in milliseconds
- `concurrency`: Number of concurrent task executions
- `workerID`: Unique worker identifier
- `domain`: Task domain
- `batchPollingTimeout`: Batch polling timeout

#### Environment Variables
- `CONDUCTOR_SERVER_URL`: Server URL
- `CONDUCTOR_AUTH_KEY`: Authentication key
- `CONDUCTOR_AUTH_SECRET`: Authentication secret
- `CONDUCTOR_MAX_HTTP2_CONNECTIONS`: Maximum HTTP2 connections

## Examples

### Complete Example: Order Processing Workflow

```typescript
import {
  orkesConductorClient,
  WorkflowExecutor,
  TaskManager,
  SchedulerClient,
  workflow,
  simpleTask,
  switchTask,
  forkJoinTask,
  httpTask
} from "@io-orkes/conductor-javascript";

async function setupOrderProcessing() {
  // Create client
  const client = await orkesConductorClient({
  serverUrl: "https://play.orkes.io/api",
    keyId: "your-key-id",
    keySecret: "your-key-secret"
});

  // Create workflow executor
const executor = new WorkflowExecutor(client);
  const scheduler = new SchedulerClient(client);

  // Define order processing workflow
  const orderWorkflow = workflow("order_processing", [
    // Validate order
    simpleTask("validate_order", "order_validation", {}),
    
    // Check inventory
    httpTask("check_inventory", "https://inventory-api.com/check", {
      method: "POST"
    }),
    
    // Process payment based on payment method
    switchTask("process_payment", "input.paymentMethod", {
      "credit_card": [
        httpTask("charge_card", "https://payment-api.com/charge", {
          method: "POST"
        })
      ],
      "paypal": [
        httpTask("paypal_payment", "https://paypal-api.com/pay", {
          method: "POST"
        })
      ],
      "default": [
        simpleTask("manual_payment", "manual_payment_processing", {})
      ]
    }),
    
    // Parallel fulfillment tasks
    forkJoinTask("fulfillment", [
      [httpTask("update_inventory", "https://inventory-api.com/update", {
        method: "POST"
      })],
      [simpleTask("send_notification", "email_notification", {})],
      [simpleTask("create_shipment", "shipping_task", {})]
    ]),
    
    // Final confirmation
    simpleTask("confirm_order", "order_confirmation", {})
  ]);

  // Register workflow
  await executor.registerWorkflow(true, orderWorkflow);

  // Schedule daily order processing
  await scheduler.saveSchedule({
    name: "daily_order_processing",
    cronExpression: "0 0 2 * * ?", // Every day at 2 AM
    startWorkflowRequest: {
      name: "order_processing",
  version: 1,
      input: { batchProcessing: true }
    }
  });

  // Define workers
  const workers = [
    {
      taskDefName: "order_validation",
      execute: async (task) => {
        const order = task.inputData;
        // Validate order logic
        return {
          outputData: { valid: true, orderId: order.id },
          status: "COMPLETED"
        };
      }
    },
    {
      taskDefName: "email_notification",
      execute: async (task) => {
        // Send email logic
        return {
          outputData: { sent: true },
          status: "COMPLETED"
        };
      }
    },
    {
      taskDefName: "shipping_task",
      execute: async (task) => {
        // Create shipping label logic
        return {
          outputData: { trackingNumber: "TRK123456" },
          status: "COMPLETED"
        };
      }
    }
  ];

  // Create task manager
  const manager = new TaskManager(client, workers, {
    options: {
      pollInterval: 1000,
      concurrency: 2,
      workerID: "order-processor",
      domain: "production"
    }
  });

  // Start workers
  manager.startPolling();

  // Start workflow execution
const executionId = await executor.startWorkflow({
    name: "order_processing",
  version: 1,
    input: {
      orderId: "ORD-123",
      customerId: "CUST-456",
      paymentMethod: "credit_card",
      items: [{ id: "ITEM-1", quantity: 2 }]
    }
  });

  console.log(`Order processing started: ${executionId}`);
  
  return { executor, manager, scheduler, executionId };
}
```

## Troubleshooting

### Common Issues

#### Authentication Errors

```typescript
// Check your credentials
const client = await orkesConductorClient({
  serverUrl: "https://play.orkes.io/api",
  keyId: "your-key-id",      // Make sure this is correct
  keySecret: "your-key-secret" // Make sure this is correct
});
```

#### Worker Not Receiving Tasks

1. Check if the worker is registered with the correct task definition name
2. Verify the task manager is polling
3. Check the Conductor server logs for errors
4. Verify the domain configuration matches

#### Workflow Execution Issues

1. Verify the workflow is registered
2. Check workflow input parameters
3. Review task dependencies
4. Check scheduler status if using scheduled workflows

#### Service Registry Issues

1. Verify service is properly registered
2. Check circuit breaker status
3. Ensure service URI is accessible
4. Verify proto files for gRPC services

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
import { DefaultLogger } from "@io-orkes/conductor-javascript";

const logger = new DefaultLogger();
logger.debug("Debug message", { data: "value" });
```

### Health Checks

```typescript
// Check if the Conductor server is healthy
const health = await client.healthCheckResource.healthCheck();
console.log("Server health:", health);

// Check scheduler status
const schedules = await scheduler.getAllSchedules();
console.log("Active schedules:", schedules.length);

// Check service registry
const services = await serviceRegistry.getRegisteredServices();
console.log("Registered services:", services.length);
```

---

For more examples and detailed API documentation, visit the [GitHub repository](https://github.com/conductor-sdk/conductor-javascript) or the [Orkes Conductor documentation](https://orkes.io/content/docs/).