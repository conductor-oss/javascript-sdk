import { expect, describe, test } from "@jest/globals";
import { orkesConductorClient } from "../../../orkes";

describe("EventResourceService", () => {
  test("Should create an event handler with description and tags and then delete it", async () => {
    const orkesClient = await orkesConductorClient();
    const eventApi = orkesClient.eventResource;

    const [eventName, event, eventDescription, eventTagKey, eventTagValue] = [
      "jsSdkTestEventName",
      "jsSdkTest:eventHandler:1",
      "jsSdkTestDescription",
      "jsSdkTestTagKey",
      "jsSdkTestTagValue",
    ];

    const eventHandler = {
      name: eventName,
      event: event,
      active: true,
      actions: [],
      description: eventDescription,
      tags: [{ key: eventTagKey, value: eventTagValue }],
    };

    await eventApi.addEventHandler(eventHandler);
    const eventHandlers = await eventApi.getEventHandlersForEvent(event);

    expect(eventHandlers.length).toEqual(1);
    expect(eventHandlers[0].description).toEqual(eventDescription);
    expect(eventHandlers[0].tags).toEqual([
      { key: eventTagKey, value: eventTagValue },
    ]);

    await eventApi.removeEventHandlerStatus(eventName);
    const eventHandlersAfterRemove = await eventApi.getEventHandlersForEvent(
      event
    );

    expect(eventHandlersAfterRemove.length).toEqual(0);
  });
});
