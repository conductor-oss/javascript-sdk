/* global module */

const USAGE_LIMIT_MESSAGE = "reached your specified api usage limits";

const isUsageLimitFailure = (failureMessages) =>
  failureMessages.some((message) =>
    String(message).toLowerCase().includes(USAGE_LIMIT_MESSAGE),
  );

const processResults = (results) => {
  for (const suite of results.testResults) {
    for (const assertion of suite.testResults) {
      if (
        assertion.status === "failed" &&
        isUsageLimitFailure(assertion.failureMessages ?? [])
      ) {
        assertion.status = "pending";
        assertion.failureMessages = [];
        suite.numFailingTests -= 1;
        suite.numPendingTests += 1;
      }
    }

    if (suite.numFailingTests === 0 && !suite.testExecError) {
      suite.failureMessage = null;
    }
  }

  results.numFailedTests = results.testResults.reduce(
    (count, suite) => count + suite.numFailingTests,
    0,
  );
  results.numPendingTests = results.testResults.reduce(
    (count, suite) => count + suite.numPendingTests,
    0,
  );
  results.numFailedTestSuites = results.testResults.filter(
    (suite) => suite.numFailingTests > 0 || suite.testExecError,
  ).length;
  results.numPassedTestSuites =
    results.testResults.length - results.numFailedTestSuites;
  results.success =
    results.numFailedTests === 0 &&
    results.numFailedTestSuites === 0 &&
    results.numRuntimeErrorTestSuites === 0;

  return results;
};

module.exports = processResults;
module.exports.isUsageLimitFailure = isUsageLimitFailure;
