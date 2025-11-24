import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "./src/open-api/spec/spec.json",
  output: "src/open-api/generated",
  plugins: [
    {
      asClass: true,
      name: "@hey-api/sdk",
    },
  ],
});
