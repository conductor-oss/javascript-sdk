import {
  afterEach,
  beforeAll,
  expect,
  jest,
  test,
} from "@jest/globals";
import type { Client, Task } from "../open-api";
import {
  TaskHandler,
  WorkflowExecutor,
  clearWorkerRegistry,
  OrkesClients,
  orkesConductorClient,
  simpleTask,
  worker,
} from "../sdk";
import { cleanupWorkflowsAndTasks } from "./utils/cleanup";
import { waitForWorkflowStatus } from "./utils/waitForWorkflowStatus";
import { describeForOrkesV5 } from "./utils/customJestDescribe";

describeForOrkesV5("E2E: 5-task workflow × 50 executions", () => {
  const clientPromise: Promise<Client> = orkesConductorClient();
  let executor: WorkflowExecutor;
  let handler: TaskHandler | undefined;

  jest.setTimeout(700_000); // 50 workflows × 5 tasks; CI can be slow (poll timeouts)

  beforeAll(async () => {
    const client = await clientPromise;
    executor = new WorkflowExecutor(client);
  });

  afterEach(async () => {
    if (handler) {
      await handler.stopWorkers();
      handler = undefined;
    }
    clearWorkerRegistry();
  });

  test(
    "50 workflows with 5 sequential tasks each all complete with correct output",
    async () => {
      const client = await clientPromise;
      const testId = Date.now();
      const workflowName = `e2e_five_task_wf_${testId}`;
      const TASK_COUNT = 5;
      const WORKFLOW_COUNT = 50;

      // Track execution counts per task type
      const executionCounts: Record<string, number> = {};

      // Register 5 workers — one per task type
      for (let i = 1; i <= TASK_COUNT; i++) {
        const taskName = `e2e_task_${i}_${testId}`;
        executionCounts[taskName] = 0;

        worker({ taskDefName: taskName, pollInterval: 100, concurrency: 5 })(
          async function taskWorker(task: Task) {
            executionCounts[taskName] = (executionCounts[taskName] ?? 0) + 1;
            return {
              status: "COMPLETED" as const,
              outputData: {
                taskNumber: i,
                message: `Processed by task_${i}`,
                workflowId: task.workflowInstanceId,
                batchIndex: task.inputData?.batchIndex,
              },
            };
          }
        );
      }

      // Create TaskHandler with auto-discovery and start polling
      handler = new TaskHandler({ client, scanForDecorated: true });
      expect(handler.workerCount).toBe(TASK_COUNT);
      await handler.startWorkers();

      // Wait for workers to initialize
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Build workflow definition with 5 sequential simple tasks
      const taskDefs = [];
      for (let i = 1; i <= TASK_COUNT; i++) {
        const taskName = `e2e_task_${i}_${testId}`;
        taskDefs.push(
          simpleTask(`task_${i}_ref`, taskName, {
            batchIndex: "${workflow.input.batchIndex}",
          })
        );
      }

      await executor.registerWorkflow(true, {
        name: workflowName,
        version: 1,
        ownerEmail: "test@test.com",
        tasks: taskDefs,
        inputParameters: ["batchIndex"],
        outputParameters: {
          task_1_output: "${task_1_ref.output}",
          task_2_output: "${task_2_ref.output}",
          task_3_output: "${task_3_ref.output}",
          task_4_output: "${task_4_ref.output}",
          task_5_output: "${task_5_ref.output}",
        },
        timeoutSeconds: 120,
      });

      // Fire all 50 workflows
      const workflowIds: string[] = [];
      for (let i = 0; i < WORKFLOW_COUNT; i++) {
        const id = await executor.startWorkflow({
          name: workflowName,
          version: 1,
          input: { batchIndex: i },
        });
        workflowIds.push(id);
      }

      expect(workflowIds.length).toBe(WORKFLOW_COUNT);

      // Wait for all 50 to complete (600s in CI-friendly timeout, poll every 2s)
      const results = await Promise.all(
        workflowIds.map((id) =>
          waitForWorkflowStatus(executor, id, "COMPLETED", 600_000, 2000)
        )
      );

      // ── Validate all 50 workflows ──────────────────────────────────

      expect(results.length).toBe(WORKFLOW_COUNT);

      for (let w = 0; w < results.length; w++) {
        const wf = results[w];
        if (!wf) throw new Error(`Expected result at index ${w}`);
        expect(wf.status).toBe("COMPLETED");

        // Each workflow should have exactly 5 tasks
        expect(wf.tasks?.length).toBe(TASK_COUNT);

        // Validate each task's output
        for (let t = 0; t < TASK_COUNT; t++) {
          const tasks = wf.tasks;
          if (!tasks) throw new Error(`Expected tasks for workflow at index ${w}`);
          const task = tasks[t];
          if (!task) throw new Error(`Expected task at index ${t}`);
          expect(task.status).toBe("COMPLETED");
          expect(task.outputData?.taskNumber).toBe(t + 1);
          expect(task.outputData?.message).toBe(
            `Processed by task_${t + 1}`
          );
          expect(task.outputData?.batchIndex).toBe(w);
        }
      }

      // ── Validate execution counts ──────────────────────────────────
      // Each of the 5 task types should have been executed exactly 50 times
      for (let i = 1; i <= TASK_COUNT; i++) {
        const taskName = `e2e_task_${i}_${testId}`;
        expect(executionCounts[taskName]).toBe(WORKFLOW_COUNT);
      }

      // Clean up workflow and task definitions from the server
      const metadataClient = new OrkesClients(client).getMetadataClient();
      const taskNames = Array.from({ length: TASK_COUNT }, (_, i) => `e2e_task_${i + 1}_${testId}`);
      await cleanupWorkflowsAndTasks(metadataClient, {
        workflows: [{ name: workflowName, version: 1 }],
        tasks: taskNames,
      });
    },
    330_000 // 5.5 minute timeout for the entire test
  );
});
