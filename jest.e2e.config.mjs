import baseConfig from "./jest.config.mjs";

/**
 * Agent e2e suites (repo-root e2e/) against a live agentspan server.
 * Run with: npm run test:agent-e2e
 * Not matched by test/test:unit/test:integration globs — per-PR unit CI cost
 * is unchanged; the agent-e2e workflow runs these against the release JAR.
 */
export default {
  ...baseConfig,
  testMatch: ["**/e2e/**/*.test.ts"],
  testTimeout: 60_000,
  // Upstream ran 3 vitest forks (credential names are unique per suite; 3
  // keeps server load manageable on the shared SQLite-backed Conductor).
  maxWorkers: 3,
  reporters: [
    "default",
    ["jest-junit", { outputDirectory: "results", outputName: "junit-e2e.xml" }],
  ],
};
