# Conductor OSS JavaScript/TypeScript SDK

A comprehensive TypeScript/JavaScript client for [Netflix Conductor](https://github.com/conductor-oss/conductor) and [Orkes Conductor](https://orkes.io/content), enabling developers to build, orchestrate, and monitor distributed workflows with ease.

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
- [Workflows](#workflows)
  - [WorkflowExecutor](#workflowexecutor)
  - [Workflow Factory](#workflow-factory)
  - [Register Workflow](#register-workflow)
  - [Start Workflow](#start-workflow)
  - [Get Workflow Status](#get-workflow-status)
  - [Pause Workflow](#pause-workflow)
  - [Resume Workflow](#resume-workflow)
  - [Terminate Workflow](#terminate-workflow)
  - [Workflow Search](#workflow-search)
- [Workers](#workers)
  - [Overview](#overview)
  - [Quick Start: Your First Worker](#quick-start-your-first-worker)
  - [Understanding Worker Execution Flow](#understanding-worker-execution-flow)
  - [Worker Design Principles](#worker-design-principles)
  - [Handling Task Results](#handling-task-results)
  - [Working with Multiple Workers](#working-with-multiple-workers)
  - [TaskManager (Recommended)](#taskmanager-recommended)
    - [Advanced Configuration](#advanced-configuration)
    - [Dynamic Configuration Updates](#dynamic-configuration-updates)
    - [Graceful Shutdown](#graceful-shutdown)
  - [TaskRunner (Low-level)](#taskrunner-low-level)
  - [Configuration Options](#configuration-options-1)
  - [When to Use Each Approach](#when-to-use-each-approach)
- [Tasks](#tasks)
  - [TaskClient](#taskclient)
  - [Task Status and Monitoring](#task-status-and-monitoring)
  - [Task Search and Filtering](#task-search-and-filtering)
  - [Task Debugging](#task-debugging)
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
- [Error Handling](#error-handling)
  - [Worker Error Handling](#worker-error-handling)
  - [Task Manager Error Handling](#task-manager-error-handling)
  - [Workflow Error Handling](#workflow-error-handling)
- [Logging](#logging)
  - [Default Logger](#default-logger)
  - [Custom Logger](#custom-logger)
- [Best Practices](#best-practices)
  - [Worker Design](#worker-design)
  - [Workflow Design](#workflow-design)
  - [Performance](#performance)
  - [Security](#security)
- [API Reference](#api-reference)
  - [Core Classes](#core-classes)
  - [Task Generators](#task-generators)
  - [Factory Functions](#factory-functions)
  - [Configuration Options](#configuration-options-2)
- [Examples](#examples)
  - [Complete Example: Order Processing Workflow](#complete-example-order-processing-workflow)
- [Troubleshooting](#troubleshooting)
  - [Common Issues](#common-issues)
  - [Debug Mode](#debug-mode)
  - [Health Checks](#health-checks)

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
  keyId: "your-key-id",                   // authentication key
  keySecret: "your-key-secret",           // authentication secret
  refreshTokenInterval: 0,                // optional: token refresh interval, 0 = no refresh (default: 30min)
  maxHttp2Connections: 1                  // optional: max HTTP2 connections (default: 1)
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

### What are Tasks?
Tasks are individual units of work that can be executed by workers or handled by the Conductor server.

### What are Workflows?
Workflows are the main orchestration units in Conductor. They define a sequence of tasks and their dependencies.

### What are Workers?
Workers are applications that execute specific types of tasks. They poll for work and execute tasks assigned to them.

### What is the Scheduler?
The scheduler allows you to schedule workflows to run at specific times or intervals, enabling automated workflow execution based on time-based triggers.

## Task Types

The SDK provides generators for various task types to build workflow definitions. These generators create workflow task references that are used within workflow definitions.

**Note:** These task generators create workflow task references, not task metadata definitions. To register task metadata (like task definitions with retry policies, timeouts, etc.), use the `taskDefinition()` factory function or plain objects with the `MetadataClient` (see [Metadata](#metadata) section).

### Simple Task

```typescript
import { simpleTask } from "@io-orkes/conductor-javascript";

const task = simpleTask("task_ref", "task_name", {
  inputParam: "value"
}, false); // optional: if true, workflow continues even if task fails
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

### Usage Example: Creating Workflows

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

## Workflows

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

// Register workflow (overwrite=true means it will replace existing definition)
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
await executor.pause(executionId);
```

#### Resume Workflow

```typescript
await executor.resume(executionId);
```

#### Terminate Workflow

```typescript
await executor.terminate(executionId, "Terminating due to error");
```

#### Workflow Search

```typescript
const searchResults = await executor.search(
  0,                    // start
  10,                   // size
  "status:RUNNING",     // query
  "*",                  // freeText
  "startTime:DESC"      // sort (optional)
);
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

The SDK provides two approaches for managing workers:
- **TaskManager** - Easy-to-use interface for managing multiple workers (⭐ **recommended for most use cases**)
- **TaskRunner** - Low-level interface for fine-grained control of individual workers

### Quick Start: Your First Worker

Here's a complete, simple example to get you started:

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

### TaskManager (Recommended)

`TaskManager` is the high-level interface that manages multiple workers. You've already seen the basic usage above. This section covers advanced configuration and features.

#### Advanced Configuration

```typescript
import { TaskManager, ConductorWorker, DefaultLogger } from "@io-orkes/conductor-javascript";

const manager = new TaskManager(client, workers, {
  // Custom logger for debugging and monitoring
  logger: new DefaultLogger(),
  
  // Polling and execution options
  options: {
    pollInterval: 1000,           // Poll every 1 second (default: 100ms)
    concurrency: 5,               // Execute up to 5 tasks concurrently per worker
    workerID: "worker-group-1",   // Unique identifier for this worker group
    domain: "production",         // Task domain for isolation (optional)
    batchPollingTimeout: 100      // Timeout for batch polling in ms
  },
  
  // Global error handler for all workers
  onError: (error, task) => {
    console.error(`Error in task ${task?.taskType}:`, error);
    // Send to error tracking service
    errorTracker.log(error, { taskId: task?.taskId });
  },
  
  // Maximum retry attempts before giving up
  maxRetries: 3
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

// Or with timeout
async function gracefulShutdown() {
  const timeout = setTimeout(() => {
    console.error('Force shutdown after timeout');
    process.exit(1);
  }, 30000); // 30 second timeout
  
  await manager.stopPolling();
  clearTimeout(timeout);
  process.exit(0);
}
```

### TaskRunner (Low-level)

`TaskRunner` is the low-level interface used internally by `TaskManager`. **Most developers should use `TaskManager` instead.** Use `TaskRunner` only if you need:

- Fine-grained control over a single worker's lifecycle
- Custom polling logic or worker management
- Integration with existing worker management systems

**Basic Example:**

```typescript
import { TaskRunner, ConductorWorker } from "@io-orkes/conductor-javascript";

const worker: ConductorWorker = {
  taskDefName: "specialized_task",
  execute: async (task) => {
    return {
      outputData: { result: "processed" },
      status: "COMPLETED"
    };
  }
};

const taskRunner = new TaskRunner({
  worker: worker,
  taskResource: client.taskResource,  // Note: Direct access to taskResource
  options: {
    pollInterval: 1000,
    concurrency: 1,
    workerID: "specialized-worker"
  }
});

await taskRunner.startPolling();
// ... later
await taskRunner.stopPolling();
```

**Key Differences from TaskManager:**
- Manages only ONE worker (vs TaskManager managing multiple)
- Requires direct `taskResource` access
- No built-in error handling or retry logic
- More manual lifecycle management

### Configuration Options

#### TaskManager Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `logger` | `ConductorLogger` | - | Custom logger instance for monitoring and debugging |
| `options.pollInterval` | `number` | `100` | How often to poll for tasks (milliseconds) |
| `options.concurrency` | `number` | `1` | Max concurrent task executions per worker |
| `options.workerID` | `string` | - | Unique identifier for this worker group |
| `options.domain` | `string` | - | Task domain for isolation (optional) |
| `options.batchPollingTimeout` | `number` | `100` | Batch polling timeout in milliseconds |
| `onError` | `(error, task?) => void` | - | Global error handler called when workers fail |
| `maxRetries` | `number` | `3` | Max retry attempts for failed operations |

**Example with all options:**
```typescript
const manager = new TaskManager(client, workers, {
  logger: new CustomLogger(),
  options: {
    pollInterval: 1000,
    concurrency: 5,
    workerID: "prod-worker-1",
    domain: "production",
    batchPollingTimeout: 100
  },
  onError: (error, task) => console.error("Error:", error),
  maxRetries: 3
});
```

#### TaskRunner Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `worker` | `ConductorWorker` | **required** | The worker definition to run |
| `taskResource` | `TaskResourceService` | **required** | Task resource service from client |
| `options.pollInterval` | `number` | `100` | Polling interval in milliseconds |
| `options.concurrency` | `number` | `1` | Max concurrent executions |
| `options.workerID` | `string` | - | Unique worker identifier |
| `options.domain` | `string` | - | Task domain for isolation |
| `logger` | `ConductorLogger` | - | Custom logger instance |

### When to Use Each Approach

**Use TaskManager when:**
- ✅ You have multiple workers (most common case)
- ✅ You want simple, high-level worker management
- ✅ You need built-in error handling and retries
- ✅ You're building a standard worker application

**Use TaskRunner when:**
- 🔧 You need fine-grained control over a single worker
- 🔧 You're implementing custom worker management logic
- 🔧 You're integrating with existing polling/execution frameworks
- 🔧 You need direct access to low-level worker operations

**💡 Recommendation:** Start with `TaskManager`. Only use `TaskRunner` if you have specific advanced requirements that TaskManager doesn't support.

## Tasks

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

## Scheduling

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

## Metadata

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

const taskDef = taskDefinition({
  name: "task_name",
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

await metadataClient.updateTask(updatedTaskDef);
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

Follow the [Worker Design Principles](#worker-design-principles) outlined in the Workers section:
- Keep workers **stateless** and avoid maintaining workflow-specific state
- Design workers to be **idempotent** to handle task rescheduling
- Ensure each worker is **specific** to one task type with well-defined inputs/outputs
- Let Conductor handle retries; workers should focus on task execution

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
- `refreshTokenInterval`: Token refresh interval in milliseconds (0 = no refresh, default: 30 minutes)
- `maxHttp2Connections`: Maximum HTTP2 connections (default: 1)

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