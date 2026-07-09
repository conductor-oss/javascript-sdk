import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  {
    ignores: [
      "dist/**",
      "src/open-api/generated/**", // OpenAPI auto-generated code
      "src/open-api/spec/**", // OpenAPI spec and fix script
      "docs/**",
      "node_modules/**",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // src/agents is the Agentspan agent SDK merged in-tree. Its framework
    // serializers walk arbitrary langgraph/langchain object graphs, so it keeps
    // the upstream lint contract for these two rules (upstream pins both to
    // "warn" in its eslint config); everything else lints at this repo's level.
    // cli-bin/ and e2e/ are the same upstream codebase (Go CLI helper scripts
    // and live-server e2e suites, neither shipped to npm).
    files: ["src/agents/**", "cli-bin/**", "e2e/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",
    },
  },
  {
    // The migrated agent test suites use empty arrows/methods as mock stubs,
    // `!` for test-convenience narrowing, and `delete env[k]` teardown
    // throughout (ported verbatim from upstream). Stylistic-only relaxation,
    // scoped to the migrated tests.
    files: ["src/agents/__tests__/**", "e2e/**"],
    rules: {
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-dynamic-delete": "off",
    },
  },
  {
    // Migrated agent examples. Upstream excluded examples/ from linting
    // entirely; here they lint at repo level minus four rules the ~220
    // didactic files break en masse (deliberate partial snippets, `any`-typed
    // agent I/O). Everything else still reports as errors.
    files: ["examples/agents/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-empty-function": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
  }
);
