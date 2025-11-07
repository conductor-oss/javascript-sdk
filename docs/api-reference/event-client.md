# EventClient API Reference

The `EventClient` manages event handlers and event processing in Conductor. Event handlers allow you to automatically trigger actions (like starting workflows) when events are received.

## Constructor

### `new EventClient(client: Client)`

Creates a new `EventClient`.

**Parameters:**

- `client` (`Client`): An instance of `Client`.

---

## Methods

### `getAllEventHandlers(): Promise<EventHandler[]>`

Gets all event handlers registered in Conductor.

**Returns:**

- `Promise<EventHandler[]>`: An array of all event handlers.

**Example:**

```typescript
import { EventClient } from "@io-orkes/conductor-javascript";

const eventClient = new EventClient(client);

// Get all event handlers
const handlers = await eventClient.getAllEventHandlers();
console.log(`Found ${handlers.length} event handlers`);
```

---

### `addEventHandler(eventHandler: EventHandler): Promise<void>`

Adds a single event handler.

**Parameters:**

- `eventHandler` (`EventHandler`): The event handler to add.

**Returns:**

- `Promise<void>`

**Example:**

```typescript
import { EventClient } from "@io-orkes/conductor-javascript";

const eventClient = new EventClient(client);

// Add an event handler that starts a workflow when an event is received
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
        },
      },
    },
  ],
});
```

---

### `addEventHandlers(eventHandlers: EventHandler[]): Promise<void>`

Adds multiple event handlers at once.

**Parameters:**

- `eventHandlers` (`EventHandler[]`): An array of event handlers to add.

**Returns:**

- `Promise<void>`

**Example:**

```typescript
import { EventClient } from "@io-orkes/conductor-javascript";

const eventClient = new EventClient(client);

// Add multiple event handlers
await eventClient.addEventHandlers([
  {
    name: "order_created_handler",
    event: "order.created",
    active: true,
    actions: [
      {
        action: "start_workflow",
        start_workflow: {
          name: "fulfill_order",
          version: 1,
        },
      },
    ],
  },
  {
    name: "order_cancelled_handler",
    event: "order.cancelled",
    active: true,
    actions: [
      {
        action: "start_workflow",
        start_workflow: {
          name: "cancel_order",
          version: 1,
        },
      },
    ],
  },
]);
```

---

### `updateEventHandler(eventHandler: EventHandler): Promise<void>`

Updates an existing event handler.

**Parameters:**

- `eventHandler` (`EventHandler`): The updated event handler (must include the `name` field).

**Returns:**

- `Promise<void>`

**Example:**

```typescript
import { EventClient } from "@io-orkes/conductor-javascript";

const eventClient = new EventClient(client);

// Update an existing handler
await eventClient.updateEventHandler({
  name: "order_created_handler",
  event: "order.created",
  active: false, // Deactivate the handler
  description: "Updated description",
  actions: [
    {
      action: "start_workflow",
      start_workflow: {
        name: "fulfill_order_v2", // Updated workflow name
        version: 2,
      },
    },
  ],
});
```

---

### `getEventHandlerByName(eventHandlerName: string): Promise<EventHandler>`

Gets a specific event handler by name.

**Parameters:**

- `eventHandlerName` (`string`): The name of the event handler.

**Returns:**

- `Promise<EventHandler>`: The event handler.

**Example:**

```typescript
import { EventClient } from "@io-orkes/conductor-javascript";

const eventClient = new EventClient(client);

// Get a specific handler
const handler = await eventClient.getEventHandlerByName("order_created_handler");
console.log(`Handler is ${handler.active ? "active" : "inactive"}`);
```

---

### `getEventHandlersForEvent(event: string, activeOnly?: boolean): Promise<EventHandler[]>`

Gets all event handlers registered for a specific event.

**Parameters:**

- `event` (`string`): The event name.
- `activeOnly` (`boolean`, optional): If `true`, only returns active handlers. Defaults to `false`.

**Returns:**

- `Promise<EventHandler[]>`: An array of event handlers for the specified event.

**Example:**

