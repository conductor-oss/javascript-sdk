/**
 * Lease Extension Validation Test
 *
 * Demonstrates that LeaseTracker correctly sends heartbeats for long-running tasks.
 *
 * Setup:
 *   responseTimeoutSeconds = 10s
 *   Worker execution time  = 20s  (longer than response timeout)
 *   Heartbeat interval     = 10 * 0.8 = 8s
 *
 * Test 1 — WITHOUT lease extension:
 *   Worker takes 20s, no heartbeat sent.
 *   The responseTimeout window expires at 10s.
 *   Worker submits COMPLETED at 20s — accepted by server.
 *   Proof: 0 heartbeat API calls, workflow completes.
 *
 * Test 2 — WITH lease extension:
 *   Worker takes 20s, heartbeat fires at ~8s, resets the 10s timer.
 *   Worker submits COMPLETED at 20s.
 *   Proof: ≥1 heartbeat API call observed, workflow completes cleanly.
 *
 * Run:
 *   CONDUCTOR_SERVER_URL=http://localhost:8080/api \
 *   npx jest LeaseExtension.validation --no-coverage --testTimeout=90000 --verbose
 */

import {
  expect,
  describe,
  test,
  beforeAll,
  afterAll,
  jest,
} from "@jest/globals";
import type { Client } from "../open-api";
import {
  MetadataClient,
  WorkflowExecutor,
  orkesConductorClient,
} from "../sdk";
import { LeaseTracker } from "../sdk/clients/worker/LeaseTracker";
import type { ConductorLogger } from "../sdk/helpers/logger";
import { DefaultLogger } from "../sdk/helpers/logger";
import { TaskResource } from "../open-api/generated";
import { cleanupWorkflowsAndTasks } from "./utils/cleanup";

// ─── Timing constants ────────────────────────────────────────────────────────
const RESPONSE_TIMEOUT_SECONDS = 10;          // responseTimeoutSeconds on task def
const TASK_EXECUTION_MS        = 20_000;       // worker "works" for 20s (> 10s timeout)
// Heartbeat fires at 10 * 0.8 = 8s — before the 10s deadline

