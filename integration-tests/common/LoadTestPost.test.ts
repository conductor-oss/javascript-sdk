import { describe, test, expect, jest } from "@jest/globals";
import { orkesConductorClient } from "../../src/orkes";
import { WorkflowExecutor } from "../../src/core";
import { TaskType, WorkflowDef } from "../../src/common";

// --- Configuration for the Load Test ---
// The number of requests to send in parallel.
// Adjust this number to find the breaking point of your load balancer.
const CONCURRENT_REQUESTS = 3000;
const TEST_TIMEOUT = 60000 * 10; // 60 seconds

describe("Load balancer test for POST requests", () => {
  jest.setTimeout(TEST_TIMEOUT);

  test(`should handle ${CONCURRENT_REQUESTS} POST requests`, async () => {
    const client = await orkesConductorClient();
    const executor = new WorkflowExecutor(client);
    console.log(`Starting POST load test for workflow registration`);
    console.log(`Sending ${CONCURRENT_REQUESTS} concurrent requests...`);
    const requestPromises: Promise<any>[] = [];
    for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
      const workflowName = "JS_SDK_load_test_post_workflow"
      const workflowDef: WorkflowDef = {
        name: workflowName,
        version: 1,
        inputParameters: [],
        tasks: [
          {
            name: "JS_SDK_simple_task_post",
            taskReferenceName: "JS_SDK_simple_task_post_ref",
            type: TaskType.SIMPLE,
          },
        ],
        timeoutSeconds: 0,
      };
      requestPromises.push(executor.registerWorkflow(true, workflowDef));
    }
    const results = await Promise.allSettled(requestPromises);
    let successCount = 0;
    const econnresetErrors: any[] = [];
    const http429Errors: any[] = [];
    const otherErrors: any[] = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        successCount++;
      } else {
        const reason = result.reason;
        if (reason?.code === "ECONNRESET") {
          econnresetErrors.push({ requestIndex: index, reason });
        } else if (reason?.body?.status === 429) {
          http429Errors.push({ requestIndex: index, reason });
        } else {
          otherErrors.push({ requestIndex: index, reason });
        }
      }
    });
    console.log("--- Load Test Results ---");
    console.log(
      `Successful Requests: ${successCount} / ${CONCURRENT_REQUESTS}`
    );
    console.log(`ECONNRESET Failures: ${econnresetErrors.length}`);
    console.log(`HTTP 429 Failures: ${http429Errors.length}`);
    console.log(`Other Failures: ${otherErrors.length}`);
    console.log("-------------------------");
    if (econnresetErrors.length > 0) {
      console.error("ECONNRESET errors detected:", econnresetErrors);
    }
    if (http429Errors.length > 0) {
      console.error(
        "HTTP 429 (Too Many Requests) errors detected:",
        http429Errors
      );
    }
    if (otherErrors.length > 0) {
      console.error(`\n--- Other Errors (${otherErrors.length}) ---`);
      for (const error of otherErrors) {
        console.error(
          `Request Index ${error.requestIndex} failed. Reason:`,
          error.reason
        );
      }
      console.error("--------------------------\n");
    }
    expect(econnresetErrors.length).toBe(0);
    expect(http429Errors.length).toBe(0);
    expect(otherErrors.length).toBe(0);
  });
});