```typescript
import { EventClient } from "@io-orkes/conductor-javascript";

const eventClient = new EventClient(client);

// Get all handlers for an event
const handlers = await eventClient.getEventHandlersForEvent("order.created");

// Get only active handlers
const activeHandlers = await eventClient.getEventHandlersForEvent(
  "order.created",
  true
);
```

---

### `removeEventHandler(name: string): Promise<void>`

Removes an event handler by name.

**Parameters:**

- `name` (`string`): The name of the event handler to remove.

**Returns:**

- `Promise<void>`

**Example:**

```typescript
import { EventClient } from "@io-orkes/conductor-javascript";

const eventClient = new EventClient(client);

// Remove an event handler
await eventClient.removeEventHandler("order_created_handler");
```

---

### `handleIncomingEvent(data: Record<string, string>): Promise<void>`

Handles an incoming event. This triggers all active event handlers registered for the event.

**Parameters:**

- `data` (`Record<string, string>`): The event data. Must include an `event` field specifying the event name.

**Returns:**

- `Promise<void>`

**Example:**

```typescript
import { EventClient } from "@io-orkes/conductor-javascript";

const eventClient = new EventClient(client);

// Publish an event
await eventClient.handleIncomingEvent({
  event: "order.created",
  orderId: "ORDER-123",
  customerId: "CUST-456",
  amount: "99.99",
  timestamp: Date.now().toString(),
});
```

---

### `getTagsForEventHandler(name: string): Promise<Tag[]>`

Gets all tags associated with an event handler.

**Parameters:**

- `name` (`string`): The name of the event handler.

**Returns:**

- `Promise<Tag[]>`: An array of tags.

**Example:**

```typescript
import { EventClient } from "@io-orkes/conductor-javascript";

const eventClient = new EventClient(client);

// Get tags for a handler
const tags = await eventClient.getTagsForEventHandler("order_created_handler");
console.log(`Handler has ${tags.length} tags`);
```

---

### `putTagForEventHandler(name: string, tags: Tag[]): Promise<void>`

Sets tags for an event handler (replaces existing tags).

**Parameters:**

- `name` (`string`): The name of the event handler.
- `tags` (`Tag[]`): An array of tags to set.

**Returns:**

- `Promise<void>`

**Example:**

```typescript
import { EventClient } from "@io-orkes/conductor-javascript";

const eventClient = new EventClient(client);

// Set tags for a handler
await eventClient.putTagForEventHandler("order_created_handler", [
  { key: "environment", value: "production" },
  { key: "team", value: "fulfillment" },
  { key: "priority", value: "high" },
]);
```

---

### `deleteTagForEventHandler(name: string, tag: Tag): Promise<void>`

Deletes a specific tag from an event handler.

**Parameters:**

- `name` (`string`): The name of the event handler.
- `tag` (`Tag`): The tag to delete (must match both `key` and `value`).

**Returns:**

- `Promise<void>`

**Example:**

```typescript
import { EventClient } from "@io-orkes/conductor-javascript";

const eventClient = new EventClient(client);

// Delete a specific tag
await eventClient.deleteTagForEventHandler("order_created_handler", {
  key: "priority",
  value: "high",
});
```

---

### `deleteTagsForEventHandler(name: string, tags: Tag[]): Promise<void>`

Deletes multiple tags from an event handler.

**Parameters:**

- `name` (`string`): The name of the event handler.
- `tags` (`Tag[]`): An array of tags to delete.

**Returns:**

- `Promise<void>`

**Example:**

```typescript
import { EventClient } from "@io-orkes/conductor-javascript";

const eventClient = new EventClient(client);

// Delete multiple tags
await eventClient.deleteTagsForEventHandler("order_created_handler", [
  { key: "priority", value: "high" },
  { key: "team", value: "fulfillment" },
]);
```

---

### `getAllActiveEventHandlers(): Promise<SearchResultHandledEventResponse>`

Gets all active event handlers with execution information (execution view).

**Returns:**

- `Promise<SearchResultHandledEventResponse>`: A search result containing active event handlers with execution data.

**Example:**

```typescript
import { EventClient } from "@io-orkes/conductor-javascript";

const eventClient = new EventClient(client);

// Get all active handlers with execution info
const result = await eventClient.getAllActiveEventHandlers();
console.log(`Found ${result.totalHits} active handlers`);
result.results?.forEach((handler) => {
  console.log(`${handler.name}: ${handler.numberOfActions} actions`);
});
```