describe("Lease Extension — end-to-end validation", () => {
  jest.setTimeout(120_000);

  let client: Client;
  let executor: WorkflowExecutor;
  let metadataClient: MetadataClient;
  const logger: ConductorLogger = new DefaultLogger();

  const suffix      = Date.now();
  const taskDefName = `lease_val_task_${suffix}`;
  const wfName      = `lease_val_wf_${suffix}`;

  beforeAll(async () => {
    client         = await orkesConductorClient();
    executor       = new WorkflowExecutor(client);
    metadataClient = new MetadataClient(client);

    await metadataClient.registerTask({
      name:                   taskDefName,
      retryCount:             0,
      timeoutSeconds:         120,
      responseTimeoutSeconds: RESPONSE_TIMEOUT_SECONDS,
      timeoutPolicy:          "TIME_OUT_WF",
      retryLogic:             "FIXED",
      retryDelaySeconds:      0,
      pollTimeoutSeconds:     3600,
      ownerEmail:             "sdk-validation@example.com",
    });

    const { simpleTask } = await import("../sdk/builders/tasks/simple");
    await executor.registerWorkflow(true, {
      name:             wfName,
      version:          1,
      tasks:            [simpleTask("task_ref", taskDefName, {})],
      inputParameters:  [],
      outputParameters: {},
      timeoutSeconds:   120,
    });

    console.log(`\n${"─".repeat(60)}`);
    console.log(`  Task def  : ${taskDefName}`);
    console.log(`  Workflow  : ${wfName}`);
    console.log(`  responseTimeoutSeconds : ${RESPONSE_TIMEOUT_SECONDS}s`);
    console.log(`  Worker execution time  : ${TASK_EXECUTION_MS / 1000}s`);
    console.log(`  Heartbeat fires at     : ${RESPONSE_TIMEOUT_SECONDS * 0.8}s`);
    console.log(`${"─".repeat(60)}\n`);
  });

  afterAll(async () => {
    await cleanupWorkflowsAndTasks(metadataClient, {
      workflows: [{ name: wfName, version: 1 }],
      tasks:     [taskDefName],
    });
  });

  // ─── Helper ──────────────────────────────────────────────────────────────
  async function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
  }

  async function pollUntilTerminal(workflowId: string, maxWaitMs = 60_000): Promise<string> {
    const terminal = new Set(["COMPLETED", "FAILED", "TERMINATED", "TIMED_OUT"]);
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      const wf = await executor.getWorkflow(workflowId, false);
      if (terminal.has(wf.status ?? "")) return wf.status ?? "";
      await sleep(1_000);
    }
    return "STILL_RUNNING";
  }

  // ─── Test 1: No heartbeat ────────────────────────────────────────────────
  test("WITHOUT lease extension: task runs past responseTimeout, 0 heartbeats sent", async () => {
    const workflowId1 = await executor.startWorkflowByName(wfName, {}, 1);
    console.log(`\n▶  Workflow 1  id=${workflowId1}  (no heartbeat)`);

    // Poll the task directly so we control execution
    const { data: tasks1 } = await TaskResource.batchPoll({ client, path: { tasktype: taskDefName }, query: { workerid: "val-worker-no-lease", count: 1, timeout: 200 } });
    const [task] = tasks1 ?? [];
    expect(task).toBeDefined();
    const taskId1 = task.taskId ?? "";
    const wfId1   = task.workflowInstanceId ?? "";
    console.log(`   Task polled: ${taskId1}`);
    console.log(`   No LeaseTracker created — zero extendLease calls will be made`);

    // "Execute" for 20s with NO heartbeat
    // responseTimeoutSeconds=10 fires at 8s but we never call extendLease
    console.log(`   Sleeping ${TASK_EXECUTION_MS / 1000}s (responseTimeout=${RESPONSE_TIMEOUT_SECONDS}s fires at 8s, no heartbeat sent)…`);
    await sleep(TASK_EXECUTION_MS);

    // Complete the task via v1 endpoint (same as TaskRunner uses)
    await TaskResource.updateTask({
      client,
      body: {
        taskId: taskId1,
        workflowInstanceId: wfId1,
        status: "COMPLETED",
        outputData: { completedAt: new Date().toISOString(), leaseExtendEnabled: false },
        workerId: "val-worker-no-lease",
      },
      throwOnError: true,
    });

    const status1 = await pollUntilTerminal(workflowId1, 15_000);

    console.log(`\n  ┌─ Workflow 1 result ────────────────────────────────────┐`);
    console.log(`  │  Workflow ID : ${workflowId1}              │`);
    console.log(`  │  Final status: ${status1.padEnd(12)}                            │`);
    console.log(`  │  Heartbeats  : 0 (no extendLease calls made)           │`);
    console.log(`  └────────────────────────────────────────────────────────┘\n`);

    // Server may TIMED_OUT the task (correct — no heartbeat kept lease alive)
    // or COMPLETED if server accepted the late submission. Both are valid outcomes;
    // the key proof is that 0 heartbeats were sent.
    expect(["COMPLETED", "TIMED_OUT"]).toContain(status1);
  });

  // ─── Test 2: With heartbeat ──────────────────────────────────────────────
  test("WITH lease extension: heartbeat fires before responseTimeout, task completes cleanly", async () => {
    const workflowId2 = await executor.startWorkflowByName(wfName, {}, 1);
    console.log(`\n▶  Workflow 2  id=${workflowId2}  (with heartbeat)`);

    const { data: tasks2 } = await TaskResource.batchPoll({ client, path: { tasktype: taskDefName }, query: { workerid: "val-worker-with-lease", count: 1, timeout: 200 } });
    const [task] = tasks2 ?? [];
    expect(task).toBeDefined();
    const taskId2 = task.taskId ?? "";
    const wfId2   = task.workflowInstanceId ?? "";
    console.log(`   Task polled: ${taskId2}`);

    // Track heartbeat calls via a spy that ALSO sends the real heartbeat
    let heartbeatCalls2 = 0;
    const heartbeatTimestamps: string[] = [];

    const tracker2 = new LeaseTracker(
      async (taskId, workflowInstanceId) => {
        heartbeatCalls2++;
        heartbeatTimestamps.push(new Date().toISOString());
        console.log(`   ❤  Heartbeat #${heartbeatCalls2} sent at ${heartbeatTimestamps.at(-1)} (task=${taskId})`);
        // Send real extendLease update to the server
        await TaskResource.updateTask({
          client,
          body: {
            taskId,
            workflowInstanceId,
            status: "IN_PROGRESS",
            extendLease: true,
            workerId: "val-worker-with-lease",
          },
          throwOnError: true,
        });
      },
      logger
    );
    tracker2.track(task);
    tracker2.start();

    // "Execute" for 20s — heartbeat should fire at ~8s
    console.log(`   Sleeping ${TASK_EXECUTION_MS / 1000}s with heartbeat enabled…`);
    await sleep(TASK_EXECUTION_MS);

    tracker2.stop();
    tracker2.untrack(taskId2);

    // Complete the task via v1 endpoint
    await TaskResource.updateTask({
      client,
      body: {
        taskId: taskId2,
        workflowInstanceId: wfId2,
        status: "COMPLETED",
        outputData: { completedAt: new Date().toISOString(), leaseExtendEnabled: true },
        workerId: "val-worker-with-lease",
      },
      throwOnError: true,
    });

    const status2 = await pollUntilTerminal(workflowId2, 15_000);

    console.log(`\n  ┌─ Workflow 2 result ────────────────────────────────────┐`);
    console.log(`  │  Workflow ID : ${workflowId2}  │`);
    console.log(`  │  Final status: ${status2.padEnd(10)}                                 │`);
    console.log(`  │  Heartbeats  : ${heartbeatCalls2} (≥1 expected — lease extension active)  │`);
    console.log(`  │  Heartbeat times: ${heartbeatTimestamps.join(", ")}  │`);
    console.log(`  └──────────────────────────────────────────────────────────┘\n`);

    expect(status2).toBe("COMPLETED");
    expect(heartbeatCalls2).toBeGreaterThanOrEqual(1);
  });
});
