import "dotenv/config";

export default {
  preset: "ts-jest",
  clearMocks: true,
  coverageProvider: "v8",
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
