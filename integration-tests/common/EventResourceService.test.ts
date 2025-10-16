import { expect, describe, test } from "@jest/globals";
import { orkesConductorClient } from "../../src/orkes";
import { EventResource } from "../../src/common/open-api/sdk.gen";

describe("EventResourceService", () => {
  test("Should create an event handler with description and tags and then delete it", async () => {
    const client = await orkesConductorClient();
    const eventApi = EventResource;

    const now = Date.now();
    const [eventName, event, eventDescription, eventTagKey, eventTagValue] = [
      `jsSdkTest-EventName-${now}`,
      `jsSdkTest:eventHandler:1${now}`,
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

    await eventApi.addEventHandler({ body: [eventHandler], client });
    const { data: eventHandlers } = await eventApi.getEventHandlersForEvent({
      path: { event },
      client,
    });
    if (!eventHandlers) {
      throw new Error("Event handlers not found");
    }

    expect(eventHandlers.length).toEqual(1);
    expect(eventHandlers[0].description).toEqual(eventDescription);
    expect(eventHandlers[0].tags).toEqual([
      { key: eventTagKey, value: eventTagValue },
    ]);

    await eventApi.removeEventHandlerStatus({
      path: { name: eventName },
      client,
    });
    const { data: eventHandlersAfterRemove } =
      await eventApi.getEventHandlersForEvent({ path: { event }, client });
    if (!eventHandlersAfterRemove) {
      throw new Error("Event handlers not found");
    }

    expect(eventHandlersAfterRemove.length).toEqual(0);
  });
});
