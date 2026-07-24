/* eslint-disable @typescript-eslint/no-require-imports, no-undef */

const { describe, expect, it } = require("@jest/globals");
const processResults = require("../../../e2e/llm-budget-results-processor.cjs");

const failure = (message) => ({
  status: "failed",
  failureMessages: [message],
});

const resultsWith = (...assertions) => ({
  success: false,
  numFailedTests: assertions.length,
  numPendingTests: 0,
  numFailedTestSuites: 1,
  numPassedTestSuites: 0,
  numRuntimeErrorTestSuites: 0,
  testResults: [
    {
      failureMessage: "suite failed",
      numFailingTests: assertions.length,
      numPendingTests: 0,
      testResults: assertions,
    },
  ],
});

describe("LLM budget results processor", () => {
  it("converts the provider usage-limit failure to pending", () => {
    const results = processResults(
      resultsWith(
        failure("You have reached your specified API usage limits. Try again later."),
      ),
    );

    expect(results.success).toBe(true);
    expect(results.numFailedTests).toBe(0);
    expect(results.numPendingTests).toBe(1);
    expect(results.testResults[0].testResults[0].status).toBe("pending");
  });

  it("preserves unrelated failures in a mixed run", () => {
    const results = processResults(
      resultsWith(
        failure("You have reached your specified API usage limits."),
        failure("Agent failed: invalid model"),
      ),
    );

    expect(results.success).toBe(false);
    expect(results.numFailedTests).toBe(1);
    expect(results.numPendingTests).toBe(1);
    expect(results.testResults[0].testResults[1].status).toBe("failed");
  });
});
