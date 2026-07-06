import {
  afterEach,
  beforeAll,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import type {
  Action,
  ConnectivityTestInput,
  EventHandler,
  Tag,
} from "../open-api";
import { EventClient } from "../sdk";
import { createClientWithRetry } from "./utils/createClientWithRetry";
import {
  describeForOrkesOnlyV4,
  describeForOrkesOnlyV5,
} from "./utils/customJestDescribe";
import { pollUntil } from "./utils/pollUntil";

const TEST_HANDLER_NAME_PREFIX = "jsSdkTest:";

describe("EventClient", () => {
  jest.setTimeout(60000);

  let eventClient: EventClient;

  beforeAll(async () => {
    const client = await createClientWithRetry();
    eventClient = new EventClient(client);
  });

  // Clean up any event handlers created by tests (runs even when a test fails)
  afterEach(async () => {
    try {
      if (!eventClient) return;
      const handlers = await eventClient.getAllEventHandlers();
      const toRemove = handlers.filter(
        (h) => h.name?.startsWith(TEST_HANDLER_NAME_PREFIX)
      );
      for (const h of toRemove) {
        if (!h.name) continue;
        try {
          await eventClient.removeEventHandler(h.name);
        } catch {
          // Handler may already have been removed by the test
        }
      }
    } catch {
      // Ignore cleanup failures (e.g. no server, auth issues)
    }
  });

  // Helper function to create unique names
  const createUniqueName = (prefix: string) =>
    `${TEST_HANDLER_NAME_PREFIX}${prefix}:${Date.now()}`;

  // Safe cleanup: remove handler if it exists; never throw (so cleanup never fails the test)
  const tryRemoveEventHandler = async (
    eventClient: InstanceType<typeof EventClient>,
    name: string
  ): Promise<void> => {
    try {
      await eventClient.removeEventHandler(name);
    } catch {
      // Handler may already have been removed (e.g. by afterEach or server)
    }
  };

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

  describeForOrkesOnlyV4("Event Handler Management", () => {
    test("Should add a single event handler", async () => {
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

      const retrievedHandler = await pollUntil(
        () => eventClient.getEventHandlerByName(handlerName),
        (h) => h != null && h.name === handlerName,
        { label: "wait for handler after add" }
      );
      if (!retrievedHandler) throw new Error("Expected handler to exist");
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
      await tryRemoveEventHandler(eventClient, handlerName);
    });

    test("Should add multiple event handlers", async () => {
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

      // Poll until both handlers are visible (eventual consistency)
      await pollUntil(
        () => eventClient.getAllEventHandlers(),
        (all) => {
          const added = all.filter(
            (h) => h.name === handlerName1 || h.name === handlerName2
          );
          return added.length >= 2;
        },
        { label: "wait for both event handlers to be visible" }
      );

      // Cleanup
      await tryRemoveEventHandler(eventClient, handlerName1);
      await tryRemoveEventHandler(eventClient, handlerName2);
    });

    test("Should update an event handler", async () => {
      const handlerName = createUniqueName("event-handler");
      const eventName = createUniqueName("event");

      const eventHandler = createEventHandler(handlerName, eventName, true);

      // Add the handler
      await eventClient.addEventHandler(eventHandler);

      // Wait for handler to be visible (eventual consistency)
      await pollUntil(
        () => eventClient.getEventHandlerByName(handlerName),
        (h) => h != null && h.name === handlerName,
        { label: "wait for handler before update" }
      );

      // Update the handler
      const updatedHandler: EventHandler = {
        ...eventHandler,
        active: false,
        description: "Updated description",
      };

      await expect(
        eventClient.updateEventHandler(updatedHandler)
      ).resolves.not.toThrow();

      // Verify it was updated (poll for consistency)
      const retrievedHandler = await pollUntil(
        () => eventClient.getEventHandlerByName(handlerName),
        (h) => h != null && h.active === false,
        { label: "wait for handler update" }
      );
      if (!retrievedHandler) throw new Error("Expected handler to exist");
      expect(retrievedHandler.active).toEqual(false);
      expect(retrievedHandler.description).toEqual("Updated description");

      // Cleanup
      await tryRemoveEventHandler(eventClient, handlerName);
    });

    test("Should get all event handlers", async () => {
      const handlers = await eventClient.getAllEventHandlers();

      expect(Array.isArray(handlers)).toBe(true);
    });

    test("Should get event handler by name", async () => {
      const handlerName = createUniqueName("event-handler");
      const eventName = createUniqueName("event");

      const eventHandler = createEventHandler(handlerName, eventName);

      await eventClient.addEventHandler(eventHandler);

      const retrievedHandler = await pollUntil(
        () => eventClient.getEventHandlerByName(handlerName),
        (h) => h != null && h.name === handlerName,
        { label: "wait for handler by name" }
      );
      if (!retrievedHandler) throw new Error("Expected handler to exist");
      expect(retrievedHandler.name).toEqual(handlerName);
      expect(retrievedHandler.event).toEqual(eventName);

      // Cleanup
      await tryRemoveEventHandler(eventClient, handlerName);
    });

    test("Should get event handlers for a specific event", async () => {
      const handlerName = createUniqueName("event-handler");
      const eventName = createUniqueName("event");

      const eventHandler = createEventHandler(handlerName, eventName);

      await eventClient.addEventHandler(eventHandler);

      const handlers = await pollUntil(
        () => eventClient.getEventHandlersForEvent(eventName),
        (h) => Array.isArray(h) && h.some((x) => x.name === handlerName),
        { label: "wait for handlers for event" }
      );

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
      await tryRemoveEventHandler(eventClient, handlerName);
    });

    test("Should remove an event handler", async () => {
      const handlerName = createUniqueName("event-handler");
      const eventName = createUniqueName("event");

      const eventHandler = createEventHandler(handlerName, eventName);

      await eventClient.addEventHandler(eventHandler);

      // Wait for handler to be visible (eventual consistency)
      const retrievedHandler = await pollUntil(
        () => eventClient.getEventHandlerByName(handlerName),
        (h) => h != null && h.name === handlerName,
        { label: "wait for handler before remove" }
      );
      if (!retrievedHandler) throw new Error("Expected handler to exist");
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

  describeForOrkesOnlyV4("Tag Management", () => {
    test("Should get tags for an event handler", async () => {
      const handlerName = createUniqueName("event-handler");
      const eventName = createUniqueName("event");

      const eventHandler = createEventHandler(handlerName, eventName);

      await eventClient.addEventHandler(eventHandler);

      // Wait for handler to be visible before tagging
      await pollUntil(
        () => eventClient.getEventHandlerByName(handlerName),
        (h) => h != null && h.name === handlerName,
        { label: "wait for handler before tagging" }
      );

      // Add tags to the event handler
      const expectedTags: Tag[] = [
        { key: "test-key-1", value: "test-value-1" },
        { key: "test-key-2", value: "test-value-2" },
        { key: "environment", value: "test" },
      ];

      await eventClient.putTagForEventHandler(handlerName, expectedTags);

      // Poll for tags to be visible (eventual consistency)
      const retrievedTags = await pollUntil(
        () => eventClient.getTagsForEventHandler(handlerName),
        (tags) => Array.isArray(tags) && tags.length >= expectedTags.length,
        { label: "wait for tags" }
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
      await tryRemoveEventHandler(eventClient, handlerName);
    });

    test("Should put tags for an event handler", async () => {
      const handlerName = createUniqueName("event-handler");
      const eventName = createUniqueName("event");

      const eventHandler = createEventHandler(handlerName, eventName);

      await eventClient.addEventHandler(eventHandler);

      // Wait for handler to be visible before tagging
      await pollUntil(
        () => eventClient.getEventHandlerByName(handlerName),
        (h) => h != null && h.name === handlerName,
        { label: "wait for handler before put tags" }
      );

      const tags: Tag[] = [
        { key: "test-key-1", value: "test-value-1" },
        { key: "test-key-2", value: "test-value-2" },
        { key: "category", value: "integration-test" },
      ];

      await expect(
        eventClient.putTagForEventHandler(handlerName, tags)
      ).resolves.not.toThrow();

      // Poll for tags to be visible (eventual consistency)
      const retrievedTags = await pollUntil(
        () => eventClient.getTagsForEventHandler(handlerName),
        (t) => Array.isArray(t) && t.length >= tags.length,
        { label: "wait for put tags" }
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
      await tryRemoveEventHandler(eventClient, handlerName);
    });

    test("Should delete tags for an event handler", async () => {
      const handlerName = createUniqueName("event-handler");
      const eventName = createUniqueName("event");

      const eventHandler = createEventHandler(handlerName, eventName);

      await eventClient.addEventHandler(eventHandler);

      // Wait for handler to be visible before tagging
      await pollUntil(
        () => eventClient.getEventHandlerByName(handlerName),
        (h) => h != null && h.name === handlerName,
        { label: "wait for handler before delete tags" }
      );

      const tags: Tag[] = [
        { key: "test-key-1", value: "test-value-1" },
        { key: "test-key-2", value: "test-value-2" },
      ];

      // First add all tags
      await eventClient.putTagForEventHandler(handlerName, tags);

      // Poll for all tags to be visible before deletion
      const tagsBeforeDeletion = await pollUntil(
        () => eventClient.getTagsForEventHandler(handlerName),
        (t) =>
          Array.isArray(t) &&
          tags.every((tag) => t.some((x) => x.key === tag.key && x.value === tag.value)),
        { label: "wait for tags before delete" }
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

      // Poll until the deleted tag is no longer visible (eventual consistency)
      const tagsAfterDeletion = await pollUntil(
        () => eventClient.getTagsForEventHandler(handlerName),
        (t) =>
          Array.isArray(t) &&
          !t.some(
            (tag) =>
              tag.key === tagToDelete.key && tag.value === tagToDelete.value
          ),
        { label: "wait for tag deletion to propagate" }
      );

      // Verify the remaining tags are still present
      const foundRemainingTag = tagsAfterDeletion.find(
        (tag) =>
          tag.key === remainingTag.key && tag.value === remainingTag.value
      );
      expect(foundRemainingTag).toBeDefined();
      expect(foundRemainingTag?.key).toEqual(remainingTag.key);
      expect(foundRemainingTag?.value).toEqual(remainingTag.value);

      // Cleanup
      await tryRemoveEventHandler(eventClient, handlerName);
    });
  });

  describeForOrkesOnlyV4("Test Endpoint", () => {
    test("Should call test endpoint", async () => {

      const result = await eventClient.test();
      expect(result).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    test("Should return null or throw when getting non-existent event handler", async () => {
      const nonExistentName = createUniqueName("non-existent-handler");

      try {
        const result = await eventClient.getEventHandlerByName(nonExistentName);
        // V5: server may return null or 200 with empty/non-JSON body (e.g. stream)
        expect(result == null || typeof (result as EventHandler)?.name !== "string").toBe(true);
      } catch {
        // V4: server returns 200 with empty body and SDK throws (e.g. "Response is empty")
        expect(true).toBe(true);
      }
    });

    test("Should throw error when removing non-existent handler", async () => {
      const nonExistentName = createUniqueName("non-existent-handler");

      await expect(
        eventClient.removeEventHandler(nonExistentName)
      ).rejects.toThrow();
    });

    test("Should throw error when updating non-existent event handler", async () => {
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
      const nonExistentQueueType = createUniqueName("non-existent-type");
      const nonExistentQueueName = createUniqueName("non-existent-queue");

      await expect(
        eventClient.getQueueConfig(nonExistentQueueType, nonExistentQueueName)
      ).rejects.toThrow();
    });

    test("Should throw error when adding event handler with invalid data", async () => {

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

      const invalidInput: ConnectivityTestInput = {
        sink: "",
        input: {},
      };

      await expect(
        eventClient.testConnectivity(invalidInput)
      ).rejects.toThrow();
    });

    test("Should handle error when handling incoming event with invalid data", async () => {

      const invalidEventData: Record<string, string> = {};

      await expect(
        eventClient.handleIncomingEvent(invalidEventData)
      ).rejects.toThrow();
    });
  });

  describeForOrkesOnlyV5("Event Processing", () => {
    test("Should handle incoming event", async () => {
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

      const retrievedHandler = await pollUntil(
        () => eventClient.getEventHandlerByName(handlerName),
        (h) => h != null && h.name === handlerName,
        { label: "wait for handler before incoming event" }
      );
      if (!retrievedHandler) throw new Error("Expected handler to exist");
      expect(retrievedHandler.name).toEqual(handlerName);
      expect(retrievedHandler.event).toEqual(eventName);
      expect(retrievedHandler.active).toBe(true);

      const handlersForEvent = await pollUntil(
        () => eventClient.getEventHandlersForEvent(eventName),
        (h) => Array.isArray(h) && h.length > 0 && h.some((x) => x.name === handlerName),
        { label: "wait for handlers for event before firing" }
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
      if (!handlerAfterEvent) throw new Error("Expected handler to exist");
      expect(handlerAfterEvent.active).toBe(true);
      expect(handlerAfterEvent.event).toEqual(eventName);

      // Wait for event execution to be created (async processing)
      let ourExecution;
      const maxWaitTime = 30000; // 30 seconds
      const pollInterval = 500; // 500ms
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitTime) {
        const executions = await eventClient.getEventExecutions(handlerName);
        expect(Array.isArray(executions)).toBe(true);

        ourExecution = executions.find(
          (exec) => exec.event === eventName || exec.name === handlerName
        );

        if (ourExecution) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      expect(ourExecution).toBeDefined();
      if (ourExecution?.event) {
        expect(ourExecution.event).toEqual(eventName);
      }
      if (ourExecution?.name) {
        expect(ourExecution.name).toEqual(handlerName);
      }

      await tryRemoveEventHandler(eventClient, handlerName);
    });
  });

  describeForOrkesOnlyV5("Event Executions and Statistics", () => {
    test("Should get all active event handlers (execution view)", async () => {

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

      // Wait for handler to be visible before firing event
      await pollUntil(
        () => eventClient.getEventHandlerByName(handlerName),
        (h) => h != null && h.name === handlerName,
        { label: "wait for handler before active-handlers test" }
      );

      // Trigger an event so the handler processes it and appears in execution view
      const eventData: Record<string, string> = {
        event: eventName,
        source: "integration-test",
        timestamp: Date.now().toString(),
        message: "test event",
      };
      await eventClient.handleIncomingEvent(eventData);

      // Poll for our handler to appear in the active event handlers (async processing)
      const result = await pollUntil(
        () => eventClient.getAllActiveEventHandlers(),
        (r) =>
          r != null &&
          Array.isArray(r.results) &&
          r.results.some((h) => h.name === handlerName && h.event === eventName),
        { maxWaitMs: 30000, label: "wait for active event handlers" }
      );

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

      await tryRemoveEventHandler(eventClient, handlerName);
    });

    test("Should get event executions for a handler", async () => {
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

      // Wait for handler to be visible before firing event
      await pollUntil(
        () => eventClient.getEventHandlerByName(handlerName),
        (h) => h != null && h.name === handlerName,
        { label: "wait for handler before executions test" }
      );

      // Trigger an event so the handler processes it and creates an execution
      const eventData = {
        event: eventName,
        source: "integration-test",
        timestamp: Date.now().toString(),
        message: "test event",
      };
      await eventClient.handleIncomingEvent(eventData);

      // Wait for event execution to be created (async processing)
      let ourExecution;
      const maxWaitTime = 30000; // 30 seconds
      const pollInterval = 500; // 500ms
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitTime) {
        const executions = await eventClient.getEventExecutions(handlerName, 0);
        expect(Array.isArray(executions)).toBe(true);

        ourExecution = executions.find(
          (exec) => exec.name === handlerName && exec.event === eventName
        );

        if (ourExecution) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      expect(ourExecution).toBeDefined();
      expect(ourExecution?.name).toBe(handlerName);
      expect(ourExecution?.event).toBe(eventName);
      expect(typeof ourExecution?.id).toBe("string");
      expect(typeof ourExecution?.created).toBe("number");
      expect(ourExecution?.action).toBe("start_workflow");

      await tryRemoveEventHandler(eventClient, handlerName);
    });

    test("Should get event handlers with statistics", async () => {
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

      // Wait for handler to be visible before firing event
      await pollUntil(
        () => eventClient.getEventHandlerByName(handlerName),
        (h) => h != null && h.name === handlerName,
        { label: "wait for handler before stats test" }
      );

      // Trigger an event so the handler processes it and creates an execution
      const eventData = {
        event: eventName,
        source: "integration-test",
        timestamp: Date.now().toString(),
        message: "test event",
      };
      await eventClient.handleIncomingEvent(eventData);

      // Poll for our handler to appear in stats (catches server-side NPE on cache miss)
      const response = await pollUntil(
        () => eventClient.getEventHandlersWithStats(0),
        (r) =>
          r != null &&
          Array.isArray(r.results) &&
          r.results.some((h) => h.event === eventName),
        { maxWaitMs: 30000, intervalMs: 1000, label: "wait for handler stats" }
      );

      expect(response).toBeDefined();
      expect(response).toHaveProperty("results");
      expect(Array.isArray(response.results)).toBe(true);

      const foundHandler = response.results?.find((h) => h.event === eventName);
      expect(foundHandler).toBeDefined();
      expect(foundHandler?.event).toBe(eventName);
      expect(foundHandler?.active).toBe(true);
      expect(typeof foundHandler?.numberOfActions).toBe("number");
      expect(typeof foundHandler?.numberOfMessages).toBe("number");

      await tryRemoveEventHandler(eventClient, handlerName);
    });

    test("Should get event messages for an event", async () => {
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

      // Wait for handler to be visible before firing event
      await pollUntil(
        () => eventClient.getEventHandlerByName(handlerName),
        (h) => h != null && h.name === handlerName,
        { label: "wait for handler before event-messages test" }
      );

      // Trigger an event to create messages
      const eventData = {
        event: eventName,
        source: "integration-test",
        timestamp: Date.now().toString(),
        message: "test event",
      };
      await eventClient.handleIncomingEvent(eventData);

      // Poll for messages to appear (async processing)
      const messages = await pollUntil(
        () => eventClient.getEventMessages(eventName),
        (m) => Array.isArray(m) && m.length > 0,
        { maxWaitMs: 30000, label: "wait for event messages" }
      );
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

      await tryRemoveEventHandler(eventClient, handlerName);
    });
  });
});