---

### `getEventExecutions(eventHandlerName: string, from?: number): Promise<ExtendedEventExecution[]>`

Gets execution history for a specific event handler.

**Parameters:**

- `eventHandlerName` (`string`): The name of the event handler.
- `from` (`number`, optional): Pagination cursor for retrieving more results.

**Returns:**

- `Promise<ExtendedEventExecution[]>`: An array of event executions.

**Example:**

```typescript
import { EventClient } from "@io-orkes/conductor-javascript";

const eventClient = new EventClient(client);

// Get execution history for a handler
const executions = await eventClient.getEventExecutions("order_created_handler");
executions.forEach((exec) => {
  console.log(`Execution ${exec.id}: ${exec.status}`);
});
```

---

### `getEventHandlersWithStats(from?: number): Promise<SearchResultHandledEventResponse>`

Gets all event handlers with statistics (messages view).

**Parameters:**

- `from` (`number`, optional): Pagination cursor for retrieving more results.

**Returns:**

- `Promise<SearchResultHandledEventResponse>`: A search result containing event handlers with statistics.

**Example:**

```typescript
import { EventClient } from "@io-orkes/conductor-javascript";

const eventClient = new EventClient(client);

// Get handlers with statistics
const result = await eventClient.getEventHandlersWithStats();
result.results?.forEach((handler) => {
  console.log(
    `${handler.name}: ${handler.numberOfMessages} messages, ${handler.numberOfActions} actions`
  );
});
```

---

### `getEventMessages(event: string, from?: number): Promise<EventMessage[]>`

Gets all messages for a specific event.

**Parameters:**

- `event` (`string`): The event name.
- `from` (`number`, optional): Pagination cursor for retrieving more results.

**Returns:**

- `Promise<EventMessage[]>`: An array of event messages.

**Example:**

```typescript
import { EventClient } from "@io-orkes/conductor-javascript";

const eventClient = new EventClient(client);

// Get all messages for an event
const messages = await eventClient.getEventMessages("order.created");
messages.forEach((msg) => {
  console.log(`Message ${msg.id}: ${msg.status}`);
  console.log(`Payload:`, msg.fullPayload);
});
```

---

### `testConnectivity(input: ConnectivityTestInput): Promise<ConnectivityTestResult>`

Tests connectivity for a queue using a workflow with an EVENT task and an EventHandler.

**Parameters:**

- `input` (`ConnectivityTestInput`): The connectivity test configuration.

**Returns:**

- `Promise<ConnectivityTestResult>`: The test result.

**Example:**

```typescript
import { EventClient } from "@io-orkes/conductor-javascript";

const eventClient = new EventClient(client);

// Test connectivity
const result = await eventClient.testConnectivity({
  sink: "sqs:my-queue",
  input: {
    testKey: "testValue",
  },
});

console.log(`Test ${result.successful ? "passed" : "failed"}`);
if (!result.successful) {
  console.log(`Reason: ${result.reason}`);
}
```

---

### `test(): Promise<EventHandler>`

Tests the event endpoint (as exposed by API).

**Returns:**

- `Promise<EventHandler>`: A test event handler response.

**Example:**

```typescript
import { EventClient } from "@io-orkes/conductor-javascript";

const eventClient = new EventClient(client);

// Test the endpoint
const result = await eventClient.test();
console.log("Test endpoint response:", result);
```

---

### `getAllQueueConfigs(): Promise<{ [key: string]: string }>`

Gets all queue configurations.

**Returns:**

- `Promise<{ [key: string]: string }>`: A record of queue names.

**Example:**

```typescript
import { EventClient } from "@io-orkes/conductor-javascript";

const eventClient = new EventClient(client);

// Get all queue configs
const queues = await eventClient.getAllQueueConfigs();
console.log(`Found ${Object.keys(queues).length} queues`);
```

---

### `getQueueConfig(queueType: string, queueName: string): Promise<Record<string, unknown>>`

Gets the configuration for a specific queue.

**Parameters:**

- `queueType` (`string`): The type of queue (e.g., `"sqs"`, `"kafka"`).
- `queueName` (`string`): The name of the queue.

