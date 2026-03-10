/**
 * Event Handlers API Journey — Full lifecycle of event handlers and queue management
 *
 * Demonstrates all EventClient APIs:
 *   - Event handler CRUD (add, get, update, list, delete)
 *   - Event handler filtering (by event, active only)
 *   - Tag management (add, get, delete)
 *   - Queue configuration (list queue names)
 *   - Event execution views
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/api-journeys/event-handlers.ts
 */
import { OrkesClients } from "../../src/sdk";
import type { EventHandler } from "../../src/open-api";

async function main() {
  const clients = await OrkesClients.from();
  const eventClient = clients.getEventClient();

  const handlerName = `example_handler_${Date.now()}`;
  const eventName = "conductor:example_event";

  try {
    // ── 1. Event Handler CRUD ─────────────────────────────────────────
    console.log("=== Event Handler CRUD ===\n");

    // Create an event handler that starts a workflow on event
    const handler: EventHandler = {
      name: handlerName,
      event: eventName,
      active: true,
      actions: [
        {
          action: "start_workflow",
          start_workflow: {
            name: "example_event_workflow",
            version: 1,
          },
        },
      ],
    };

    await eventClient.addEventHandler(handler);
    console.log(`1. Created event handler: ${handlerName}`);

    // Get event handler by name
    const fetched = await eventClient.getEventHandlerByName(handlerName);
    console.log(`2. Fetched handler: ${fetched.name}, active: ${fetched.active}`);

    // Update event handler (deactivate)
    await eventClient.updateEventHandler({
      ...fetched,
      active: false,
    });
    console.log("3. Updated handler (deactivated)");

    // Verify update
    const updated = await eventClient.getEventHandlerByName(handlerName);
    console.log(`4. Handler active: ${updated.active}`);

    // Re-activate
    await eventClient.updateEventHandler({
      ...updated,
      active: true,
    });
    console.log("5. Re-activated handler");

    // ── 2. Event Handler Queries ──────────────────────────────────────
    console.log("\n=== Event Handler Queries ===\n");

    // List all event handlers
    const allHandlers = await eventClient.getAllEventHandlers();
    console.log(`6. Total event handlers: ${allHandlers.length}`);

    // Get handlers for a specific event
    const handlersForEvent = await eventClient.getEventHandlersForEvent(
      eventName
    );
    console.log(
      `7. Handlers for '${eventName}': ${handlersForEvent.length}`
    );

    // Get only active handlers for the event
    const activeHandlers = await eventClient.getEventHandlersForEvent(
      eventName,
      true
    );
    console.log(`8. Active handlers for event: ${activeHandlers.length}`);

    // ── 3. Tag Management ─────────────────────────────────────────────
    console.log("\n=== Tag Management ===\n");

    // Add tags
    await eventClient.putTagForEventHandler(handlerName, [
      { key: "environment", value: "production" },
      { key: "team", value: "platform" },
    ]);
    console.log("9. Added tags to handler");

    // Get tags
    const tags = await eventClient.getTagsForEventHandler(handlerName);
    console.log(`10. Tags: ${JSON.stringify(tags)}`);

    // Delete a single tag
    await eventClient.deleteTagForEventHandler(handlerName, {
      key: "team",
      value: "platform",
    });
    console.log("11. Deleted 'team' tag");

    // Verify
    const remainingTags = await eventClient.getTagsForEventHandler(handlerName);
    console.log(`12. Remaining tags: ${JSON.stringify(remainingTags)}`);

    // Delete remaining tags
    await eventClient.deleteTagsForEventHandler(handlerName, remainingTags);
    console.log("13. Deleted remaining tags");

    // ── 4. Queue Configuration ────────────────────────────────────────
    console.log("\n=== Queue Configuration ===\n");

    // List all queue names/configs
    const queueConfigs = await eventClient.getAllQueueConfigs();
    const queueCount = Object.keys(queueConfigs).length;
    console.log(`14. Queue configs available: ${queueCount}`);
    if (queueCount > 0) {
      const firstKey = Object.keys(queueConfigs)[0];
      console.log(`    First queue: ${firstKey}`);
    }

    // ── 5. Event Execution Views ──────────────────────────────────────
    console.log("\n=== Event Execution Views ===\n");

    // Get all active event handlers (execution view)
    try {
      const activeView = await eventClient.getAllActiveEventHandlers();
      console.log(
        `15. Active handlers (execution view): ${activeView?.results?.length ?? 0} results`
      );
    } catch {
      console.log("15. Active handlers view: not available on this server");
    }

    // Get event handlers with statistics
    try {
      const stats = await eventClient.getEventHandlersWithStats();
      console.log(
        `16. Handlers with stats: ${stats?.results?.length ?? 0} results`
      );
    } catch {
      console.log("16. Handler stats: not available on this server");
    }

    // ── 6. Cleanup ──────────────────────────────────────────────────
    console.log("\n=== Cleanup ===\n");

    await eventClient.removeEventHandler(handlerName);
    console.log(`17. Deleted event handler: ${handlerName}`);
  } catch (err) {
    console.error("Error:", err);

    // Best-effort cleanup
    try {
      await eventClient.removeEventHandler(handlerName);
    } catch {
      /* ignore */
    }
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
