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
  ],
  coverageReporters: ["text", "lcov", "cobertura"],
  transformIgnorePatterns: ["/node_modules/", "\\.pnp\\.[^\\/]+$"],
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
