import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "./open-api-spec/spec.json",
  output: "src/common/open-api",
  plugins: [
    {
      asClass: true,
      name: "@hey-api/sdk",
    },
  ],
});