**Returns:**

- `Promise<Record<string, unknown>>`: The queue configuration.

**Example:**

```typescript
import { EventClient } from "@io-orkes/conductor-javascript";

const eventClient = new EventClient(client);

// Get queue config
const config = await eventClient.getQueueConfig("sqs", "my-queue");
console.log("Queue config:", config);
```

---

### `putQueueConfig(queueType: string, queueName: string, config: string): Promise<void>`

Creates or updates a queue configuration by name.

**Deprecated:** Prefer server's newer endpoints if available.

**Parameters:**

- `queueType` (`string`): The type of queue.
- `queueName` (`string`): The name of the queue.
- `config` (`string`): The queue configuration as a string.

**Returns:**

- `Promise<void>`

**Example:**

```typescript
import { EventClient } from "@io-orkes/conductor-javascript";

const eventClient = new EventClient(client);

// Set queue config
await eventClient.putQueueConfig("sqs", "my-queue", '{"region": "us-east-1"}');
```

---

### `deleteQueueConfig(queueType: string, queueName: string): Promise<void>`

Deletes a queue configuration.

**Parameters:**

- `queueType` (`string`): The type of queue.
- `queueName` (`string`): The name of the queue.

**Returns:**

- `Promise<void>`

**Example:**

```typescript
import { EventClient } from "@io-orkes/conductor-javascript";

const eventClient = new EventClient(client);

// Delete queue config
await eventClient.deleteQueueConfig("sqs", "my-queue");
```

---

## Type Definitions

### `EventHandler`

```typescript
export type EventHandler = {
  actions?: Array<Action>;
  active?: boolean;
  condition?: string;
  createdBy?: string;
  description?: string;
  evaluatorType?: string;
  event?: string;
  name?: string;
  orgId?: string;
  tags?: Array<Tag>;
};
```

### `Action`

```typescript
export type Action = {
  action?: "start_workflow" | "complete_task" | "fail_task" | "terminate_workflow" | "update_workflow_variables";
  complete_task?: TaskDetails;
  expandInlineJSON?: boolean;
  fail_task?: TaskDetails;
  start_workflow?: StartWorkflowRequest;
  terminate_workflow?: TerminateWorkflow;
  update_workflow_variables?: UpdateWorkflowVariables;
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
  value?: string;
};
```

### `ConnectivityTestInput`

```typescript
export type ConnectivityTestInput = {
  input?: {
    [key: string]: unknown;
  };
  sink: string;
};
```

### `ConnectivityTestResult`

```typescript
export type ConnectivityTestResult = {
  reason?: string;
  successful?: boolean;
  workflowId?: string;
};
```

### `ExtendedEventExecution`

```typescript
export type ExtendedEventExecution = {
  action?: "start_workflow" | "complete_task" | "fail_task" | "terminate_workflow" | "update_workflow_variables";
  created?: number;
  event?: string;
  eventHandler?: EventHandler;
  fullMessagePayload?: {
    [key: string]: unknown;
  };
  id?: string;
  messageId?: string;
  name?: string;
  orgId?: string;
  output?: {
    [key: string]: unknown;
  };
  payload?: {
    [key: string]: unknown;
  };
  status?: "IN_PROGRESS" | "COMPLETED" | "FAILED" | "SKIPPED";
  statusDescription?: string;
};
```

### `EventMessage`

```typescript
export type EventMessage = {
  createdAt?: number;
  eventExecutions?: Array<ExtendedEventExecution>;
  eventTarget?: string;
  eventType?: "WEBHOOK" | "MESSAGE";
  fullPayload?: {
    [key: string]: unknown;
  };
  id?: string;
  orgId?: string;
  payload?: string;
  status?: "RECEIVED" | "HANDLED" | "REJECTED";
  statusDescription?: string;
};
```

### `SearchResultHandledEventResponse`

```typescript
export type SearchResultHandledEventResponse = {
  results?: Array<HandledEventResponse>;
  totalHits?: number;
};
```

### `HandledEventResponse`

```typescript
export type HandledEventResponse = {
  active?: boolean;
  event?: string;
  name?: string;
  numberOfActions?: number;
  numberOfMessages?: number;
};
```

