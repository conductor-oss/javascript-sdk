/**
 * Task Context — Access execution context from within a worker
 *
 * Demonstrates TaskContext for logging, callbacks, and introspection:
 *   - getTaskContext() to access the current task's context
 *   - addLog() to append execution logs visible in Conductor UI
 *   - setCallbackAfter() for long-running tasks (IN_PROGRESS pattern)
 *   - getInput(), setOutput() for data access
 *   - getRetryCount(), getPollCount() for introspection
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080 npx ts-node examples/task-context.ts
 */
import {
  OrkesClients,
  ConductorWorkflow,
  TaskHandler,
  worker,
  simpleTask,
  getTaskContext,
} from "../src/sdk";
import type { Task } from "../src/open-api";

// ── Worker with context usage ───────────────────────────────────────
const loggingWorker = worker({ taskDefName: "ctx_logging_worker", registerTaskDef: true })(
  async (task: Task) => {
    const ctx = getTaskContext();

    // Log execution metadata
    ctx?.addLog(`Task started — taskId=${ctx.getTaskId()}`);
    ctx?.addLog(`Workflow: ${ctx.getWorkflowInstanceId()}`);
    ctx?.addLog(`Retry count: ${ctx.getRetryCount()}`);
    ctx?.addLog(`Poll count: ${ctx.getPollCount()}`);
    ctx?.addLog(`Task def: ${ctx.getTaskDefName()}`);

    // Access input through context
    const input = ctx?.getInput() ?? task.inputData ?? {};
    ctx?.addLog(`Input keys: ${Object.keys(input).join(", ")}`);

    // Set output through context
    ctx?.setOutput({
      processed: true,
      taskId: ctx.getTaskId(),
      message: input.message ?? "no message",
    });

    ctx?.addLog("Task completed successfully");

    return {
      status: "COMPLETED",
      outputData: ctx?.getOutput() ?? { processed: true },
    };
  }
);

// ── Worker demonstrating IN_PROGRESS callback pattern ───────────────
const longRunningWorker = worker({ taskDefName: "ctx_long_running", registerTaskDef: true })(
  async (task: Task) => {
    const ctx = getTaskContext();
    const attempt = (task.inputData?.attempt as number) ?? 0;

    ctx?.addLog(`Long-running task attempt ${attempt}`);

    // Simulate a task that needs multiple callbacks
    if (attempt < 2) {
      ctx?.addLog("Not ready yet, requesting callback in 5 seconds");
      ctx?.setCallbackAfter(5);
      return {
        status: "IN_PROGRESS" as const,
        callbackAfterSeconds: 5,
        outputData: { attempt: attempt + 1, progress: (attempt + 1) * 33 },
      };
    }

    ctx?.addLog("Processing complete!");
    return {
      status: "COMPLETED" as const,
      outputData: { result: "done", totalAttempts: attempt + 1 },
    };
  }
);

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  const clients = await OrkesClients.from();
  const workflowClient = clients.getWorkflowClient();
  const client = clients.getClient();

  const wf = new ConductorWorkflow(workflowClient, "task_context_example")
    .description("Demonstrates TaskContext features")
    .add(
      simpleTask("log_ref", "ctx_logging_worker", {
        message: "${workflow.input.message}",
      })
    )
    .outputParameters({
      taskId: "${log_ref.output.taskId}",
      message: "${log_ref.output.message}",
    });

  await wf.register(true);
  console.log("Registered workflow:", wf.getName());

  const handler = new TaskHandler({ client, scanForDecorated: true });
  await handler.startWorkers();

  const run = await wf.execute({ message: "Hello from context example" });
  console.log("Status:", run.status);
  console.log("Output:", JSON.stringify(run.output, null, 2));

  // Fetch task execution logs
  const taskClient = clients.getTaskClient();
  const tasks = run.tasks ?? [];
  for (const t of tasks) {
    if (t.taskId) {
      const logs = await taskClient.getTaskLogs(t.taskId);
      if (logs.length > 0) {
        console.log(`\nLogs for task ${t.taskDefName}:`);
        for (const log of logs) {
          console.log(`  ${log.log}`);
        }
      }
    }
  }

  await handler.stopWorkers();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
