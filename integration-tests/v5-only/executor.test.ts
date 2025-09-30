import {expect, describe, test, jest, beforeAll, afterEach, afterAll} from "@jest/globals";
import {Consistency, ReturnStrategy} from "../../src/common";
import { orkesConductorClient } from "../../src/orkes";
import { WorkflowExecutor } from "../../src/core/executor";
import { v4 as uuidv4 } from "uuid";
import {MetadataClient} from "../../src/core/metadataClient";
import {waitForWorkflowStatus} from "../utils/waitForWorkflowStatus";
import {TaskResultStatusEnum} from "../../src/common/open-api/models/TaskResultStatusEnum";
import {SignalResponse} from "../../src/common/open-api/models/SignalResponse";
import { getComplexWfSignalTest } from "./metadata/complex_wf_signal_test";
import { getComplexWfSignalTestSubworkflow1 } from "./metadata/complex_wf_signal_test_subworkflow_1";
import { getComplexWfSignalTestSubworkflow2 } from "./metadata/complex_wf_signal_test_subworkflow_2";
import { getWaitSignalTest } from "./metadata/wait_signal_test";

describe("Execute with Return Strategy and Consistency", () => {
  // Constants specific to this test suite
  const now = Date.now();
  const WORKFLOWS = {
    COMPLEX_WF: getComplexWfSignalTest(now),
    SUB_WF_1: getComplexWfSignalTestSubworkflow1(now),
    SUB_WF_2: getComplexWfSignalTestSubworkflow2(now),
    WAIT_SIGNAL_TEST: getWaitSignalTest(now)
  };

  const clientPromise = orkesConductorClient();
  jest.setTimeout(300000);

  let client: any;
  let executor: WorkflowExecutor;
  let metadataClient: MetadataClient;
  const workflowsToCleanup: {name: string, version: number}[] = [];
  const executionsToCleanup: string[] = [];

  beforeAll(async () => {
    client = await clientPromise;
    executor = new WorkflowExecutor(client);
    metadataClient = new MetadataClient(client);

    // Register all test workflows
    await registerAllWorkflows();
  });

  afterEach(async () => {
    // Clean up executions first
    for (const executionId of executionsToCleanup) {
      try {
        const workflowStatus = await executor.getWorkflowStatus(executionId, false, false);

        if (workflowStatus.status && !['COMPLETED', 'FAILED', 'TERMINATED', 'TIMED_OUT'].includes(workflowStatus.status)) {
          await executor.terminate(executionId, "Test cleanup");
          console.debug(`Terminated running workflow: ${executionId}`);
        } else {
          console.debug(`Skipping cleanup for ${workflowStatus.status} workflow: ${executionId}`);
        }
      } catch (e) {
        console.debug(`Failed to cleanup execution ${executionId}:`, e);
      }
    }
    executionsToCleanup.length = 0;
  });

  afterAll(async () => {
    // Cleanup all workflows
    await cleanupAllWorkflows();
  });

  async function registerAllWorkflows(): Promise<void> {
    try {
      await Promise.all([
        metadataClient.registerWorkflowDef(WORKFLOWS.COMPLEX_WF, true),
        metadataClient.registerWorkflowDef(WORKFLOWS.SUB_WF_1, true),
        metadataClient.registerWorkflowDef(WORKFLOWS.SUB_WF_2, true),
        metadataClient.registerWorkflowDef(WORKFLOWS.WAIT_SIGNAL_TEST, true)
      ]);

      // Add to cleanup list
      Object.values(WORKFLOWS).forEach(workflow => {
        workflowsToCleanup.push({name: workflow.name, version: 1});
      });

      console.log('✓ All workflows registered successfully');
    } catch (error) {
      throw new Error(`Failed to register workflows: ${error}`);
    }
  }

  async function cleanupAllWorkflows(): Promise<void> {
    const cleanupPromises = workflowsToCleanup.map(({name, version}) =>
      metadataClient.unregisterWorkflow(name, version)
    );

    const results = await Promise.allSettled(cleanupPromises);
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(`Failed to cleanup workflow ${workflowsToCleanup[index].name}: ${result.reason}`);
      }
    });
    console.log('✓ Cleanup completed');
  }

  describe("Execute Workflow with Return Strategies and Consistency Levels", () => {

    // Test data for combinations
    const testCombinations = [
      // SYNCHRONOUS consistency tests
      {
        name: "SYNC + TARGET_WORKFLOW",
        consistency: Consistency.SYNCHRONOUS,
        returnStrategy: ReturnStrategy.TARGET_WORKFLOW,
        shouldHaveWorkflowFields: true,
        shouldHaveTaskFields: false
      },
      {
        name: "SYNC + BLOCKING_WORKFLOW",
        consistency: Consistency.SYNCHRONOUS,
        returnStrategy: ReturnStrategy.BLOCKING_WORKFLOW,
        shouldHaveWorkflowFields: true,
        shouldHaveTaskFields: false
      },
      {
        name: "SYNC + BLOCKING_TASK",
        consistency: Consistency.SYNCHRONOUS,
        returnStrategy: ReturnStrategy.BLOCKING_TASK,
        shouldHaveWorkflowFields: false,
        shouldHaveTaskFields: true
      },
      {
        name: "SYNC + BLOCKING_TASK_INPUT",
        consistency: Consistency.SYNCHRONOUS,
        returnStrategy: ReturnStrategy.BLOCKING_TASK_INPUT,
        shouldHaveWorkflowFields: false,
        shouldHaveTaskFields: true
      },
      // REGION_DURABLE consistency tests
      {
        name: "DURABLE + TARGET_WORKFLOW",
        consistency: Consistency.REGION_DURABLE,
        returnStrategy: ReturnStrategy.TARGET_WORKFLOW,
        shouldHaveWorkflowFields: true,
        shouldHaveTaskFields: false
      },
      {
        name: "DURABLE + BLOCKING_WORKFLOW",
        consistency: Consistency.REGION_DURABLE,
        returnStrategy: ReturnStrategy.BLOCKING_WORKFLOW,
        shouldHaveWorkflowFields: true,
        shouldHaveTaskFields: false
      },
      {
        name: "DURABLE + BLOCKING_TASK",
        consistency: Consistency.REGION_DURABLE,
        returnStrategy: ReturnStrategy.BLOCKING_TASK,
        shouldHaveWorkflowFields: false,
        shouldHaveTaskFields: true
      },
      {
        name: "DURABLE + BLOCKING_TASK_INPUT",
        consistency: Consistency.REGION_DURABLE,
        returnStrategy: ReturnStrategy.BLOCKING_TASK_INPUT,
        shouldHaveWorkflowFields: false,
        shouldHaveTaskFields: true
      }
    ];

    test("Should execute complex workflow with SYNC + TARGET_WORKFLOW and validate all aspects", async () => {
      const testCase = testCombinations[0]; // SYNC + TARGET_WORKFLOW

      console.log(`\n--- Testing ${testCase.name} ---`);

      // 1. Execute workflow with return strategy
      const rawResult = await executor.executeWorkflow(
          { name: WORKFLOWS.COMPLEX_WF.name, version: 1 },
          WORKFLOWS.COMPLEX_WF.name,
          1,
          uuidv4(),
          "", // waitUntilTaskRef
          10, // waitForSeconds
          testCase.consistency,
          testCase.returnStrategy
      );

      // Convert to SignalResponse instance
      const result = Object.assign(new SignalResponse(), rawResult);

      // Add to cleanup list
      if (result.workflowId) {
        executionsToCleanup.push(result.workflowId);
      }

      console.log(`Started workflow with ID: ${result.workflowId} for strategy: ${testCase.name}`);

      // ========== BASIC VALIDATIONS ==========
      expect(result).not.toBeNull();
      expect(result.responseType).toEqual(testCase.returnStrategy);
      expect(result.workflowId).toBeDefined();
      expect(result.targetWorkflowId).toBeDefined();
      expect(result.targetWorkflowStatus).toBeDefined();
      expect(result.input).toBeDefined();
      expect(result.output).toBeDefined();

      // ========== TYPE CHECK VALIDATIONS ==========
      expect(result.isTargetWorkflow()).toBe(testCase.returnStrategy === ReturnStrategy.TARGET_WORKFLOW);
      expect(result.isBlockingWorkflow()).toBe(testCase.returnStrategy === ReturnStrategy.BLOCKING_WORKFLOW);
      expect(result.isBlockingTask()).toBe(testCase.returnStrategy === ReturnStrategy.BLOCKING_TASK);
      expect(result.isBlockingTaskInput()).toBe(testCase.returnStrategy === ReturnStrategy.BLOCKING_TASK_INPUT);

      // ========== STRATEGY-SPECIFIC VALIDATIONS ==========
      if (testCase.shouldHaveWorkflowFields) {
        // Validate workflow-specific fields
        expect(result.status).toBeDefined();
        expect(result.createTime).toBeGreaterThan(0);
        expect(result.updateTime).toBeGreaterThan(0);
        expect(result.tasks).toBeDefined();
        expect(Array.isArray(result.tasks)).toBe(true);
        expect(result.tasks!.length).toBeGreaterThan(0);

        // Validate first task
        const firstTask = result.tasks![0];
        expect(firstTask.taskId).toBeDefined();
        expect(firstTask.taskType).toBeDefined();
        expect(firstTask.referenceTaskName).toBeDefined();
        expect(firstTask.taskDefName).toBeDefined();
      }

      if (testCase.shouldHaveTaskFields) {
        // Validate task-specific fields
        expect(result.taskType).toBeDefined();
        expect(result.taskId).toBeDefined();
        expect(result.referenceTaskName).toBeDefined();
        expect(result.taskDefName).toBeDefined();
        expect(result.workflowType).toBeDefined();
        expect(result.status).toBeDefined();
      }

      // ========== HELPER METHOD VALIDATIONS ==========
      if (testCase.shouldHaveWorkflowFields) {
        // Test getWorkflow() helper method
        const workflowFromResp = result.getWorkflow();
        expect(workflowFromResp).not.toBeNull();
        expect(workflowFromResp.workflowId).toEqual(result.workflowId);
        expect(workflowFromResp.status).toEqual(result.status);
        expect(workflowFromResp.createTime).toEqual(result.createTime);
        expect(workflowFromResp.updateTime).toEqual(result.updateTime);

        // Test that task helper methods throw errors
        expect(() => result.getBlockingTask()).toThrow('does not contain task details');
        expect(() => result.getTaskInput()).toThrow('does not contain task input details');
      } else {
        // Test that workflow helper method throws error
        expect(() => result.getWorkflow()).toThrow('does not contain workflow details');
      }

      if (testCase.shouldHaveTaskFields) {
        // Test getBlockingTask() helper method
        const taskFromResp = result.getBlockingTask();
        expect(taskFromResp).not.toBeNull();
        expect(taskFromResp.taskId).toEqual(result.taskId);
        expect(taskFromResp.taskType).toEqual(result.taskType);
        expect(taskFromResp.referenceTaskName).toEqual(result.referenceTaskName);
        expect(taskFromResp.taskDefName).toEqual(result.taskDefName);
        expect(taskFromResp.workflowType).toEqual(result.workflowType);

        if (testCase.returnStrategy === ReturnStrategy.BLOCKING_TASK_INPUT) {
          // Test getTaskInput() helper method
          const taskInput = result.getTaskInput();
          expect(taskInput).not.toBeNull();
          expect(taskInput).toEqual(result.input);
        } else {
          // Test that getTaskInput throws error for non-BLOCKING_TASK_INPUT
          expect(() => result.getTaskInput()).toThrow('does not contain task input details');
        }
      }

      // ========== SIGNAL THE WORKFLOW ==========
      const workflowId = result.workflowId!;

      // Signal workflow with same return strategy
      const signalResponse = await executor.signal(
          workflowId,
          TaskResultStatusEnum.COMPLETED,
          { result: `Signal received for ${testCase.name}`, timestamp: Date.now() },
          testCase.returnStrategy
      );

      // Validate signal response
      expect(signalResponse.responseType).toEqual(testCase.returnStrategy);
      expect(signalResponse.workflowId).toEqual(workflowId);

      // ========== COMPLETE WORKFLOW ==========
      // Signal again to complete workflow
      await executor.signal(
          workflowId,
          TaskResultStatusEnum.COMPLETED,
          { result: `Final signal for ${testCase.name}` },
          testCase.returnStrategy
      );

      // Wait for workflow completion
      const finalWorkflow = await waitForWorkflowStatus(
          executor,
          workflowId,
          'COMPLETED',
          300000, // 5 min max wait
          200    // 200ms poll interval
      );

      expect(finalWorkflow.status).toEqual('COMPLETED');
      console.log(`✓ ${testCase.name} test completed successfully`);
    });

    // Now replicate for all other combinations
    testCombinations.slice(1).forEach((testCase) => {
      test(`Should execute complex workflow with ${testCase.name}`, async () => {
        console.log(`\n--- Testing ${testCase.name} ---`);

        // Execute workflow
        const rawResult = await executor.executeWorkflow(
            { name: WORKFLOWS.COMPLEX_WF.name, version: 1 },
            WORKFLOWS.COMPLEX_WF.name,
            1,
            uuidv4(),
            "",
            10,
            testCase.consistency,
            testCase.returnStrategy
        );

        // Convert to SignalResponse instance
        const result = Object.assign(new SignalResponse(), rawResult);

        // Add to cleanup list
        if (result.workflowId) {
          executionsToCleanup.push(result.workflowId);
        }

        // Basic validations
        expect(result.responseType).toEqual(testCase.returnStrategy);
        expect(result.workflowId).toBeDefined();

        // Type check validations
        expect(result.isTargetWorkflow()).toBe(testCase.returnStrategy === ReturnStrategy.TARGET_WORKFLOW);
        expect(result.isBlockingWorkflow()).toBe(testCase.returnStrategy === ReturnStrategy.BLOCKING_WORKFLOW);
        expect(result.isBlockingTask()).toBe(testCase.returnStrategy === ReturnStrategy.BLOCKING_TASK);
        expect(result.isBlockingTaskInput()).toBe(testCase.returnStrategy === ReturnStrategy.BLOCKING_TASK_INPUT);

        // Strategy-specific validations
        if (testCase.shouldHaveWorkflowFields) {
          expect(result.status).toBeDefined();
          expect(result.tasks).toBeDefined();
          expect(result.createTime).toBeGreaterThan(0);

          // Test helper methods
          const workflow = result.getWorkflow();
          expect(workflow.workflowId).toEqual(result.workflowId);
        }

        if (testCase.shouldHaveTaskFields) {
          expect(result.taskType).toBeDefined();
          expect(result.taskId).toBeDefined();
          expect(result.referenceTaskName).toBeDefined();

          // Test helper methods
          const task = result.getBlockingTask();
          expect(task.taskId).toEqual(result.taskId);

          if (testCase.returnStrategy === ReturnStrategy.BLOCKING_TASK_INPUT) {
            const taskInput = result.getTaskInput();
            expect(taskInput).toEqual(result.input);
          }
        }

        // Complete workflow
        const workflowId = result.workflowId!;
        await executor.signal(workflowId, TaskResultStatusEnum.COMPLETED, { result: "signal1" });
        await executor.signal(workflowId, TaskResultStatusEnum.COMPLETED, { result: "signal2" });

        await waitForWorkflowStatus(executor, workflowId, 'COMPLETED', 300000, 200);
        console.log(`✓ ${testCase.name} test completed successfully`);
      });
    });
  });
});