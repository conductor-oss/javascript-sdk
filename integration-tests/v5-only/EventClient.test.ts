import { expect, describe, test, jest } from "@jest/globals";
import { orkesConductorClient } from "../../src/orkes";
import { EventClient } from "../../src/core";
import type { EventHandler } from "../../src/common";
import type { Action } from "../../src/common/open-api/types.gen";

describe("EventClient", () => {
  jest.setTimeout(60000);
  // Helper function to create unique names
  const createUniqueName = (prefix: string) =>
    `jsSdkTest:${prefix}:${Date.now()}`;

  describe("Event Processing", () => {
    test("Should handle incoming event", async () => {
      const eventClient = new EventClient(await orkesConductorClient());
      const handlerName = createUniqueName("event-handler");
      const eventName = createUniqueName("event");

      const workflowName = createUniqueName("test-workflow");
      const startWorkflowAction: Action = {
        action: "start_workflow",
        start_workflow: {
          name: workflowName,
          version: 1,
          input: {},
        },
      };

      const eventHandler: EventHandler = {
        name: handlerName,
        event: eventName,
        active: true,
        actions: [startWorkflowAction],
        description: `Test handler for ${eventName}`,
      };
      await eventClient.addEventHandler(eventHandler);

      const retrievedHandler = await eventClient.getEventHandlerByName(
        handlerName
      );
      expect(retrievedHandler.name).toEqual(handlerName);
      expect(retrievedHandler.event).toEqual(eventName);
      expect(retrievedHandler.active).toBe(true);

      const handlersForEvent = await eventClient.getEventHandlersForEvent(
        eventName
      );
      expect(handlersForEvent.length).toBeGreaterThan(0);
      expect(handlersForEvent.some((h) => h.name === handlerName)).toBe(true);

      const eventData: Record<string, string> = {
        event: eventName,
        source: "integration-test",
        timestamp: Date.now().toString(),
        message: "test event",
      };

      await eventClient.handleIncomingEvent(eventData);

      const handlerAfterEvent = await eventClient.getEventHandlerByName(
        handlerName
      );
      expect(handlerAfterEvent.active).toBe(true);
      expect(handlerAfterEvent.event).toEqual(eventName);

      const executions = await eventClient.getEventExecutions(handlerName);
      expect(Array.isArray(executions)).toBe(true);

      const ourExecution = executions.find(
        (exec) => exec.event === eventName || exec.name === handlerName
      );
      expect(ourExecution).toBeDefined();
      if (ourExecution?.event) {
        expect(ourExecution.event).toEqual(eventName);
      }
      if (ourExecution?.name) {
        expect(ourExecution.name).toEqual(handlerName);
      }

      await eventClient.removeEventHandler(handlerName);
    });
  });

  describe("Event Executions and Statistics", () => {
    test("Should get all active event handlers (execution view)", async () => {
      const eventClient = new EventClient(await orkesConductorClient());

      const handlerName = createUniqueName("event-handler");
      const eventName = createUniqueName("event");
      const workflowName = createUniqueName("test-workflow");

      const startWorkflowAction: Action = {
        action: "start_workflow",
        start_workflow: {
          name: workflowName,
          version: 1,
          input: {},
        },
      };

      const eventHandler: EventHandler = {
        name: handlerName,
        event: eventName,
        active: true,
        actions: [startWorkflowAction],
        description: `Test handler for ${eventName}`,
      };

      await eventClient.addEventHandler(eventHandler);

      // Trigger an event so the handler processes it and appears in execution view
      const eventData: Record<string, string> = {
        event: eventName,
        source: "integration-test",
        timestamp: Date.now().toString(),
        message: "test event",
      };
      await eventClient.handleIncomingEvent(eventData);

      // Get all active event handlers (execution view only shows handlers with executions)
      const result = await eventClient.getAllActiveEventHandlers();

      expect(result).toBeDefined();
      expect(result).toHaveProperty("results");
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results?.length).toBeGreaterThan(0);

      // Verify our handler appears in the results
      const foundHandler = result.results?.find(
        (h) => h.name === handlerName && h.event === eventName
      );
      expect(foundHandler).toBeDefined();
      expect(foundHandler?.name).toBe(handlerName);
      expect(foundHandler?.event).toBe(eventName);
      expect(foundHandler?.active).toBe(true);

      await eventClient.removeEventHandler(handlerName);
    });

    test("Should get event executions for a handler", async () => {
      const eventClient = new EventClient(await orkesConductorClient());
      const handlerName = createUniqueName("event-handler");
      const eventName = createUniqueName("event");
      const workflowName = createUniqueName("test-workflow");

      const startWorkflowAction: Action = {
        action: "start_workflow",
        start_workflow: {
          name: workflowName,
          version: 1,
          input: {},
        },
      };

      const eventHandler: EventHandler = {
        name: handlerName,
        event: eventName,
        active: true,
        actions: [startWorkflowAction],
        description: `Test handler for ${eventName}`,
      };
      await eventClient.addEventHandler(eventHandler);

      // Trigger an event so the handler processes it and creates an execution
      const eventData = {
        event: eventName,
        source: "integration-test",
        timestamp: Date.now().toString(),
        message: "test event",
      };
      await eventClient.handleIncomingEvent(eventData);

      const executions = await eventClient.getEventExecutions(handlerName, 0);
      expect(Array.isArray(executions)).toBe(true);
      expect(executions.length).toBeGreaterThan(0);

      // Find our execution in the results
      const ourExecution = executions.find(
        (exec) => exec.name === handlerName && exec.event === eventName
      );
      expect(ourExecution).toBeDefined();
      expect(ourExecution?.name).toBe(handlerName);
      expect(ourExecution?.event).toBe(eventName);
      expect(typeof ourExecution?.id).toBe("string");
      expect(typeof ourExecution?.created).toBe("number");
      expect(ourExecution?.action).toBe("start_workflow");

      await eventClient.removeEventHandler(handlerName);
    });

    test("Should get event handlers with statistics", async () => {
      const eventClient = new EventClient(await orkesConductorClient());
      const handlerName = createUniqueName("event-handler");
      const eventName = createUniqueName("event");
      const workflowName = createUniqueName("test-workflow");

      const startWorkflowAction: Action = {
        action: "start_workflow",
        start_workflow: {
          name: workflowName,
          version: 1,
          input: {},
        },
      };

      const eventHandler: EventHandler = {
        name: handlerName,
        event: eventName,
        active: true,
        actions: [startWorkflowAction],
        description: `Test handler for ${eventName}`,
      };
      await eventClient.addEventHandler(eventHandler);

      // Trigger an event so the handler processes it and creates an execution
      const eventData = {
        event: eventName,
        source: "integration-test",
        timestamp: Date.now().toString(),
        message: "test event",
      };
      await eventClient.handleIncomingEvent(eventData);

      const response = await eventClient.getEventHandlersWithStats(0);
      expect(response).toBeDefined();
      expect(response).toHaveProperty("results");
      expect(Array.isArray(response.results)).toBe(true);
      expect(response.results?.length).toBeGreaterThan(0);

      // Find our handler in the results
      const foundHandler = response.results?.find((h) => h.event === eventName);
      expect(foundHandler).toBeDefined();
      expect(foundHandler?.event).toBe(eventName);
      expect(foundHandler?.active).toBe(true);
      expect(typeof foundHandler?.numberOfActions).toBe("number");
      expect(typeof foundHandler?.numberOfMessages).toBe("number");

      await eventClient.removeEventHandler(handlerName);
    });

    test("Should get event messages for an event", async () => {
      const eventClient = new EventClient(await orkesConductorClient());
      const handlerName = createUniqueName("event-handler");
      const eventName = createUniqueName("event");
      const workflowName = createUniqueName("test-workflow");

      const startWorkflowAction: Action = {
        action: "start_workflow",
        start_workflow: {
          name: workflowName,
          version: 1,
          input: {},
        },
      };

      const eventHandler: EventHandler = {
        name: handlerName,
        event: eventName,
        active: true,
        actions: [startWorkflowAction],
        description: `Test handler for ${eventName}`,
      };
      await eventClient.addEventHandler(eventHandler);

      // Trigger an event to create messages
      const eventData = {
        event: eventName,
        source: "integration-test",
        timestamp: Date.now().toString(),
        message: "test event",
      };
      await eventClient.handleIncomingEvent(eventData);

      const messages = await eventClient.getEventMessages(eventName);
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThan(0);

      // Find our message in the results
      const ourMessage = messages.find((msg) => msg.eventTarget === eventName);
      expect(ourMessage).toBeDefined();
      expect(typeof ourMessage).toBe("object");
      expect(typeof ourMessage?.id).toBe("string");
      expect(typeof ourMessage?.createdAt).toBe("number");
      expect(ourMessage?.fullPayload?.event).toBe(eventName);
      expect(ourMessage?.fullPayload?.source).toBe("integration-test");
      expect(ourMessage?.fullPayload?.message).toBe("test event");

      await eventClient.removeEventHandler(handlerName);
    });
  });
});
