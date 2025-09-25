import { describe, test, expect, jest } from "@jest/globals";
import { orkesConductorClient } from "../../src/orkes";
import { WorkflowExecutor } from "../../src/core";
import { TaskType } from "../../src/common";

const CONCURRENT_REQUESTS = 500;
const TEST_TIMEOUT = 180000 * 10; // 180 seconds

describe("Load Test for ECONNRESET", () => {
  jest.setTimeout(TEST_TIMEOUT);

  test(`should handle ${CONCURRENT_REQUESTS} staggered GET requests (1 every 0ms) without ECONNRESET`, async () => {
    const client = await orkesConductorClient();
    const executor = new WorkflowExecutor(client);

    // To ensure we are making valid API calls, we first create a simple
    // workflow and start one execution. We will then query this execution's status.
    const workflowName = "load_test_workflow";
    await executor.registerWorkflow(true, {
      name: workflowName,
      version: 1,
      tasks: [
        {
          name: "simple_task",
          taskReferenceName: "simple_task_ref",
          type: TaskType.SIMPLE,
        },
      ],
      timeoutSeconds: 0,
      inputParameters: [],
    });
    const executionId = await executor.startWorkflow({
      name: workflowName,
      version: 1,
    });

    console.log(
      `Starting load test with workflow execution ID: ${executionId}`
    );
    console.log(
      `Sending ${CONCURRENT_REQUESTS} staggered requests (1 every 0ms)...`
    );

    const requestPromises: Promise<any>[] = [];
    for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
      requestPromises.push(executor.getWorkflow(executionId, false));
    }

    const results = await Promise.allSettled(requestPromises);

    let successCount = 0;
    const errors: any[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        successCount++;
      } else {
        const reason = result.reason;

        errors.push({ requestIndex: index, reason });
      }
    });

    console.log("--- Load Test Results ---");
    console.log(
      `Successful Requests: ${successCount} / ${CONCURRENT_REQUESTS}`
    );
    console.log(`Failures: ${errors.length}`);
    console.log("-------------------------");

    if (errors.length > 0) {
      console.error(`\n--- Errors (${errors.length}) ---`);
      for (const error of errors) {
        console.error(
          `Request Index ${error.requestIndex} failed. Reason:`,
          error.reason
        );
      }
      console.error("--------------------------\n");
    }

    expect(errors.length).toBe(0);
  });
});
