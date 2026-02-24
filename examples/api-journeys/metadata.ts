/**
 * Metadata API Journey — Full lifecycle of task and workflow definitions
 *
 * Demonstrates all MetadataClient APIs:
 *   - Task CRUD (register, get, update, unregister)
 *   - Workflow CRUD (register, get, unregister)
 *   - Tags (add, get, set, delete for both tasks and workflows)
 *   - Rate limits (set, get, remove)
 *   - Bulk operations (registerTasks, getAllTaskDefs, getAllWorkflowDefs)
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/api-journeys/metadata.ts
 */
import { OrkesClients, ConductorWorkflow, simpleTask } from "../../src/sdk";

async function main() {
  const clients = await OrkesClients.from();
  const metadata = clients.getMetadataClient();
  const workflowClient = clients.getWorkflowClient();

  const taskName = "meta_journey_task";
  const wfName = "meta_journey_workflow";

  try {
    // ── 1. Task Definition Management ───────────────────────────────
    console.log("=== Task Definition Management ===\n");

    // Register a task
    await metadata.registerTask({
      name: taskName,
      description: "Example task for metadata journey",
      retryCount: 3,
      retryLogic: "FIXED",
      retryDelaySeconds: 10,
      timeoutSeconds: 120,
      responseTimeoutSeconds: 60,
    });
    console.log("1. Registered task:", taskName);

    // Get task
    const taskDef = await metadata.getTask(taskName);
    console.log("2. Task definition:", JSON.stringify(taskDef, null, 2));

    // Update task
    await metadata.updateTask({
      ...taskDef,
      description: "Updated description",
      retryCount: 5,
    });
    console.log("3. Updated task (retryCount: 5)");

    // Batch register tasks
    await metadata.registerTasks([
      { name: `${taskName}_batch_1`, retryCount: 1, timeoutSeconds: 30 },
      { name: `${taskName}_batch_2`, retryCount: 1, timeoutSeconds: 30 },
    ]);
    console.log("4. Batch registered 2 tasks");

    // Get all task definitions
    const allTasks = await metadata.getAllTaskDefs();
    console.log("5. Total task definitions:", allTasks.length);

    // ── 2. Workflow Definition Management ────────────────────────────
    console.log("\n=== Workflow Definition Management ===\n");

    // Register workflow using builder
    const wf = new ConductorWorkflow(workflowClient, wfName)
      .description("Example workflow for metadata journey")
      .add(simpleTask("step_ref", taskName, { key: "value" }))
      .outputParameters({ result: "${step_ref.output}" });

    await wf.register(true);
    console.log("6. Registered workflow:", wfName);

    // Get workflow definition via metadata client
    const wfDef = await metadata.getWorkflowDef(wfName);
    console.log("7. Workflow definition:", JSON.stringify({
      name: wfDef.name,
      version: wfDef.version,
      tasks: wfDef.tasks?.length,
    }));

    // Get all workflow definitions
    const allWorkflows = await metadata.getAllWorkflowDefs();
    console.log("8. Total workflow definitions:", allWorkflows.length);

    // ── 3. Tag Management ───────────────────────────────────────────
    console.log("\n=== Tag Management ===\n");

    // Task tags
    await metadata.addTaskTag({ key: "team", value: "platform" }, taskName);
    console.log("9. Added tag to task");

    const taskTags = await metadata.getTaskTags(taskName);
    console.log("10. Task tags:", JSON.stringify(taskTags));

    await metadata.setTaskTags(
      [
        { key: "team", value: "platform" },
        { key: "env", value: "staging" },
      ],
      taskName
    );
    console.log("11. Set task tags (replaced all)");

    await metadata.deleteTaskTag({ key: "env", value: "staging" }, taskName);
    console.log("12. Deleted task tag");

    // Workflow tags
    await metadata.addWorkflowTag({ key: "team", value: "platform" }, wfName);
    console.log("13. Added tag to workflow");

    const wfTags = await metadata.getWorkflowTags(wfName);
    console.log("14. Workflow tags:", JSON.stringify(wfTags));

    await metadata.setWorkflowTags(
      [
        { key: "team", value: "platform" },
        { key: "priority", value: "high" },
      ],
      wfName
    );
    console.log("15. Set workflow tags");

    await metadata.deleteWorkflowTag(
      { key: "priority", value: "high" },
      wfName
    );
    console.log("16. Deleted workflow tag");

    // ── 4. Rate Limit Management ────────────────────────────────────
    console.log("\n=== Rate Limit Management ===\n");

    await metadata.setWorkflowRateLimit(
      { rateLimitPerFrequency: 10, rateLimitFrequencyInSeconds: 60 },
      wfName
    );
    console.log("17. Set workflow rate limit (10 per 60s)");

    const rateLimit = await metadata.getWorkflowRateLimit(wfName);
    console.log("18. Rate limit:", JSON.stringify(rateLimit));

    await metadata.removeWorkflowRateLimit(wfName);
    console.log("19. Removed workflow rate limit");

    // ── 5. Cleanup ──────────────────────────────────────────────────
    console.log("\n=== Cleanup ===\n");

    await metadata.unregisterWorkflow(wfName);
    console.log("20. Unregistered workflow");

    await metadata.unregisterTask(taskName);
    await metadata.unregisterTask(`${taskName}_batch_1`);
    await metadata.unregisterTask(`${taskName}_batch_2`);
    console.log("21. Unregistered all tasks");
  } catch (err) {
    console.error("Error:", err);

    // Best-effort cleanup
    try { await metadata.unregisterWorkflow(wfName); } catch { /* ignore */ }
    try { await metadata.unregisterTask(taskName); } catch { /* ignore */ }
    try { await metadata.unregisterTask(`${taskName}_batch_1`); } catch { /* ignore */ }
    try { await metadata.unregisterTask(`${taskName}_batch_2`); } catch { /* ignore */ }
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
