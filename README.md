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

Workflows are the heart of Conductor, orchestrating tasks to perform complex processes. This guide walks you through the entire lifecycle of a workflow, from creation to monitoring.

### The WorkflowExecutor

The `WorkflowExecutor` is your primary tool for interacting with workflows. It allows you to register, start, and manage their execution.

```typescript
import { WorkflowExecutor } from "@io-orkes/conductor-javascript";

// Create an executor instance
const executor = new WorkflowExecutor(client);
```

### Step 1: Define Your Workflow Structure

A workflow definition is a blueprint for your process. It outlines the workflow's properties and the sequence of tasks.

```typescript
const workflowDef = {
  name: "order_fulfillment",
  version: 1,
  description: "Process and fulfill customer orders",
  ownerEmail: "team@example.com",
  tasks: [
    // Tasks will be added in the next step
  ],
  inputParameters: ["orderId", "customerId", "productId", "quantity"],
  outputParameters: {
    status: "${route_order_ref.output.status}",
    fulfillmentId: "${fulfill_order_ref.output.fulfillmentId}"
  },
  timeoutSeconds: 3600,
  timeoutPolicy: "ALERT_ONLY"
};
```

### Step 2: Build Your Task List

Use **Task Generators** to populate the `tasks` array. These helper functions simplify the creation of different task types.

```typescript
import { simpleTask, httpTask, switchTask } from "@io-orkes/conductor-javascript";

const tasks = [
  // Task 1: A custom task to validate the order
  simpleTask(
    "validate_order_ref",
    "validate_order",
    {
      orderId: "${workflow.input.orderId}",
      customerId: "${workflow.input.customerId}"
    }
  ),
  
  // Task 2: An HTTP task to check inventory
  httpTask(
    "check_inventory_ref",
    {
      uri: "https://api.inventory.com/check",
      method: "POST",
      body: {
        productId: "${workflow.input.productId}",
        quantity: "${workflow.input.quantity}"
      }
    }
  ),
  
  // Task 3: A switch task for conditional logic
  switchTask(
    "route_order_ref",
    "${check_inventory_ref.output.inStock}",
    {
      "true": [
        simpleTask("fulfill_order_ref", "fulfill_order", {})
      ],
      "false": [
        simpleTask("backorder_ref", "create_backorder", {})
      ]
    }
  )
];

// Add the tasks to your workflow definition
workflowDef.tasks = tasks;
```

**Key Concepts:**
- **`taskReferenceName`**: A unique identifier for a task instance within a workflow. Used for data flow (e.g., `${check_inventory_ref.output.inStock}`).
- **Input Parameters**: Use `${workflow.input.fieldName}` to access initial workflow inputs and `${task_ref.output.fieldName}` to access outputs from previous tasks.
- **Task Generators**: Helper functions like `simpleTask`, `httpTask`, etc., that create task definitions. For a complete list, see the [Task Generators Reference](./docs/api-reference/task-generators.md).

### Step 3: Register and Start Your Workflow

With the definition complete, register it with Conductor and start an execution.

```typescript
// Register the workflow definition (overwrite if it exists)
await executor.registerWorkflow(true, workflowDef);

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

### Step 4: Manage and Monitor Execution

Once a workflow is running, you can monitor its status, control its execution, and debug individual tasks.

#### Check Workflow Status

Retrieve the current status and output of a running workflow.

```typescript
const status = await executor.getWorkflowStatus(
  executionId,
  true, // includeOutput
  true  // includeVariables
);
console.log(`Workflow status is: ${status.status}`);
```

#### Control Workflow Execution

You can pause, resume, or terminate workflows as needed.

```typescript
// Pause a running workflow
await executor.pause(executionId);

// Resume a paused workflow
await executor.resume(executionId);

// Terminate a workflow
await executor.terminate(executionId, "Aborted due to customer cancellation");
```

#### Search for Workflows

Search for workflow executions based on various criteria.

```typescript
const searchResults = await executor.search(
  0,
  10,
  "status:RUNNING AND workflowType:order_fulfillment",
  "*",
  "startTime:DESC"
);
```

#### Monitor and Debug Tasks

For a deeper look into the tasks within a workflow, use the `TaskClient`.

```typescript
import { TaskClient } from "@io-orkes/conductor-javascript";

