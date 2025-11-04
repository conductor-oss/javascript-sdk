import { expect, describe, test, jest } from "@jest/globals";
import { orkesConductorClient } from "../../src/orkes";
import { EventClient } from "../../src/core";
import type { EventHandler } from "../../src/common";
import type {
  Tag,
  ConnectivityTestInput,
  Action,
} from "../../src/common/open-api/types.gen";

describe("EventClient", () => {
  jest.setTimeout(60000);
  // Helper function to create unique names
  const createUniqueName = (prefix: string) =>
    `jsSdkTest:${prefix}:${Date.now()}`;

  // Helper function to create a test event handler
  const createEventHandler = (
    name: string,
    event: string,
    active = true
  ): EventHandler => ({
    name,
    event,
    active,
    actions: [],
    description: `Test event handler: ${name}`,
  });

  describe("Event Handler Management", () => {
    test("Should add a single event handler", async () => {
      const eventClient = new EventClient(await orkesConductorClient());
      const handlerName = createUniqueName("event-handler");
      const eventName = createUniqueName("event");

      const workflowName = createUniqueName("test-workflow");

      const startWorkflowAction: Action = {
        action: "start_workflow",
        start_workflow: {
          name: workflowName,
          version: 1,
          input: {
            testKey: "testValue",
          },
        },
      };

      const eventHandler: EventHandler = {
        name: handlerName,
        event: eventName,
        active: true,
        actions: [startWorkflowAction],
        description: `Test event handler: ${handlerName}`,
        condition: "true",
        evaluatorType: "javascript",
        tags: [
          { key: "test-tag-key-1", value: "test-tag-value-1" },
          { key: "environment", value: "test" },
        ],
      };

      await expect(
        eventClient.addEventHandler(eventHandler)
      ).resolves.not.toThrow();

      const retrievedHandler = await eventClient.getEventHandlerByName(
        handlerName
      );
      expect(retrievedHandler.name).toEqual(handlerName);
      expect(retrievedHandler.event).toEqual(eventName);
      expect(retrievedHandler.active).toEqual(true);
      expect(retrievedHandler.description).toEqual(eventHandler.description);
      expect(retrievedHandler.condition).toEqual(eventHandler.condition);
      expect(retrievedHandler.evaluatorType).toEqual(
        eventHandler.evaluatorType
      );
      expect(retrievedHandler.createdBy?.includes("app:")).toBeTruthy();
      expect(typeof retrievedHandler.createdBy).toBe("string");
      expect(retrievedHandler.actions).toBeDefined();
      expect(Array.isArray(retrievedHandler.actions)).toBe(true);
      expect(retrievedHandler.actions?.length).toBeGreaterThanOrEqual(1);
      const retrievedAction = retrievedHandler.actions?.[0];
      expect(retrievedAction?.action).toEqual("start_workflow");
      expect(retrievedAction?.start_workflow).toBeDefined();
      expect(retrievedAction?.start_workflow?.name).toEqual(workflowName);
      expect(retrievedAction?.start_workflow?.version).toEqual(1);

      expect(retrievedHandler.tags).toBeDefined();
      expect(Array.isArray(retrievedHandler.tags)).toBe(true);
      expect(retrievedHandler.tags?.length).toBeGreaterThanOrEqual(2);
      eventHandler.tags?.forEach((tag) => {
        const foundTag = retrievedHandler.tags?.find(
          (t) => t.key === tag.key && t.value === tag.value
        );
        expect(foundTag).toBeDefined();
      });

      // Cleanup
      await eventClient.removeEventHandler(handlerName);
    });

    test("Should add multiple event handlers", async () => {
      const eventClient = new EventClient(await orkesConductorClient());
      const handlerName1 = createUniqueName("event-handler-1");
      const handlerName2 = createUniqueName("event-handler-2");
      const eventName1 = createUniqueName("event-1");
      const eventName2 = createUniqueName("event-2");

      const eventHandlers = [
        createEventHandler(handlerName1, eventName1),
        createEventHandler(handlerName2, eventName2),
      ];

      await expect(
        eventClient.addEventHandlers(eventHandlers)
      ).resolves.not.toThrow();

      // Verify both were added
      const allHandlers = await eventClient.getAllEventHandlers();
      const addedHandlers = allHandlers.filter(
        (h) => h.name === handlerName1 || h.name === handlerName2
      );
      expect(addedHandlers.length).toBeGreaterThanOrEqual(2);

      // Cleanup
      await eventClient.removeEventHandler(handlerName1);
      await eventClient.removeEventHandler(handlerName2);
    });

    test("Should update an event handler", async () => {
      const eventClient = new EventClient(await orkesConductorClient());
      const handlerName = createUniqueName("event-handler");
      const eventName = createUniqueName("event");

      const eventHandler = createEventHandler(handlerName, eventName, true);

      // Add the handler
      await eventClient.addEventHandler(eventHandler);

      // Update the handler
      const updatedHandler: EventHandler = {
        ...eventHandler,
        active: false,
        description: "Updated description",
      };

      await expect(
        eventClient.updateEventHandler(updatedHandler)
      ).resolves.not.toThrow();

      // Verify it was updated
      const retrievedHandler = await eventClient.getEventHandlerByName(
        handlerName
      );
      expect(retrievedHandler.active).toEqual(false);
      expect(retrievedHandler.description).toEqual("Updated description");

      // Cleanup
      await eventClient.removeEventHandler(handlerName);
    });

    test("Should get all event handlers", async () => {
      const eventClient = new EventClient(await orkesConductorClient());
      const handlers = await eventClient.getAllEventHandlers();

      expect(Array.isArray(handlers)).toBe(true);
    });

    test("Should get event handler by name", async () => {
      const eventClient = new EventClient(await orkesConductorClient());
      const handlerName = createUniqueName("event-handler");
      const eventName = createUniqueName("event");

      const eventHandler = createEventHandler(handlerName, eventName);

      await eventClient.addEventHandler(eventHandler);

      const retrievedHandler = await eventClient.getEventHandlerByName(
        handlerName
      );

      expect(retrievedHandler.name).toEqual(handlerName);
      expect(retrievedHandler.event).toEqual(eventName);

      // Cleanup
      await eventClient.removeEventHandler(handlerName);
    });

    test("Should get event handlers for a specific event", async () => {
      const eventClient = new EventClient(await orkesConductorClient());
      const handlerName = createUniqueName("event-handler");
      const eventName = createUniqueName("event");

      const eventHandler = createEventHandler(handlerName, eventName);

      await eventClient.addEventHandler(eventHandler);

      const handlers = await eventClient.getEventHandlersForEvent(eventName);

      expect(Array.isArray(handlers)).toBe(true);
      const foundHandler = handlers.find((h) => h.name === handlerName);
      expect(foundHandler).toBeDefined();

      // Test with activeOnly parameter
      const activeHandlers = await eventClient.getEventHandlersForEvent(
        eventName,
        true
      );
      expect(Array.isArray(activeHandlers)).toBe(true);

      // Cleanup
      await eventClient.removeEventHandler(handlerName);
    });

    test("Should remove an event handler", async () => {
      const eventClient = new EventClient(await orkesConductorClient());
      const handlerName = createUniqueName("event-handler");
      const eventName = createUniqueName("event");

      const eventHandler = createEventHandler(handlerName, eventName);

      await eventClient.addEventHandler(eventHandler);

      // Verify it exists
      const retrievedHandler = await eventClient.getEventHandlerByName(
        handlerName
      );
      expect(retrievedHandler.name).toEqual(handlerName);

      // Remove it
      await expect(
        eventClient.removeEventHandler(handlerName)
      ).resolves.not.toThrow();

      // Verify it's removed by checking handlers for the event
      const handlers = await eventClient.getEventHandlersForEvent(eventName);
      const foundHandler = handlers.find((h) => h.name === handlerName);
      expect(foundHandler).toBeUndefined();
    });
  });

  describe("Tag Management", () => {
    test("Should get tags for an event handler", async () => {
      const eventClient = new EventClient(await orkesConductorClient());
      const handlerName = createUniqueName("event-handler");
      const eventName = createUniqueName("event");

      const eventHandler = createEventHandler(handlerName, eventName);

      await eventClient.addEventHandler(eventHandler);

      // Add tags to the event handler
      const expectedTags: Tag[] = [
        { key: "test-key-1", value: "test-value-1" },
        { key: "test-key-2", value: "test-value-2" },
        { key: "environment", value: "test" },
      ];

      await eventClient.putTagForEventHandler(handlerName, expectedTags);

      // Get tags and verify they match exactly
      const retrievedTags = await eventClient.getTagsForEventHandler(
        handlerName
      );

      expect(Array.isArray(retrievedTags)).toBe(true);
      expect(retrievedTags.length).toBeGreaterThanOrEqual(expectedTags.length);

      // Verify each expected tag is present
      expectedTags.forEach((expectedTag) => {
        const foundTag = retrievedTags.find(
          (tag) =>
            tag.key === expectedTag.key && tag.value === expectedTag.value
        );
        expect(foundTag).toBeDefined();
        expect(foundTag?.key).toEqual(expectedTag.key);
        expect(foundTag?.value).toEqual(expectedTag.value);
      });

      // Cleanup
      await eventClient.removeEventHandler(handlerName);
    });

    test("Should put tags for an event handler", async () => {
      const eventClient = new EventClient(await orkesConductorClient());
      const handlerName = createUniqueName("event-handler");
      const eventName = createUniqueName("event");

      const eventHandler = createEventHandler(handlerName, eventName);

      await eventClient.addEventHandler(eventHandler);

      const tags: Tag[] = [
        { key: "test-key-1", value: "test-value-1" },
        { key: "test-key-2", value: "test-value-2" },
        { key: "category", value: "integration-test" },
      ];

      await expect(
        eventClient.putTagForEventHandler(handlerName, tags)
      ).resolves.not.toThrow();

      // Verify the tags were actually added
      const retrievedTags = await eventClient.getTagsForEventHandler(
        handlerName
      );

      expect(Array.isArray(retrievedTags)).toBe(true);
      expect(retrievedTags.length).toBeGreaterThanOrEqual(tags.length);

      // Verify each added tag is present with correct key and value
      tags.forEach((addedTag) => {
        const foundTag = retrievedTags.find(
          (tag) => tag.key === addedTag.key && tag.value === addedTag.value
        );
        expect(foundTag).toBeDefined();
        expect(foundTag?.key).toEqual(addedTag.key);
        expect(foundTag?.value).toEqual(addedTag.value);
      });

      // Cleanup
      await eventClient.removeEventHandler(handlerName);
    });

    test("Should delete tags for an event handler", async () => {
      const eventClient = new EventClient(await orkesConductorClient());
      const handlerName = createUniqueName("event-handler");
      const eventName = createUniqueName("event");

      const eventHandler = createEventHandler(handlerName, eventName);

      await eventClient.addEventHandler(eventHandler);

      const tags: Tag[] = [
        { key: "test-key-1", value: "test-value-1" },
        { key: "test-key-2", value: "test-value-2" },
      ];

      // First add all tags
      await eventClient.putTagForEventHandler(handlerName, tags);

      // Verify all tags are present before deletion
      const tagsBeforeDeletion = await eventClient.getTagsForEventHandler(
        handlerName
      );
      tags.forEach((tag) => {
        const foundTag = tagsBeforeDeletion.find(
          (t) => t.key === tag.key && t.value === tag.value
        );
        expect(foundTag).toBeDefined();
      });

      // Delete one specific tag
      const tagToDelete: Tag = tags[0];
      const remainingTag: Tag = tags[1];

      await expect(
        eventClient.deleteTagForEventHandler(handlerName, tagToDelete)
      ).resolves.not.toThrow();

      // Verify the deleted tag is no longer present
      const tagsAfterDeletion = await eventClient.getTagsForEventHandler(
        handlerName
      );
      const foundDeletedTag = tagsAfterDeletion.find(
        (tag) => tag.key === tagToDelete.key && tag.value === tagToDelete.value
      );
      expect(foundDeletedTag).toBeUndefined();

      // Verify the remaining tags are still present
      const foundRemainingTag = tagsAfterDeletion.find(
        (tag) =>
          tag.key === remainingTag.key && tag.value === remainingTag.value
      );
      expect(foundRemainingTag).toBeDefined();
      expect(foundRemainingTag?.key).toEqual(remainingTag.key);
      expect(foundRemainingTag?.value).toEqual(remainingTag.value);

      // Cleanup
      await eventClient.removeEventHandler(handlerName);
    });
  });

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

  describe("Test Endpoint", () => {
    test("Should call test endpoint", async () => {
      const eventClient = new EventClient(await orkesConductorClient());

      const result = await eventClient.test();
      expect(result).toBeDefined();
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

  describe("Error Handling", () => {
    test("Should throw error when getting non-existent event handler", async () => {
      const eventClient = new EventClient(await orkesConductorClient());
      const nonExistentName = createUniqueName("non-existent-handler");

      await expect(
        eventClient.getEventHandlerByName(nonExistentName)
      ).rejects.toThrow();
    });

    test("Should throw error when removing non-existent handler", async () => {
      const eventClient = new EventClient(await orkesConductorClient());
      const nonExistentName = createUniqueName("non-existent-handler");

      await expect(
        eventClient.removeEventHandler(nonExistentName)
      ).rejects.toThrow();
    });

    test("Should throw error when updating non-existent event handler", async () => {
      const eventClient = new EventClient(await orkesConductorClient());
      const nonExistentName = createUniqueName("non-existent-handler");
      const eventName = createUniqueName("event");

      const nonExistentHandler: EventHandler = {
        name: nonExistentName,
        event: eventName,
        active: true,
        actions: [],
        description: "Non-existent handler",
      };

      await expect(
        eventClient.updateEventHandler(nonExistentHandler)
      ).rejects.toThrow();
    });

    test("Should throw error when getting queue config for non-existent queue", async () => {
      const eventClient = new EventClient(await orkesConductorClient());
      const nonExistentQueueType = createUniqueName("non-existent-type");
      const nonExistentQueueName = createUniqueName("non-existent-queue");

      await expect(
        eventClient.getQueueConfig(nonExistentQueueType, nonExistentQueueName)
      ).rejects.toThrow();
    });

    test("Should throw error when adding event handler with invalid data", async () => {
      const eventClient = new EventClient(await orkesConductorClient());

      const invalidHandler = {
        name: "",
        event: "",
        active: true,
        actions: [],
      };

      await expect(
        eventClient.addEventHandler(invalidHandler)
      ).rejects.toThrow();
    });

    test("Should handle error when testing connectivity with invalid input", async () => {
      const eventClient = new EventClient(await orkesConductorClient());

      const invalidInput: ConnectivityTestInput = {
        sink: "",
        input: {},
      };

      await expect(
        eventClient.testConnectivity(invalidInput)
      ).rejects.toThrow();
    });

    test("Should handle error when handling incoming event with invalid data", async () => {
      const eventClient = new EventClient(await orkesConductorClient());

      const invalidEventData: Record<string, string> = {};

      await expect(
        eventClient.handleIncomingEvent(invalidEventData)
      ).rejects.toThrow();
    });
  });
});
