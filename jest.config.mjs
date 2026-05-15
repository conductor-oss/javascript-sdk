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
