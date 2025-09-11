import { expect, describe, test } from "@jest/globals";
import { orkesConductorClient } from "../../../orkes";

describe("EventResourceService", () => {
  test("Should create an event handler with description and tags and then delete it", async () => {
    const orkesClient = await orkesConductorClient({ useEnvVars: true });
    const eventApi = orkesClient.eventResource;

    const eventName = "jsSdkTest:eventHandler:1";
    const eventHandler = {
      name: eventName,
      event: "jsSdkTest:eventHandler:1",
      active: true,
      actions: [],
      description: "jsSdkTestdescription",
      tags: [{ key: "jsSdkTestTagkey", value: "jsSdkTestTagvalue" }],
    };

    await eventApi.addEventHandler(eventHandler);
    const eventHandlers = await eventApi.getEventHandlersForEvent(eventName);

    expect(eventHandlers.length).toEqual(1);
    expect(eventHandlers[0].description).toEqual("jsSdkTestdescription");
    expect(eventHandlers[0].tags).toEqual([
      { key: "jsSdkTestTagkey", value: "jsSdkTestTagvalue" },
    ]);

    await eventApi.removeEventHandlerStatus(eventName);
    const eventHandlersAfterRemove = await eventApi.getEventHandlersForEvent(
      eventName
    );

    expect(eventHandlersAfterRemove.length).toEqual(0);
  });
});
