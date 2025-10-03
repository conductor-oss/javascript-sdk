# Conductor OSS JavaScript/TypeScript SDK

A comprehensive TypeScript/JavaScript client for [Conductor OSS](https://github.com/conductor-oss/conductor), enabling developers to build, orchestrate, and monitor distributed workflows with ease.

[Conductor](https://www.conductor-oss.org/) is the leading open-source orchestration platform allowing developers to build highly scalable distributed applications.

Check out the [official documentation for Conductor](https://orkes.io/content).

## ⭐ Conductor OSS

Show support for the Conductor OSS.  Please help spread the awareness by starring Conductor repo.

[![GitHub stars](https://img.shields.io/github/stars/conductor-oss/conductor.svg?style=social&label=Star&maxAge=)](https://GitHub.com/conductor-oss/conductor/)

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Authentication & Configuration](#authentication--configuration)
  - [Access Control Setup](#access-control-setup)
  - [Configuration Options](#configuration-options)
  - [Environment Variables](#environment-variables)
  - [Custom Fetch Function](#custom-fetch-function)
- [Core Concepts](#core-concepts)
  - [What are Tasks?](#what-are-tasks)
  - [What are Workflows?](#what-are-workflows)
  - [What are Workers?](#what-are-workers)
  - [What is the Scheduler?](#what-is-the-scheduler)
- [Task Types](#task-types)
  - [System Tasks - Managed by Conductor Server](#system-tasks---managed-by-conductor-server)
  - [SIMPLE Tasks - Require Custom Workers](#simple-tasks---require-custom-workers)
- [Workflows](#workflows)
  - [WorkflowExecutor](#workflowexecutor)
  - [Creating Workflows](#creating-workflows)
  - [Task Generators Reference](#task-generators-reference)
    - [Simple Task](#simple-task)
    - [HTTP Task](#http-task)
    - [Switch Task](#switch-task)
    - [Fork-Join Task](#fork-join-task)
    - [Do-While Task](#do-while-task)
    - [Sub-Workflow Task](#sub-workflow-task)
    - [Event Task](#event-task)
    - [Wait Task](#wait-task)
    - [Terminate Task](#terminate-task)
    - [Set Variable Task](#set-variable-task)
    - [JSON JQ Transform Task](#json-jq-transform-task)
    - [Kafka Publish Task](#kafka-publish-task)
    - [Inline Task](#inline-task)
    - [Dynamic Fork Task](#dynamic-fork-task)
    - [Join Task](#join-task)
    - [Human Task](#human-task)
  - [Managing Workflow Execution](#managing-workflow-execution)
  - [WorkflowExecutor API Reference](#workflowexecutor-api-reference)
  - [Monitoring & Debugging Tasks](#monitoring--debugging-tasks)
    - [Task Statuses](#task-statuses)
    - [Searching & Filtering Tasks](#searching--filtering-tasks)
    - [Common Search Queries](#common-search-queries)
- [Workers](#workers)
  - [Overview](#overview)
  - [Quick Start: Your First Worker](#quick-start-your-first-worker)
  - [Understanding Worker Execution Flow](#understanding-worker-execution-flow)
  - [Worker Design Principles](#worker-design-principles)
  - [Handling Task Results](#handling-task-results)
  - [Working with Multiple Workers](#working-with-multiple-workers)
  - [TaskManager Advanced Configuration](#taskmanager-advanced-configuration)
    - [Dynamic Configuration Updates](#dynamic-configuration-updates)
    - [Graceful Shutdown](#graceful-shutdown)
- [Scheduling](#scheduling)
  - [SchedulerClient](#schedulerclient)
- [Service Registry](#service-registry)
  - [ServiceRegistryClient](#serviceregistryclient)
- [Metadata](#metadata)
  - [MetadataClient](#metadataclient)
  - [Task Definition Factory](#task-definition-factory)
  - [Register Task Definition](#register-task-definition)
  - [Update Task Definition](#update-task-definition)
  - [Unregister Task Definition](#unregister-task-definition)
  - [Register Workflow Definition](#register-workflow-definition)
  - [Unregister Workflow Definition](#unregister-workflow-definition)
- [Human Tasks](#human-tasks)
  - [HumanExecutor](#humanexecutor)
  - [TemplateClient](#templateclient)
    - [Register Form Template](#register-form-template)
    - [Register UI Template](#register-ui-template)

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
  serverUrl: "https://play.orkes.io/api",  // Required: server api url
  keyId: "your-key-id",                    // Required for server with auth: authentication key
  keySecret: "your-key-secret",            // Required for server with auth: authentication secret
  refreshTokenInterval: 0,                 // Optional: token refresh interval in ms (default: 30 minutes, 0 = no refresh)
  maxHttp2Connections: 1                   // Optional: max HTTP2 connections (default: 1)
};

const client = await orkesConductorClient(config);
```

### Environment Variables

You can configure client using environment variables:

```bash
CONDUCTOR_SERVER_URL=https://play.orkes.io/api
CONDUCTOR_AUTH_KEY=your-key-id
CONDUCTOR_AUTH_SECRET=your-key-secret
CONDUCTOR_REFRESH_TOKEN_INTERVAL=0
CONDUCTOR_MAX_HTTP2_CONNECTIONS=1
```
Environment variables are prioritized over config variables.

### Custom Fetch Function

You can provide a custom fetch function for SDK HTTP requests:

```typescript
const client = await orkesConductorClient(config, fetch);
```

## Core Concepts

### What are Tasks?

Tasks are individual units of work in Conductor workflows. Each task performs a specific operation, such as making an HTTP call, transforming data, executing custom business logic, or waiting for human approval. Tasks can be executed automatically by Conductor's built-in workers or by custom workers you implement.

### What are Workflows?

Workflows are the main orchestration units in Conductor. They define a sequence of tasks and their dependencies, creating automated business processes. Workflows coordinate task execution, handle failures, manage retries, and ensure your business logic flows correctly from start to finish.

### What are Workers?

Workers are applications that poll Conductor for tasks and execute them. Conductor has built-in workers for common operations (HTTP calls, data transforms, etc.), and you can implement custom workers to execute your business-specific logic. This SDK provides tools to build and manage custom workers.

### What is the Scheduler?
The scheduler allows you to schedule workflows to run at specific times or intervals, enabling automated workflow execution based on time-based triggers.

## Task Types

Conductor provides various task types to build workflows. Understanding which tasks require custom workers and which are managed by Conductor is essential for effective workflow design. Tasks in Conductor are divided into two main categories based on **who executes them**:

### System Tasks - Managed by Conductor Server

System tasks are fully managed by Conductor. No custom workers needed - just reference them in your workflow and they execute automatically.

**Available System Tasks:**
- **HTTP** - Make HTTP/REST API calls
- **Inline** - Execute JavaScript expressions
- **JSON JQ Transform** - Transform JSON data using JQ expressions
- **Kafka Publish** - Publish messages to Kafka topics
- **Event** - Publish events to eventing systems
- **Switch** - Conditional branching based on input
- **Fork-Join** - Execute tasks in parallel and wait for completion
- **Dynamic Fork** - Dynamically create parallel task executions
- **Join** - Join point for forked tasks
- **Sub-Workflow** - Execute another workflow as a task
- **Do-While** - Loop execution with conditions
- **Set Variable** - Set workflow variables
- **Wait** - Pause workflow for a specified duration
- **Terminate** - End workflow with success or failure
- **Human** - Pause workflow until a person completes an action (approval, form submission, etc.). Managed via the `HumanExecutor` API. See [Human Tasks](#human-tasks) section for details.

### SIMPLE Tasks - Require Custom Workers

SIMPLE tasks execute **your custom business logic**. You must implement workers to handle these tasks.

**When to use:**
- Custom business logic specific to your application
- Integration with internal systems and databases
- File processing, data validation, notifications
- Any functionality not provided by system tasks

**How they work:**
1. Define a SIMPLE task in your workflow
2. Implement a worker that polls Conductor for this task type
3. Worker executes your custom logic when task is assigned
4. Worker reports results back to Conductor
5. Workflow continues based on task result

See the [Workers](#workers) section for implementation details.

## Workflows

Workflows orchestrate the execution of multiple tasks in a coordinated sequence. This section explains:
- **What workflows are** and how they work
- **How to create workflows** step-by-step using task generators
- **How to manage workflow lifecycle** (register, start, pause, resume, terminate, search)
- **Task generator reference** for all available task types

### WorkflowExecutor

The `WorkflowExecutor` class is your main interface for managing workflows. It provides methods to register, start, monitor, and control workflow execution.

```typescript
import { WorkflowExecutor } from "@io-orkes/conductor-javascript";

// Create executor instance
const executor = new WorkflowExecutor(client);
```

### Creating Workflows

Creating a workflow in Conductor involves three main steps:

#### Step 1: Define Your Workflow Structure

A workflow definition is a JavaScript object that describes your workflow:

```typescript
const workflowDef = {
  name: "order_fulfillment",           // Unique workflow name
  version: 1,                           // Version number
  description: "Process and fulfill customer orders",
  ownerEmail: "team@example.com",       // Optional: owner email
  tasks: [
    // Tasks will be added here (Step 2)
  ],
  inputParameters: [],                  // Expected input parameter names
  outputParameters: {},                 // Output mapping from task results
  timeoutSeconds: 3600,                 // Workflow timeout (0 = no timeout)
  timeoutPolicy: "ALERT_ONLY"           // What to do on timeout
};
```

#### Step 2: Build Your Task List

Use **task generators** to create the task list for your workflow. Task generators are helper functions that create properly formatted task definitions:

```typescript
import { 
  simpleTask, 
  httpTask, 
  switchTask 
} from "@io-orkes/conductor-javascript";

const workflowDef = {
  name: "order_fulfillment",
  version: 1,
  description: "Process and fulfill customer orders",
  tasks: [
    // Task 1: Validate order (custom worker)
    simpleTask(
      "validate_order_ref",              // taskReferenceName: unique within workflow
      "validate_order",                  // taskName: matches worker's taskDefName
      {                                   // inputParameters: data for this task
        orderId: "${workflow.input.orderId}",
        customerId: "${workflow.input.customerId}"
      }
    ),
    
    // Task 2: Check inventory via HTTP API
    httpTask(
      "check_inventory_ref",
      {
        uri: "https://api.inventory.com/check",
        method: "POST",
        body: {
          productId: "${workflow.input.productId}",
          quantity: "${workflow.input.quantity}"
        },
        headers: {
          "Content-Type": "application/json"
        }
      }
    ),
    
    // Task 3: Conditional routing based on inventory
    switchTask(
      "route_order_ref",
      "${check_inventory_ref.output.inStock}",
      {
        "true": [
          simpleTask("fulfill_order_ref", "fulfill_order", {
            orderId: "${workflow.input.orderId}"
          })
        ],
        "false": [
          simpleTask("backorder_ref", "create_backorder", {
            orderId: "${workflow.input.orderId}"
          })
        ]
      }
    )
  ],
  inputParameters: ["orderId", "customerId", "productId", "quantity"],
  outputParameters: {
    status: "${route_order_ref.output.status}",
    fulfillmentId: "${fulfill_order_ref.output.fulfillmentId}"
  }
};
```

**Key Concepts:**

- **taskReferenceName**: A unique identifier for the task within this workflow. Used to reference task outputs (e.g., `${task_ref.output.fieldName}`)
- **inputParameters**: Use `${workflow.input.fieldName}` to access workflow inputs and `${other_task_ref.output.fieldName}` to access previous task outputs
- **Task Generators**: Each task type has a generator function (e.g., `simpleTask`, `httpTask`, `switchTask`). See [Task Generators Reference](#task-generators-reference) for all available types.

#### Step 3: Register and Start Your Workflow

Once your workflow definition is ready, register it with Conductor and start executing it:

```typescript
// Register the workflow definition
await executor.registerWorkflow(
  true,          // overwrite: replace existing definition if it exists
  workflowDef
);

// Start a workflow execution
const executionId = await executor.startWorkflow({
  name: "order_fulfillment",
  version: 1,
  input: {
    orderId: "ORDER-123",
    customerId: "CUST-456",
    productId: "PROD-789",
    quantity: 2
  }
});

console.log(`Workflow started with ID: ${executionId}`);
```

### Task Generators Reference

This section provides code examples for each task type generator. Use these to build your workflow task lists.

**Note:** These generators create workflow task references. To register task metadata (retry policies, timeouts, rate limits), use `taskDefinition()` or `MetadataClient` (see [Metadata](#metadata)).

#### Simple Task

*Requires Custom Workers* - Executes custom business logic via workers you implement.

```typescript
import { simpleTask } from "@io-orkes/conductor-javascript";

const task = simpleTask(
  "task_ref",          // taskReferenceName (required)
  "task_name",         // name (required): must match worker's taskDefName
  {                    // inputParameters (required)
    inputParam: "value"
  },
  false                // optional (optional): if true, workflow continues on failure
);
```

#### HTTP Task

*System Task* - Makes HTTP/REST API calls.

```typescript
import { httpTask } from "@io-orkes/conductor-javascript";

const task = httpTask(
  "http_ref",
  {
    uri: "http://api.example.com/data",
    method: "GET",
    headers: { "Authorization": "Bearer token" },
    connectionTimeOut: 5000,
    readTimeOut: 10000
  },
  false,  // asyncComplete (optional)
  false   // optional (optional): workflow continues on failure
);
```

#### Switch Task

*System Task* - Provides conditional branching based on input values.

```typescript
import { switchTask } from "@io-orkes/conductor-javascript";

const task = switchTask(
  "switch_ref",
  "input.status",      // expression to evaluate
  {
    "active": [simpleTask("active_task", "process_active", {})],
    "inactive": [simpleTask("inactive_task", "process_inactive", {})]
  },
  [simpleTask("default_task", "process_default", {})],  // defaultCase (optional)
  false  // optional (optional): workflow continues on failure
);
```

#### Fork-Join Task

*System Task* - Executes multiple task branches in parallel and waits for all to complete.

```typescript
import { forkJoinTask } from "@io-orkes/conductor-javascript";

const task = forkJoinTask("fork_ref", [
  [simpleTask("task1", "process_1", {})],
  [simpleTask("task2", "process_2", {})],
  [simpleTask("task3", "process_3", {})]
]);
```

#### Do-While Task

*System Task* - Executes a loop with a condition evaluated after each iteration.

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

#### Sub-Workflow Task

*System Task* - Executes another workflow as a task.

```typescript
import { subWorkflowTask } from "@io-orkes/conductor-javascript";

const task = subWorkflowTask(
  "sub_ref",
  "child_workflow",  // workflowName
  1,                 // version (optional): uses latest if not specified
  false              // optional (optional)
);

// Set input parameters
task.inputParameters = { inputParam: "value" };
```

#### Event Task

*System Task* - Publishes events to external eventing systems.

```typescript
import { eventTask } from "@io-orkes/conductor-javascript";

const task = eventTask("event_ref", "event_name", {
  sink: "event_sink",
  asyncComplete: true
});
```

#### Wait Task

*System Task* - Pauses workflow execution for a specified duration or until a specific time.

```typescript
import { waitTaskDuration, waitTaskUntil } from "@io-orkes/conductor-javascript";

// Wait for a duration (e.g., "30s", "5m", "1h", "2d")
const taskDuration = waitTaskDuration(
  "wait_ref",
  "30s",      // duration string
  false       // optional (optional)
);

// Wait until a specific time (ISO 8601 format)
const taskUntil = waitTaskUntil(
  "wait_until_ref",
  "2025-12-31T23:59:59Z",  // ISO 8601 timestamp
  false                     // optional (optional)
);
```

#### Terminate Task

*System Task* - Terminates workflow execution with a specified status.

```typescript
import { terminateTask } from "@io-orkes/conductor-javascript";

const task = terminateTask(
  "terminate_ref",
  "FAILED",         // status: "COMPLETED" or "FAILED"
  "Error message"   // terminationReason (optional)
);
```

#### Set Variable Task

*System Task* - Sets or updates workflow variables.

```typescript
import { setVariableTask } from "@io-orkes/conductor-javascript";

const task = setVariableTask("var_ref", {
  variableName: "result",
  value: "computed_value"
});
```

#### JSON JQ Transform Task

*System Task* - Transforms JSON data using JQ expressions.

```typescript
import { jsonJqTask } from "@io-orkes/conductor-javascript";

const task = jsonJqTask("transform_ref", ".data.items[] | {id: .id, name: .name}");
```

#### Kafka Publish Task

*System Task* - Publishes messages to Kafka topics.

```typescript
import { kafkaPublishTask } from "@io-orkes/conductor-javascript";

const task = kafkaPublishTask("kafka_ref", "topic_name", {
  message: "Hello Kafka!"
}, {
  key: "message_key",
  partition: 0
});
```

#### Inline Task

*System Task* - Executes JavaScript code inline within the workflow.

```typescript
import { inlineTask } from "@io-orkes/conductor-javascript";

const task = inlineTask("inline_ref", `
  function execute(input) {
    return { result: input.value * 2 };
  }
`);
```

#### Dynamic Fork Task

*System Task* - Dynamically creates parallel task executions based on input.

```typescript
import { dynamicForkTask } from "@io-orkes/conductor-javascript";

const task = dynamicForkTask("dynamic_ref", "input.tasks", "task_name");
```

#### Join Task

*System Task* - Synchronization point for forked tasks.

```typescript
import { joinTask } from "@io-orkes/conductor-javascript";

const task = joinTask("join_ref");
```

#### Human Task

*System Task* - Pauses workflow until a person completes an action (approval, form submission, etc.).

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

### Managing Workflow Execution

Once your workflow is running, you can monitor and control its execution using these operations:

#### Monitor Workflow Status

```typescript
// Get workflow status summary
const status = await executor.getWorkflowStatus(
  executionId,
  true,   // includeOutput
  true    // includeVariables
);

// The `getWorkflowStatus()` method returns a `Workflow` object with the following properties:
interface WorkflowStatus {
  workflowId?: string;
  correlationId?: string;
  output?: Record<string, any>;
  variables?: Record<string, any>;
  status?: "RUNNING" | "COMPLETED" | "FAILED" | "TIMED_OUT" | "TERMINATED" | "PAUSED";
}
```

#### Control Workflow Execution

```typescript
// Pause a running workflow
await executor.pause(executionId);

// Resume a paused workflow
await executor.resume(executionId);

// Terminate a workflow with a reason
await executor.terminate(executionId, "Terminating due to error");

// Restart a completed/failed workflow
await executor.restart(executionId, true);  // useLatestDefinitions

// Retry a failed workflow from the last failed task
await executor.retry(executionId, false);  // resumeSubworkflowTasks

// Rerun a workflow with potentially modified parameters
const newWorkflowId = await executor.reRun(executionId);
```

#### Search Workflows

```typescript
// Search for workflows with filters
const searchResults = await executor.search(
  0,                 // start: starting index
  10,                // size: number of results
  "status:RUNNING",  // query: e.g., "workflowType:my_workflow AND status:FAILED"
  "*",               // freeText: use "*" for all
  "startTime:DESC",  // sort (optional)
  false              // skipCache (optional)
);

// Common search patterns:
// - By status: "status:RUNNING"
// - By name: "workflowType:order_fulfillment"
// - By date: "startTime:[2025-01-01 TO 2025-12-31]"
// - Combined: "workflowType:my_workflow AND status:FAILED"
```

### WorkflowExecutor API Reference

Complete method reference for the `WorkflowExecutor` class:

```typescript
import { WorkflowExecutor } from "@io-orkes/conductor-javascript";

const executor = new WorkflowExecutor(client);

// ============================================================
// Workflow Lifecycle
// ============================================================

// Register or update a workflow definition
await executor.registerWorkflow(override: boolean, workflow: WorkflowDef): Promise<void>

// Start a new workflow execution
const workflowId = await executor.startWorkflow(request: StartWorkflowRequest): Promise<string>

// Execute workflow synchronously and wait for completion
const result = await executor.executeWorkflow(...): Promise<WorkflowRun | SignalResponse>

// Get workflow execution details with tasks
const workflow = await executor.getWorkflow(id: string, includeTasks: boolean): Promise<Workflow>

// Get workflow status summary
const status = await executor.getWorkflowStatus(
  id: string, 
  includeOutput: boolean, 
  includeVariables: boolean
): Promise<WorkflowStatus>

// Search workflows with filters
const results = await executor.search(
  start: number, 
  size: number, 
  query: string, 
  freeText: string, 
  sort?: string, 
  skipCache?: boolean
): Promise<SearchResultWorkflow>

// ============================================================
// Workflow Control
// ============================================================

// Pause a running workflow
await executor.pause(workflowId: string): Promise<void>

// Resume a paused workflow
await executor.resume(workflowId: string): Promise<void>

// Terminate a workflow with reason
await executor.terminate(workflowId: string, reason: string): Promise<void>

// Restart a workflow
await executor.restart(workflowId: string, useLatestDefinitions: boolean): Promise<void>

// Retry a failed workflow from last failed task
await executor.retry(workflowId: string, resumeSubworkflowTasks: boolean): Promise<void>

// Rerun a workflow with new parameters
const newId = await executor.reRun(
  workflowId: string, 
  request?: Partial<RerunWorkflowRequest>
): Promise<string>

// Skip a task in a running workflow
await executor.skipTasksFromWorkflow(
  workflowId: string, 
  taskRefName: string, 
  request: Partial<SkipTaskRequest>
): Promise<void>

// ============================================================
// Task Operations
// ============================================================

// Get task by ID
const task = await executor.getTask(taskId: string): Promise<Task>

// Update task by ID
await executor.updateTask(
  taskId: string, 
  workflowId: string, 
  status: TaskResultStatus, 
  output: Record<string, any>
): Promise<string>

// Update task by reference name
await executor.updateTaskByRefName(
  taskRefName: string, 
  workflowId: string, 
  status: TaskResultStatus, 
  output: Record<string, any>
): Promise<string>

// Update task and return updated workflow
const updatedWorkflow = await executor.updateTaskSync(
  taskRefName: string, 
  workflowId: string, 
  status: TaskResultStatusEnum, 
  output: Record<string, any>, 
  workerId?: string
): Promise<Workflow>

// Send signal to workflow
const response = await executor.signal(
  workflowId: string, 
  status: TaskResultStatusEnum, 
  output: Record<string, any>, 
  returnStrategy?: ReturnStrategy
): Promise<SignalResponse>

// Send signal asynchronously (fire-and-forget)
await executor.signalAsync(
  workflowId: string, 
  status: TaskResultStatusEnum, 
  output: Record<string, any>
): Promise<void>

// ============================================================
// Advanced Operations
// ============================================================

// Rerun from a specific task found by predicate
await executor.goBackToTask(
  workflowId: string, 
  predicate: (task: Task) => boolean, 
  overrides?: Partial<RerunWorkflowRequest>
): Promise<void>

// Rerun from first task of specific type
await executor.goBackToFirstTaskMatchingType(
  workflowId: string, 
  taskType: string
): Promise<void>

// Start multiple workflows at once
const workflowIds = executor.startWorkflows(
  requests: StartWorkflowRequest[]
): Promise<string>[]
```

### Monitoring & Debugging Tasks

The `TaskClient` provides capabilities for monitoring and debugging tasks within your workflow executions:

```typescript
import { TaskClient } from "@io-orkes/conductor-javascript";

const taskClient = new TaskClient(client);

// Search tasks
const searchResults = await taskClient.search(0, 10, "", "*", "status:COMPLETED");

// Get task by ID
const task = await taskClient.getTask(taskId);

// Update task result (advanced use case)
await taskClient.updateTaskResult(
  workflowId,
  taskReferenceName,
  "COMPLETED",
  { result: "success" }
);
```

#### Task Statuses

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

#### Searching & Filtering Tasks

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

**Search Parameters:**
- `start`: Starting index for pagination (default: 0)
- `size`: Number of results to return (default: 100)
- `sort`: Sort field and direction (e.g., "startTime:DESC", "status:ASC")
- `freeText`: Free text search term (use "*" for all)
- `query`: Structured query string (e.g., "status:FAILED", "workflowId:workflow-123")

#### Common Search Queries

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

## Workers

### Overview

Workers are background processes that execute tasks in your workflows. Think of them as specialized functions that:

1. **Poll** the Conductor server asking "Do you have any work for me?"
2. **Execute** the task logic when work is assigned
3. **Report** the results back to Conductor

**How Workers Fit In:**
```
Workflow → Creates Tasks → Workers Poll for Tasks → Execute Logic → Return Results → Workflow Continues
```

The SDK provides the **TaskManager** class - an easy-to-use interface for managing workers efficiently.

### Quick Start: Your First Worker

Here's a simple example to get you started:

```typescript
import { 
  orkesConductorClient, 
  TaskManager, 
  ConductorWorker 
} from "@io-orkes/conductor-javascript";

// Step 1: Create your client
const client = await orkesConductorClient({
  serverUrl: "https://play.orkes.io/api",
  keyId: "your-key-id",
  keySecret: "your-key-secret"
});

// Step 2: Define your worker(s)
const workers: ConductorWorker[] = [
  {
    // This must match the task name in your workflow
    taskDefName: "send_email",
    
    // This function executes when a task is assigned
    execute: async (task) => {
      // Get input data from the workflow
      const { to, subject, body } = task.inputData;
      
      // Do your work (send email, call API, process data, etc.)
      console.log(`Sending email to ${to}: ${subject}`);
      await sendEmailViaAPI(to, subject, body);
      
      // Return the result
      return {
        outputData: { 
          sent: true, 
          timestamp: new Date().toISOString() 
        },
        status: "COMPLETED"
      };
    }
  }
];

// Step 3: Create TaskManager and start polling
const manager = new TaskManager(client, workers);
await manager.startPolling();

console.log("✅ Worker is now running and waiting for tasks!");

// When you're done (e.g., on shutdown):
// await manager.stopPolling();
```

**That's it!** Your worker is now running and will automatically:
- Poll for tasks named `send_email`
- Execute the task logic
- Report results back to Conductor
- Handle errors and retries

### Understanding Worker Execution Flow

Here's what happens when a workflow creates a task:

1. **Workflow runs** and creates a task (e.g., `send_email`)
2. **Worker polls** Conductor: "Any `send_email` tasks for me?"
3. **Conductor responds** with the task and its input data
4. **Worker executes** your `execute` function with the task data
5. **Worker returns** the result (`COMPLETED`, `FAILED`, etc.)
6. **Workflow continues** to the next task based on the result

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

### Handling Task Results

Your worker's `execute` function must return an object with at least these two properties:

```typescript
{
  status: "COMPLETED" | "FAILED" | "FAILED_WITH_TERMINAL_ERROR" | "IN_PROGRESS",
  outputData: { /* your result data */ }
}
```

#### Common Return Patterns

**✅ Success:**
```typescript
return {
  status: "COMPLETED",
  outputData: { result: "success", data: processedData }
};
```

**❌ Failure (will retry based on task configuration):**
```typescript
return {
  status: "FAILED",
  outputData: {},
  logs: [{ log: "Error details for debugging" }]
};
```

**❌ Terminal Failure (no retry, workflow fails immediately):**
```typescript
return {
  status: "FAILED_WITH_TERMINAL_ERROR",
  outputData: { error: "Invalid input - cannot proceed" }
};
```

**⏳ In Progress (for long-running tasks):**
```typescript
return {
  status: "IN_PROGRESS",
  outputData: { progress: 50, message: "Processing..." },
  callbackAfterSeconds: 30  // Conductor will check back after 30 seconds
};
```

#### Error Handling in Workers

Always wrap your worker logic in try-catch to handle errors gracefully:

```typescript
const worker: ConductorWorker = {
  taskDefName: "risky_operation",
  execute: async (task) => {
    try {
      const result = await performRiskyOperation(task.inputData);
      return {
        status: "COMPLETED",
        outputData: { result }
      };
    } catch (error) {
      console.error("Worker error:", error);
      
      // Decide: retry or fail permanently?
      const shouldRetry = error.code !== 'INVALID_INPUT';
      
      return {
        status: shouldRetry ? "FAILED" : "FAILED_WITH_TERMINAL_ERROR",
        outputData: { error: error.message },
        logs: [{ 
          log: `Error: ${error.message}`,
          createdTime: Date.now()
        }]
      };
    }
  }
};
```

### Working with Multiple Workers

In real applications, you'll typically have multiple workers for different tasks:

```typescript
import { TaskManager, ConductorWorker } from "@io-orkes/conductor-javascript";

const workers: ConductorWorker[] = [
  // Worker 1: Send emails
  {
    taskDefName: "send_email",
    execute: async (task) => {
      const { to, subject, body } = task.inputData;
      await emailService.send(to, subject, body);
      return {
        status: "COMPLETED",
        outputData: { sent: true, messageId: "msg_123" }
      };
    }
  },
  
  // Worker 2: Process payments
  {
    taskDefName: "process_payment",
    execute: async (task) => {
      const { amount, currency, cardToken } = task.inputData;
      const charge = await paymentGateway.charge(amount, currency, cardToken);
      return {
        status: "COMPLETED",
        outputData: { 
          transactionId: charge.id,
          status: charge.status 
        }
      };
    }
  },
  
  // Worker 3: Generate reports
  {
    taskDefName: "generate_report",
    execute: async (task) => {
      const { reportType, startDate, endDate } = task.inputData;
      const reportUrl = await reportService.generate(reportType, startDate, endDate);
      return {
        status: "COMPLETED",
        outputData: { reportUrl, generatedAt: new Date().toISOString() }
      };
    }
  }
];

// Start all workers with a single TaskManager
const manager = new TaskManager(client, workers);
await manager.startPolling();

console.log("✅ All 3 workers are now running!");
```

**Key Points:**
- Each worker handles a specific task type (identified by `taskDefName`)
- All workers run concurrently and independently
- A single `TaskManager` manages all workers together
- Workers only pick up tasks that match their `taskDefName`

### TaskManager Advanced Configuration

The `TaskManager` accepts configuration options to control worker behavior, polling, and error handling.

```typescript
import { TaskManager, ConductorWorker, DefaultLogger } from "@io-orkes/conductor-javascript";

const manager = new TaskManager(client, workers, {
  // Custom logger for debugging and monitoring (optional)
  logger: new DefaultLogger(),
  
  // Polling and execution options (optional)
  options: {
    pollInterval: 1000,           // How often to poll for tasks in ms (default: 100)
    concurrency: 5,               // Max concurrent task executions per worker (default: 1)
    workerID: "worker-group-1",   // Unique identifier for this worker group (default: hostname)
    domain: undefined,            // Task domain for isolation (default: undefined)
    batchPollingTimeout: 100      // Batch polling timeout in ms (default: 100)
  },
  
  // Global error handler called when workers fail (optional)
  onError: (error, task) => {
    console.error(`Error in task ${task?.taskType}:`, error);
    // Send to error tracking service
    errorTracker.log(error, { taskId: task?.taskId });
  },
  
  // Maximum retry attempts before giving up (optional, default: 3)
  maxRetries: 5
});

await manager.startPolling();
```

#### Dynamic Configuration Updates

You can update polling options at runtime without stopping workers:

```typescript
// Adjust polling interval based on load
manager.updatePollingOptions({ 
  pollInterval: 2000,  // Slow down during high load
  concurrency: 10      // Increase parallelism
});
```

#### Graceful Shutdown

Properly stop workers when your application shuts down:

```typescript
// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('Shutting down workers...');
  await manager.stopPolling();
  console.log('Workers stopped gracefully');
  process.exit(0);
});
```

## Scheduling

### SchedulerClient

The `SchedulerClient` manages workflow scheduling and provides methods for creating, managing, and monitoring scheduled workflows.

```typescript
import { SchedulerClient } from "@io-orkes/conductor-javascript";

const scheduler = new SchedulerClient(client);
```

#### Schedule Management

```typescript
// Create or update a schedule
await scheduler.saveSchedule({
  name: string,
  cronExpression: string,  // e.g., "0 0 9 * * ?"
  startWorkflowRequest: {
    name: string,
    version?: number,
    input?: Record<string, any>,
    correlationId?: string,
    priority?: number,
    taskToDomain?: Record<string, string>
  },
  paused?: boolean,                   // (optional, default: false)
  runCatchupScheduleInstances?: boolean,  // (optional, default: false)
  scheduleStartTime?: number,         // (optional) epoch ms
  scheduleEndTime?: number            // (optional) epoch ms
}): Promise<void>

// Get a specific schedule
const schedule = await scheduler.getSchedule(name: string): Promise<WorkflowSchedule>

// Get all schedules
const schedules = await scheduler.getAllSchedules(
  workflowName?: string  // (optional) filter by workflow name
): Promise<WorkflowSchedule[]>

// Delete a schedule
await scheduler.deleteSchedule(name: string): Promise<void>

// Pause a schedule
await scheduler.pauseSchedule(name: string): Promise<void>

// Resume a paused schedule
await scheduler.resumeSchedule(name: string): Promise<void>
```

#### Bulk Schedule Operations

```typescript
// Pause all schedules (use with caution)
await scheduler.pauseAllSchedules(): Promise<void>

// Resume all schedules
await scheduler.resumeAllSchedules(): Promise<void>

// Requeue all execution records
await scheduler.requeueAllExecutionRecords(): Promise<void>
```

#### Schedule Execution Preview

```typescript
// Get next few execution times for a cron expression
const nextExecutions = await scheduler.getNextFewSchedules(
  cronExpression: string,
  scheduleTime: number,      // epoch ms
  scheduleEndTime: number,   // epoch ms
  limit: number
): Promise<number[]>  // array of timestamps

// Example: Get next 5 executions over the next 7 days
const nextTimes = await scheduler.getNextFewSchedules(
  "0 0 9 * * ?",
  Date.now(),
  Date.now() + 7 * 24 * 60 * 60 * 1000,
  5
);
```

#### Search Schedule Executions

```typescript
// Search schedule execution history
const executions = await scheduler.search(
  start: number,
  size: number,
  sort: string,       // (optional, default: "")
  freeText: string,   // (default: "*")
  query: string       // e.g., "status:RUNNING"
): Promise<SearchResultWorkflowScheduleExecutionModel>

// Example
const results = await scheduler.search(0, 10, "startTime:DESC", "*", "status:RUNNING");
```

**Cron Expression Format:**
- Standard cron format: `second minute hour day month dayOfWeek`
- Examples:
  - `"0 0 9 * * ?"` - Every day at 9 AM
  - `"0 */30 * * * ?"` - Every 30 minutes
  - `"0 0 0 1 * ?"` - First day of every month at midnight
  - `"0 0 12 ? * MON-FRI"` - Weekdays at noon

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

## Metadata

### MetadataClient

The `MetadataClient` class provides methods for managing task and workflow definitions in Conductor.

```typescript
import { MetadataClient } from "@io-orkes/conductor-javascript";

const metadataClient = new MetadataClient(client);
```

#### Complete MetadataClient API Reference

```typescript
// Task Definition Management
await metadataClient.registerTask(taskDef: TaskDef): Promise<void>
await metadataClient.updateTask(taskDef: TaskDef): Promise<void>
const taskDef = await metadataClient.getTaskDef(taskName: string): Promise<TaskDef>
const allTasks = await metadataClient.getAllTaskDefs(): Promise<TaskDef[]>
await metadataClient.unregisterTask(taskName: string): Promise<void>

// Workflow Definition Management
await metadataClient.registerWorkflowDef(
  workflowDef: WorkflowDef,
  overwrite?: boolean  // (optional, default: false)
): Promise<void>

await metadataClient.updateWorkflowDef(workflowDef: WorkflowDef): Promise<void>

const workflowDef = await metadataClient.getWorkflowDef(
  workflowName: string,
  version?: number  // (optional) uses latest if not specified
): Promise<WorkflowDef>

const allVersions = await metadataClient.getAllWorkflowDefs(
  workflowName: string
): Promise<WorkflowDef[]>

await metadataClient.unregisterWorkflow(
  workflowName: string,
  version: number
): Promise<void>
```

### Task Definition Factory

The `taskDefinition` function provides a convenient way to create task definitions with default values:

```typescript
import { taskDefinition } from "@io-orkes/conductor-javascript";

const taskDef = taskDefinition({
  // Required fields
  name: "task_name",                      // Task name (required)
  
  // Optional fields with defaults
  ownerApp: "",                           // Optional: owner application (default: "")
  description: "",                        // Optional: task description (default: "")
  retryCount: 3,                          // Optional: number of retries (default: 3)
  timeoutSeconds: 3600,                   // Optional: task timeout in seconds (default: 3600 = 1 hour)
  inputKeys: [],                          // Optional: list of input keys (default: [])
  outputKeys: [],                         // Optional: list of output keys (default: [])
  timeoutPolicy: "TIME_OUT_WF",           // Optional: "RETRY" | "TIME_OUT_WF" | "ALERT_ONLY" (default: "TIME_OUT_WF")
  retryLogic: "FIXED",                    // Optional: "FIXED" | "EXPONENTIAL_BACKOFF" | "LINEAR_BACKOFF" (default: "FIXED")
  retryDelaySeconds: 60,                  // Optional: delay between retries in seconds (default: 60)
  responseTimeoutSeconds: 600,            // Optional: response timeout in seconds (default: 600)
  concurrentExecLimit: 0,                 // Optional: max concurrent executions (0 = unlimited) (default: 0)
  inputTemplate: {},                      // Optional: default input template (default: {})
  rateLimitPerFrequency: 0,               // Optional: rate limit count (0 = no limit) (default: 0)
  rateLimitFrequencyInSeconds: 1,         // Optional: rate limit window in seconds (default: 1)
  ownerEmail: "",                         // Optional: owner email (default: "")
  pollTimeoutSeconds: 3600,               // Optional: poll timeout in seconds (default: 3600)
  backoffScaleFactor: 1                   // Optional: backoff multiplier for retry (default: 1)
});
```

### Register Task Definition

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

### Update Task Definition

```typescript
const updatedTaskDef = {
  ...taskDef,
  timeoutSeconds: 600, // Increased timeout
  retryCount: 5 // Increased retry count
};

await metadataClient.updateTask(updatedTaskDef);
```

### Unregister Task Definition

```typescript
await metadataClient.unregisterTask("process_order");
```

### Register Workflow Definition

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

### Unregister Workflow Definition

```typescript
await metadataClient.unregisterWorkflow("order_processing_workflow", 1);
```

## Human Tasks

HUMAN tasks are a **type of system task** that enable human interaction within workflows. They pause execution until a person completes an action like approving a request, filling out a form, or reviewing data.

**As System Tasks:**
- **No custom workers needed** - Managed by Conductor, not by your code
- **Configured, not coded** - Use the `HumanExecutor` API to manage task lifecycle
- **Form-based** - Users interact through forms you define with TemplateClient
- **Assignment-based** - Tasks are assigned to users or groups  
- **State management** - Tasks can be claimed, released, updated, and completed via API

**Unlike other system tasks** (which execute automatically), HUMAN tasks wait for user action via the HumanExecutor API.

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

### TemplateClient

The `TemplateClient` class provides methods for managing human task templates (forms and UI):

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
