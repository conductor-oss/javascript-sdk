import "dotenv/config";

export default {
  preset: "ts-jest",
  clearMocks: true,
  coverageProvider: "v8",
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/generated/**",
    "!src/**/spec/**",
    "!src/**/*.test.{ts,tsx}",
    "!src/integration-tests/**",
    "!src/**/index.ts",
    "!src/**/types.ts",
    "!src/**/*.types.ts",
    "!src/**/exceptions/**",
  ],
  coverageReporters: ["text", "lcov", "cobertura"],
  transformIgnorePatterns: ["/node_modules/", "\\.pnp\\.[^\\/]+$"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@open-api/(.*)$": "<rootDir>/src/open-api/$1",
    "^@test-utils/(.*)$": "<rootDir>/src/integration-tests/utils/$1",
    "^@io-orkes/conductor-javascript/agents$": "<rootDir>/src/agents/index.ts",
    "^@io-orkes/conductor-javascript/agents/testing$": "<rootDir>/src/agents/testing/index.ts",
    "^@io-orkes/conductor-javascript/agents/vercel-ai$": "<rootDir>/src/agents/wrappers/ai.ts",
    "^@io-orkes/conductor-javascript/agents/langgraph$": "<rootDir>/src/agents/wrappers/langgraph.ts",
    "^@io-orkes/conductor-javascript/agents/langchain$": "<rootDir>/src/agents/wrappers/langchain.ts",
    "^@io-orkes/conductor-javascript$": "<rootDir>/index.ts",
    // src/agents keeps upstream's ESM-style `.js`-suffixed relative imports;
    // strip the suffix so ts-jest resolves them to the .ts sources.
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
        },
      },
    ],
  },
};
