import "dotenv/config";

export default {
  preset: "ts-jest",
  clearMocks: true,
  coverageProvider: "v8",
  testMatch: [
    "**/integration-tests/**/*.test.[jt]s?(x)",
  ],
  transformIgnorePatterns: ["/node_modules/", "\\.pnp\\.[^\\/]+$"],
};
