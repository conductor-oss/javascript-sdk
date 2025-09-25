import { describe, test, expect, jest } from "@jest/globals";
import { orkesConductorClient } from "../../src/orkes";
import { WorkflowExecutor } from "../../src/core";
import { TaskType } from "../../src/common";

// --- Configuration for the Load Test ---
// The number of requests to send in parallel.
// Adjust this number to find the breaking point of your load balancer.
const CONCURRENT_REQUESTS = 1000;
const TEST_TIMEOUT = 180000 * 10; // 180 seconds

describe("Load Test for ECONNRESET", () => {
  jest.setTimeout(TEST_TIMEOUT);

  test(`should handle ${CONCURRENT_REQUESTS} staggered GET requests (1 every 0ms) without ECONNRESET`, async () => {
    // const client = await orkesConductorClient();
    // const executor = new WorkflowExecutor(client);

    // // To ensure we are making valid API calls, we first create a simple
    // // workflow and start one execution. We will then query this execution's status.
    // const workflowName = "load_test_workflow";
    // await executor.registerWorkflow(true, {
    //   name: workflowName,
    //   version: 1,
    //   tasks: [
    //     {
    //       name: "simple_task",
    //       taskReferenceName: "simple_task_ref",
    //       type: TaskType.SIMPLE,
    //     },
    //   ],
    //   timeoutSeconds: 0,
    //   inputParameters: [],
    // });
    // const executionId = await executor.startWorkflow({
    //   name: workflowName,
    //   version: 1,
    // });

    // console.log(
    //   `Starting load test with workflow execution ID: ${executionId}`
    // );
    console.log(
      `Sending ${CONCURRENT_REQUESTS} staggered requests (1 every 0ms)...`
    );

    // Create an array to hold all the request promises.
    const requestPromises: Promise<any>[] = [];
    for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
      // Start the request but don't wait for it to finish here.
      //requestPromises.push(executor.getWorkflow(executionId, false));
      requestPromises.push(fetch(`https://siliconmint-dev-5x.orkesconductor.io/`));

      // if (i < CONCURRENT_REQUESTS - 1) {
      //   // Wait 100ms before starting the next request.
      //   await new Promise((resolve) => setTimeout(resolve, 0));
      // }
    }

    // Now, wait for all the in-flight requests to complete.
    const results = await Promise.allSettled(requestPromises);

    // Analyze the results to find specific errors
    let successCount = 0;
    const econnresetErrors: any[] = [];
    const http429Errors: any[] = [];
    const otherErrors: any[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        successCount++;
      } else {
        const reason = result.reason;
        // Check if the rejection reason is the specific ECONNRESET error
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
      console.error("HTTP 429 (Too Many Requests) errors detected:", http429Errors);
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

    // The test assertion: Fail if we encounter any ECONNRESET errors.
    expect(econnresetErrors.length).toBe(0);
    expect(http429Errors.length).toBe(0);
    expect(otherErrors.length).toBe(0);
  });
});
