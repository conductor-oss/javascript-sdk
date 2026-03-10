/**
 * Schedules API Journey — Full lifecycle of workflow schedule management
 *
 * Demonstrates all SchedulerClient APIs:
 *   - Save, get, pause, resume, delete schedules
 *   - Search schedule executions
 *   - Get next execution times
 *   - Tag management for schedules
 *   - List all schedules
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/api-journeys/schedules.ts
 */
import {
  OrkesClients,
  ConductorWorkflow,
  simpleTask,
} from "../../src/sdk";

async function main() {
  const clients = await OrkesClients.from();
  const scheduler = clients.getSchedulerClient();
  const workflowClient = clients.getWorkflowClient();
  const scheduleName = "journey_example_schedule";
  const wfName = "schedule_journey_workflow";

  try {
    // Register a workflow for the schedule
    const wf = new ConductorWorkflow(workflowClient, wfName)
      .description("Workflow used by schedule journey")
      .add(simpleTask("step_ref", "schedule_demo_task", {}))
      .outputParameters({ result: "${step_ref.output}" });
    await wf.register(true);
    console.log("Registered workflow:", wfName);

    // ── 1. Get next execution times ─────────────────────────────────
    const nextTimes = await scheduler.getNextFewSchedules("0 */5 * * * ?", undefined, undefined, 5);
    console.log(
      "1. Next 5 execution times for '0 */5 * * * ?':",
      nextTimes.map((t) => new Date(t).toISOString())
    );

    // ── 2. Save a schedule ──────────────────────────────────────────
    await scheduler.saveSchedule({
      name: scheduleName,
      cronExpression: "0 */10 * * * ?", // Every 10 minutes
      startWorkflowRequest: {
        name: wfName,
        version: 1,
      },
      paused: true, // Start paused so it doesn't trigger immediately
    });
    console.log("2. Saved schedule:", scheduleName);

    // ── 3. Get schedule ─────────────────────────────────────────────
    const schedule = await scheduler.getSchedule(scheduleName);
    console.log("3. Schedule details:", JSON.stringify({
      name: schedule.name,
      cronExpression: schedule.cronExpression,
      paused: schedule.paused,
    }));

    // ── 4. Resume schedule ──────────────────────────────────────────
    await scheduler.resumeSchedule(scheduleName);
    console.log("4. Resumed schedule");

    // ── 5. Pause schedule ───────────────────────────────────────────
    await scheduler.pauseSchedule(scheduleName);
    console.log("5. Paused schedule");

    // ── 6. List all schedules ───────────────────────────────────────
    const allSchedules = await scheduler.getAllSchedules();
    console.log("6. Total schedules:", allSchedules.length);

    // ── 7. List schedules for workflow ───────────────────────────────
    const wfSchedules = await scheduler.getAllSchedules(wfName);
    console.log("7. Schedules for workflow:", wfSchedules.length);

    // ── 8. Search schedule executions ───────────────────────────────
    const searchResult = await scheduler.search(0, 10);
    console.log("8. Schedule executions found:", searchResult.totalHits ?? 0);

    // ── 9. Tag management ───────────────────────────────────────────
    await scheduler.setSchedulerTags(
      [
        { key: "env", value: "staging" },
        { key: "team", value: "platform" },
      ],
      scheduleName
    );
    console.log("9. Set schedule tags");

    const tags = await scheduler.getSchedulerTags(scheduleName);
    console.log("10. Schedule tags:", JSON.stringify(tags));

    await scheduler.deleteSchedulerTags(
      [{ key: "env", value: "staging" }],
      scheduleName
    );
    console.log("11. Deleted schedule tag");

    // ── 10. Cleanup ─────────────────────────────────────────────────
    await scheduler.deleteSchedule(scheduleName);
    console.log("12. Deleted schedule");

    const metadataClient = clients.getMetadataClient();
    await metadataClient.unregisterWorkflow(wfName);
    console.log("13. Cleaned up workflow definition");
  } catch (err) {
    console.error("Error:", err);

    // Best-effort cleanup
    try { await scheduler.deleteSchedule(scheduleName); } catch { /* ignore */ }
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
