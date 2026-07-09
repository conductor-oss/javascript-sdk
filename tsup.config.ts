import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "index.ts",
    "agents/index": "src/agents/index.ts",
    "agents/testing/index": "src/agents/testing/index.ts",
    "agents/wrappers/ai": "src/agents/wrappers/ai.ts",
    "agents/wrappers/langgraph": "src/agents/wrappers/langgraph.ts",
    "agents/wrappers/langchain": "src/agents/wrappers/langchain.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "node24",
  splitting: false,
  // Optional peers are resolved lazily at runtime (createRequire/dynamic import);
  // marking them external keeps esbuild from trying to bundle them.
  external: [
    "undici",
    "zod",
    "zod-to-json-schema",
    "ai",
    "@langchain/core",
    "@langchain/langgraph",
  ],
});
