# Conductor OSS JavaScript/TypeScript SDK

[![Build Status](https://github.com/conductor-oss/javascript-sdk/actions/workflows/pull_request.yml/badge.svg)](https://github.com/conductor-oss/javascript-sdk/actions/workflows/pull_request.yml)

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
  - [The WorkflowExecutor and TaskClient](#the-workflowexecutor-and-taskclient)
  - [Quick Start: Creating a Workflow](#quick-start-creating-a-workflow)
    - [Step 1: Define Your Workflow Structure](#step-1-define-your-workflow-structure)
    - [Step 2: Use Task Generators to Build Your Task List](#step-2-use-task-generators-to-build-your-task-list)
    - [Step 3: Register and Start Your Workflow](#step-3-register-and-start-your-workflow)
    - [Step 4: Manage and Monitor Execution](#step-4-manage-and-monitor-execution)
      - [Use TaskClient to Monitor and Debug Tasks](#use-taskclient-to-monitor-and-debug-tasks)
- [Workers](#workers)
  - [The TaskManager](#the-taskmanager)
  - [Quick Start: Building a Worker](#quick-start-building-a-worker)
    - [Step 1: Define the Worker's Logic](#step-1-define-the-workers-logic)
    - [Step 2: Handle Task Outcomes and Errors](#step-2-handle-task-outcomes-and-errors)
    - [Step 3: Run the Worker with TaskManager](#step-3-run-the-worker-with-taskmanager)
  - [Worker Design Principles](#worker-design-principles)
- [Scheduling](#scheduling)
  - [The SchedulerClient](#the-schedulerclient)
  - [Quick Start: Scheduling a Workflow](#quick-start-scheduling-a-workflow)
    - [Step 1: Create a SchedulerClient](#step-1-create-a-schedulerclient)
    - [Step 2: Define the Schedule](#step-2-define-the-schedule)
    - [Step 3: Manage the Schedule](#step-3-manage-the-schedule)
- [Service Registry](#service-registry)
  - [The ServiceRegistryClient](#the-serviceregistryclient)
  - [Quick Start: Using the Service Registry](#quick-start-using-the-service-registry)
    - [Step 1: Create a ServiceRegistryClient](#step-1-create-a-serviceregistryclient)
    - [Step 2: Register a Service](#step-2-register-a-service)
    - [Step 3: Manage Services](#step-3-manage-services)
- [Metadata](#metadata)
  - [The MetadataClient](#the-metadataclient)
  - [Quick Start: Managing Metadata](#quick-start-managing-metadata)
    - [Step 1: Create a MetadataClient](#step-1-create-a-metadataclient)
    - [Step 2: Define and Register a Task](#step-2-define-and-register-a-task)
    - [Step 3: Define and Register a Workflow](#step-3-define-and-register-a-workflow)
- [Events](#events)
  - [The EventClient](#the-eventclient)
  - [Quick Start: Using Event Handlers](#quick-start-using-event-handlers)
    - [Step 1: Create an EventClient](#step-1-create-an-eventclient)
    - [Step 2: Register an Event Handler](#step-2-register-an-event-handler)
    - [Step 3: Publish Events](#step-3-publish-events)
    - [Step 4: Monitor Event Processing](#step-4-monitor-event-processing)
    - [Step 5: Manage Event Handlers](#step-5-manage-event-handlers)
- [Applications](#applications)
  - [The ApplicationClient](#the-applicationclient)
  - [Quick Start: Managing Applications](#quick-start-managing-applications)
    - [Step 1: Create an ApplicationClient](#step-1-create-an-applicationclient)
    - [Step 2: Create an Application](#step-2-create-an-application)
    - [Step 3: Generate Access Keys](#step-3-generate-access-keys)
    - [Step 4: Manage Application Roles](#step-4-manage-application-roles)
    - [Step 5: Manage Applications](#step-5-manage-applications)
- [Human Tasks](#human-tasks)
  - [The HumanExecutor and TemplateClient](#the-humanexecutor-and-templateclient)
  - [Quick Start: Creating and Managing a Human Task](#quick-start-creating-and-managing-a-human-task)
    - [Step 1: Create API Clients](#step-1-create-api-clients)
    - [Step 2: Register a Form Template](#step-2-register-a-form-template)
    - [Step 3: Create a Workflow with a Human Task](#step-3-create-a-workflow-with-a-human-task)
    - [Step 4: Find and Complete the Task](#step-4-find-and-complete-the-task)

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

### The WorkflowExecutor and TaskClient

-   **`WorkflowExecutor`**: The primary tool for managing the workflow lifecycle (e.g., registering, starting, and stopping). For a complete method reference, see the [WorkflowExecutor API Reference](docs/api-reference/workflow-executor.md).
-   **`TaskClient`**: Used for searching and retrieving details of individual tasks within a workflow execution. For a complete method reference, see the [TaskClient API Reference](docs/api-reference/task-client.md).

### Quick Start: Creating a Workflow

#### Step 1: Define Your Workflow Structure

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

#### Step 2: Use Task Generators to Build Your Task List

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
- **Task Generators**: Helper functions like `simpleTask`, `httpTask`, etc., that create task definitions. For a complete list, see the [Task Generators Reference](docs/api-reference/task-generators.md).

#### Step 3: Register and Start Your Workflow

With the definition complete, register it with Conductor and start an execution.

```typescript
import { WorkflowExecutor } from "@io-orkes/conductor-javascript";

// Create WorkflowExecutor instance
const executor = new WorkflowExecutor(client);

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

#### Step 4: Manage and Monitor Execution

Once a workflow is running, you can monitor its status, control its execution, and debug individual tasks.

##### Check Workflow Status

Retrieve the current status and output of a running workflow.

```typescript
const status = await executor.getWorkflowStatus(
  executionId,
  true, // includeOutput
  true  // includeVariables
);
console.log(`Workflow status is: ${status.status}`);
```

##### Control Workflow Execution

You can pause, resume, or terminate workflows as needed.

```typescript
// Pause a running workflow
await executor.pause(executionId);

// Resume a paused workflow
await executor.resume(executionId);

// Terminate a workflow
await executor.terminate(executionId, "Aborted due to customer cancellation");
```

##### Search for Workflows

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

##### Use TaskClient to Monitor and Debug Tasks

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

For a complete list of methods, see the [WorkflowExecutor API Reference](docs/api-reference/workflow-executor.md) and the [TaskClient API Reference](docs/api-reference/task-client.md).

## Workers

Workers are background processes that execute tasks in your workflows. Think of them as specialized functions that:

1.  **Poll** the Conductor server for tasks.
2.  **Execute** your business logic when a task is assigned.
3.  **Report** the results back to the Conductor server.

**How Workers Fit In:**
```
Workflow → Creates Tasks → Workers Poll for Tasks → Execute Logic → Return Results → Workflow Continues
```

The `TaskManager` class in this SDK simplifies the process of creating and managing workers.

### The TaskManager

The `TaskManager` is the primary tool for managing workers. It handles polling, task execution, and result reporting, allowing you to run multiple workers concurrently. For a complete method reference, see the [TaskManager API Reference](docs/api-reference/task-manager.md).

### Quick Start: Building a Worker

Building a robust worker involves defining its logic, handling outcomes, and managing its execution.

#### Step 1: Define the Worker's Logic

A worker is an object that defines a `taskDefName` (which must match the task name in your workflow) and an `execute` function containing your business logic. 

```typescript
import { ConductorWorker } from "@io-orkes/conductor-javascript";

const emailWorker: ConductorWorker = {
  // 1. Specify the task name
  taskDefName: "send_email",
  
  // 2. Implement the execution logic
  execute: async (task) => {
    const { to, subject, body } = task.inputData;
    
    console.log(`Sending email to ${to}: ${subject}`);
    await emailService.send(to, subject, body); // Your business logic
    
    // 3. Return a result (covered in the next step)
    return {
      status: "COMPLETED",
      outputData: { sent: true, timestamp: new Date().toISOString() }
    };
  }
};
```

#### Step 2: Handle Task Outcomes and Errors

The `execute` function must return an object indicating the task's outcome.

**✅ On Success:**
Return a `COMPLETED` status and any relevant output data.

```typescript
return {
  status: "COMPLETED",
  outputData: { result: "success", data: processedData }
};
```

**❌ On Failure:**
You can control the retry behavior. `FAILED` allows for retries, while `FAILED_WITH_TERMINAL_ERROR` stops the workflow immediately.

```typescript
try {
  // Risky operation
} catch (error) {
  return {
    status: "FAILED", // Allows for retries
    logs: [{ log: `Error executing task: ${error.message}` }]
  };
}
```

#### Step 3: Run the Worker with TaskManager

The `TaskManager` is responsible for polling Conductor, managing task execution, and reporting back results. You can run a single worker or multiple workers with one manager.

```typescript
import { TaskManager } from "@io-orkes/conductor-javascript";

// You can pass a single worker or an array of workers
const workers = [emailWorker, anotherWorker, ...];

// Create the TaskManager
const manager = new TaskManager(client, workers, {
  options: {
    concurrency: 5, // Process up to 5 tasks concurrently
    pollInterval: 100, // Poll every 100ms
  }
});

// Start polling for tasks
await manager.startPolling();
console.log("Worker is running!");
```

For a complete method reference, see the [TaskManager API Reference](docs/api-reference/task-manager.md).

### Worker Design Principles

When designing workers, it's best to follow these principles:

-   **Stateless**: Workers should not rely on local state.
-   **Idempotent**: The same task input should always produce the same result.
-   **Single Responsibility**: Each worker should be responsible for one specific task type.

## Scheduling

The Conductor Scheduler allows you to run workflows at specific times or intervals, defined by a CRON expression. This is useful for tasks like nightly data processing, weekly reports, or any time-based automation.

### The SchedulerClient

The `SchedulerClient` is used to create, manage, and delete workflow schedules. For a complete method reference, see the [SchedulerClient API Reference](docs/api-reference/scheduler-client.md).

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

For a complete method reference, see the [SchedulerClient API Reference](docs/api-reference/scheduler-client.md).

## Service Registry

The Service Registry in Conductor allows you to manage and discover microservices. It also provides built-in circuit breaker functionality to improve the resilience of your distributed system.

### The ServiceRegistryClient

The `ServiceRegistryClient` is used to register, manage, and discover services. For a complete method reference, see the [ServiceRegistryClient API Reference](docs/api-reference/service-registry-client.md).

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

For a complete method reference, see the [ServiceRegistryClient API Reference](docs/api-reference/service-registry-client.md).

## Metadata

In Conductor, "metadata" refers to the definitions of your tasks and workflows. Before you can execute a workflow, you must register its definition with Conductor. The `MetadataClient` provides the tools to manage these definitions.

### The MetadataClient

The `MetadataClient` is used to register and manage task and workflow definitions. For a complete method reference, see the [MetadataClient API Reference](docs/api-reference/metadata-client.md).

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

For a complete method reference, see the [MetadataClient API Reference](docs/api-reference/metadata-client.md).

## Events

Event handlers in Conductor allow you to automatically trigger actions (like starting workflows) when events are received. This enables event-driven workflows and integrations with external systems.

### The EventClient

The `EventClient` manages event handlers and event processing. For a complete method reference, see the [EventClient API Reference](docs/api-reference/event-client.md).

### Quick Start: Using Event Handlers

Here's how to set up event-driven workflows:

#### Step 1: Create an EventClient

First, create an instance of the `EventClient`:

```typescript
import { EventClient } from "@io-orkes/conductor-javascript";

const eventClient = new EventClient(client);
```

#### Step 2: Register an Event Handler

Create an event handler that defines what action to take when an event is received. In this example, we'll start a workflow when an order is created:

```typescript
await eventClient.addEventHandler({
  name: "order_created_handler",
  event: "order.created",
  active: true,
  description: "Starts fulfillment workflow when order is created",
  actions: [
    {
      action: "start_workflow",
      start_workflow: {
        name: "fulfill_order",
        version: 1,
        input: {
          orderId: "${event.orderId}",
          customerId: "${event.customerId}",
        },
      },
    },
  ],
});
```

#### Step 3: Publish Events

When an event occurs, publish it to Conductor. All active handlers registered for that event will be triggered:

```typescript
await eventClient.handleIncomingEvent({
  event: "order.created",
  orderId: "ORDER-123",
  customerId: "CUST-456",
  amount: "99.99",
  timestamp: Date.now().toString(),
});
```

#### Step 4: Monitor Event Processing

You can monitor event handlers and their execution history:

```typescript
// Get all handlers for a specific event
const handlers = await eventClient.getEventHandlersForEvent("order.created");

// Get execution history for a handler
const executions = await eventClient.getEventExecutions("order_created_handler");

// Get event messages
const messages = await eventClient.getEventMessages("order.created");
```

#### Step 5: Manage Event Handlers

Update, deactivate, or remove event handlers as needed:

```typescript
// Update a handler
await eventClient.updateEventHandler({
  name: "order_created_handler",
  active: false, // Deactivate
  // ... other fields
});

// Remove a handler
await eventClient.removeEventHandler("order_created_handler");
```

**Event Handler Actions:**

Event handlers support various actions:
- `start_workflow` - Start a workflow execution
- `complete_task` - Complete a specific task
- `fail_task` - Fail a specific task
- `terminate_workflow` - Terminate a workflow
- `update_workflow_variables` - Update workflow variables

For a complete method reference, see the [EventClient API Reference](docs/api-reference/event-client.md).

## Applications

Applications in Conductor are security entities that enable programmatic access to the Conductor API. Each application can have multiple access keys for authentication and can be assigned roles to control what operations it can perform.

### The ApplicationClient

The `ApplicationClient` manages applications, access keys, and roles. For a complete method reference, see the [ApplicationClient API Reference](docs/api-reference/application-client.md).

### Quick Start: Managing Applications

Here's how to create and manage applications in Conductor:

#### Step 1: Create an ApplicationClient

First, create an instance of the `ApplicationClient`:

```typescript
import { ApplicationClient, ApplicationRole } from "@io-orkes/conductor-javascript";

const appClient = new ApplicationClient(client);
```

#### Step 2: Create an Application

Create a new application to represent your service or integration:

```typescript
// Create a new application
const app = await appClient.createApplication("payment-service");
console.log(`Created application: ${app.id}`);
```

#### Step 3: Generate Access Keys

Create access keys for the application to authenticate API requests:

```typescript
// Create an access key
const accessKey = await appClient.createAccessKey(app.id);
console.log(`Key ID: ${accessKey.id}`);
console.log(`Key Secret: ${accessKey.secret}`); // Save this immediately!

// The secret is only shown once - store it securely
// Use these credentials to create authenticated clients
const authenticatedClient = await orkesConductorClient({
  serverUrl: "https://play.orkes.io/api",
  keyId: accessKey.id,
  keySecret: accessKey.secret
});
```

#### Step 4: Manage Application Roles

Grant the application permissions by adding roles:

```typescript
import { ApplicationRole } from "@io-orkes/conductor-javascript";

// Add roles to the application
await appClient.addApplicationRole(app.id, "WORKFLOW_MANAGER");
await appClient.addApplicationRole(app.id, "WORKER");

console.log("Application can now execute workflows and run workers");
```

**Available Roles:**

The SDK provides an `ApplicationRole` type with the following options:

- `ADMIN` - Full administrative access to all resources
- `WORKFLOW_MANAGER` - Start and manage workflow executions
- `WORKER` - Poll for and execute assigned tasks
- `UNRESTRICTED_WORKER` - Can execute any task without restrictions
- `METADATA_MANAGER` - Manage workflow and task definitions
- `APPLICATION_MANAGER` - Manage applications and access keys
- `APPLICATION_CREATOR` - Can create new applications
- `USER` - Standard user access
- `USER_READ_ONLY` - Read-only access to resources
- `METADATA_API` - API access to metadata operations
- `PROMPT_MANAGER` - Can manage AI prompts and templates

#### Step 5: Manage Applications

Manage the lifecycle of your applications:

```typescript
// List all applications
const applications = await appClient.getAllApplications();
console.log(`Total applications: ${applications.length}`);

// Get a specific application
const myApp = await appClient.getApplication(app.id);
console.log(`Application name: ${myApp.name}`);

// Update application name
await appClient.updateApplication(app.id, "payment-service-v2");

// Get all access keys for an application
const keys = await appClient.getAccessKeys(app.id);
console.log(`Application has ${keys.length} access keys`);

// Toggle access key status (ACTIVE/INACTIVE)
await appClient.toggleAccessKeyStatus(app.id, accessKey.id);

// Remove a role from the application
await appClient.removeRoleFromApplicationUser(app.id, "WORKER");

// Delete an access key
await appClient.deleteAccessKey(app.id, accessKey.id);

// Delete the application
await appClient.deleteApplication(app.id);
```

**Tagging Applications:**

Organize applications with tags for better management:

```typescript
// Add tags to an application
await appClient.addApplicationTags(app.id, [
  { key: "environment", value: "production" },
  { key: "team", value: "payments" },
  { key: "cost-center", value: "engineering" }
]);

// Get application tags
const tags = await appClient.getApplicationTags(app.id);

// Delete specific tags
await appClient.deleteApplicationTag(app.id, {
  key: "cost-center",
  value: "engineering"
});
```

For a complete method reference, see the [ApplicationClient API Reference](docs/api-reference/application-client.md).

## Human Tasks

Human tasks integrate human interaction into your automated workflows. They pause a workflow until a person provides input, such as an approval, a correction, or additional information.

Unlike other tasks, human tasks are managed through a dedicated API (`HumanExecutor`) and often involve UI forms (`TemplateClient`). Because they are a type of **system task**, you don't need to create a custom worker to handle them.

### The HumanExecutor and TemplateClient

-   **`HumanExecutor`**: Manages the lifecycle of human tasks—searching, claiming, and completing them. For a complete method reference, see the [HumanExecutor API Reference](docs/api-reference/human-executor.md).
-   **`TemplateClient`**: Manages the UI forms and templates that are presented to users. For a complete method reference, see the [TemplateClient API Reference](docs/api-reference/template-client.md).

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

For a complete list of methods, see the [HumanExecutor API Reference](docs/api-reference/human-executor.md) and the [TemplateClient API Reference](docs/api-reference/template-client.md).