const taskClient = new TaskClient(client);

// Find all failed tasks for a specific workflow run
const failedTasks = await taskClient.search(
  0,
  100,
  "startTime:DESC",
  "*",
  `status:FAILED AND workflowId:${executionId}`
);

// Get details of a specific task by its ID
const taskDetails = await taskClient.getTask(failedTasks.results[0].taskId);
```

For a complete list of methods, see the [WorkflowExecutor API Reference](./docs/api-reference/workflow-executor.md) and the [TaskClient API Reference](./docs/api-reference/task-client.md).

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

The SDK provides the **TaskManager** class - an easy-to-use interface for managing workers efficiently. For a complete method reference, see the [TaskManager API Reference](./docs/api-reference/task-manager.md).

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

The Conductor Scheduler allows you to run workflows at specific times or intervals, defined by a CRON expression. This is useful for tasks like nightly data processing, weekly reports, or any time-based automation.

### Quick Start: Scheduling a Workflow

Here’s how to schedule a workflow in three steps:

#### Step 1: Create a SchedulerClient

First, create an instance of the `SchedulerClient`:

```typescript
import { SchedulerClient } from "@io-orkes/conductor-javascript";

const scheduler = new SchedulerClient(client);
```

#### Step 2: Define the Schedule

Next, define the schedule, specifying the workflow to run and the CRON expression for its timing.

```typescript
// Schedule a workflow to run every day at 9 AM
await scheduler.saveSchedule({
  name: "daily_report_schedule",
  cronExpression: "0 0 9 * * ?", // Everyday at 9am
  startWorkflowRequest: {
    name: "generate_daily_report",
    version: 1,
    input: {
      reportType: "SALES",
      period: "DAILY"
    },
  },
});
```

**Cron Expression Format:**
- Standard cron format: `second minute hour day month dayOfWeek`
- Examples:
  - `"0 0 9 * * ?"` - Every day at 9 AM
  - `"0 */30 * * * ?"` - Every 30 minutes
  - `"0 0 0 1 * ?"` - First day of every month at midnight
  - `"0 0 12 ? * MON-FRI"` - Weekdays at noon

#### Step 3: Manage the Schedule

You can easily manage your schedules:

```typescript
// Pause a schedule
await scheduler.pauseSchedule("daily_report_schedule");

// Resume a paused schedule
await scheduler.resumeSchedule("daily_report_schedule");

// Delete a schedule
await scheduler.deleteSchedule("daily_report_schedule");
```

For a complete method reference, see the [SchedulerClient API Reference](./docs/api-reference/scheduler-client.md).

## Service Registry

The Service Registry in Conductor allows you to manage and discover microservices. It also provides built-in circuit breaker functionality to improve the resilience of your distributed system.

### Quick Start: Using the Service Registry

Here’s how to get started with the `ServiceRegistryClient`:

#### Step 1: Create a ServiceRegistryClient

First, create an instance of the `ServiceRegistryClient`:

```typescript
import { ServiceRegistryClient } from "@io-orkes/conductor-javascript";

const serviceRegistry = new ServiceRegistryClient(client);
```

#### Step 2: Register a Service

Next, register your service with Conductor. This example registers an HTTP service with a circuit breaker configuration.

```typescript
// Register a service with circuit breaker config
await serviceRegistry.addOrUpdateService({
  name: "user-service",
  type: "HTTP",
  serviceURI: "https://api.example.com/users",
  circuitBreakerConfig: {
    failureRateThreshold: 50.0,
    slidingWindowSize: 10,
    minimumNumberOfCalls: 5,
    waitDurationInOpenState: 60000, // 1 minute
  },
});
```

#### Step 3: Manage Services

You can easily manage your registered services:

```typescript
// Get a list of all registered services
const services = await serviceRegistry.getRegisteredServices();

// Get details for a specific service
const service = await serviceRegistry.getService("user-service");

// Remove a service
await serviceRegistry.removeService("user-service");
```

For a complete method reference, see the [ServiceRegistryClient API Reference](./docs/api-reference/service-registry-client.md).

## Metadata

In Conductor, "metadata" refers to the definitions of your tasks and workflows. Before you can execute a workflow, you must register its definition with Conductor. The `MetadataClient` provides the tools to manage these definitions.

### Quick Start: Managing Metadata

Here’s how to manage your task and workflow definitions:

#### Step 1: Create a MetadataClient

First, create an instance of the `MetadataClient`:

```typescript
import { MetadataClient, taskDefinition, workflowDef } from "@io-orkes/conductor-javascript";

const metadataClient = new MetadataClient(client);
```

#### Step 2: Define and Register a Task

Create a task definition and register it. The `taskDefinition` factory provides sensible defaults for optional fields.

```typescript
// Define a task
const taskDef = taskDefinition({
  name: "my_sdk_task",
  description: "A task created via the SDK",
  ownerEmail: "dev@example.com",
  retryCount: 3,
});

// Register the task definition
await metadataClient.registerTask(taskDef);
```

#### Step 3: Define and Register a Workflow

Define your workflow using the task you just registered, and then register the workflow definition.

```typescript
// Define a workflow that uses the task
const wf = {
    name: "my_sdk_workflow",
    version: 1,
    ownerEmail: "dev@example.com",
    tasks: [{
        name: "my_sdk_task",
        taskReferenceName: "my_sdk_task_ref",
        type: "SIMPLE",
    }],
    inputParameters: [],
    timeoutSeconds: 0,
};

// Register the workflow definition
await metadataClient.registerWorkflowDef(wf);
```

For a complete method reference, see the [MetadataClient API Reference](./docs/api-reference/metadata-client.md).

## Human Tasks

Human tasks integrate human interaction into your automated workflows. They pause a workflow until a person provides input, such as an approval, a correction, or additional information.

Unlike other tasks, human tasks are managed through a dedicated API (`HumanExecutor`) and often involve UI forms (`TemplateClient`). Because they are a type of **system task**, you don't need to create a custom worker to handle them.

### Quick Start: Creating and Managing a Human Task

This guide walks through creating a simple approval workflow.

#### Step 1: Create API Clients

You'll need a `TemplateClient` to manage UI forms and a `HumanExecutor` to interact with the tasks themselves.

```typescript
import { HumanExecutor, TemplateClient } from "@io-orkes/conductor-javascript";

const templateClient = new TemplateClient(client);
const humanExecutor = new HumanExecutor(client);
```

#### Step 2: Register a Form Template

Define and register a form that will be presented to the user.

```typescript
const formTemplate = {
  name: "simple_approval_form",
  version: 1,
  description: "A simple form for approvals",
  formTemplate: {
    name: "Approval Form",
    fields: [{
        name: "approved",
        type: "boolean",
        required: true,
        label: "Approve Request",
    }],
  },
};

await templateClient.registerTemplate(formTemplate);
```

#### Step 3: Create a Workflow with a Human Task

Now, define a workflow that uses the `humanTask` generator. The `taskDefinition` for the human task should specify the template to use.

```typescript
import { humanTask } from "@io-orkes/conductor-javascript";

// Define the human task
const approvalTask = humanTask(
    "human_approval_ref",
    "human_approval_task",
    { template: "simple_approval_form" }
);

// Define the workflow
const approvalWorkflow = {
    name: "human_approval_workflow",
    version: 1,
    tasks: [approvalTask],
    inputParameters: [],
    ownerEmail: "dev@example.com",
};

// Register and start the workflow
await executor.registerWorkflow(true, approvalWorkflow);
const executionId = await executor.startWorkflow({
    name: "human_approval_workflow",
    version: 1,
});
```

#### Step 4: Find and Complete the Task

In a real application, your backend or UI would search for pending tasks and present them to the user.

```typescript
// Search for pending tasks for a user
const pendingTasks = await humanExecutor.search({
  states: ["PENDING"],
  // assignees: [{ userType: "EXTERNAL_USER", user: "user@example.com" }],
});

if (pendingTasks.results.length > 0) {
  const taskId = pendingTasks.results[0].taskId;

  // Claim the task
  await humanExecutor.claimTaskAsExternalUser(taskId, "user@example.com");

  // Complete the task with output
  await humanExecutor.completeTask(taskId, {
    output: {
      approved: true,
      comments: "Looks good, approved."
    }
  });

  console.log(`Task ${taskId} completed.`);
}
```

For a complete list of methods, see the [HumanExecutor API Reference](./docs/api-reference/human-executor.md) and the [TemplateClient API Reference](./docs/api-reference/template-client.md).
