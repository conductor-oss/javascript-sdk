import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..");
const require = createRequire(import.meta.url);

// One entry per `exports` subpath in package.json — ESM (.mjs) and CJS (.js).
const entries = [
  "dist/index",
  "dist/agents/index",
  "dist/agents/testing/index",
  "dist/agents/wrappers/ai",
  "dist/agents/wrappers/langgraph",
  "dist/agents/wrappers/langchain",
];

for (const entry of entries) {
  await import(pathToFileURL(join(packageRoot, `${entry}.mjs`)).href);
  require(join(packageRoot, `${entry}.js`));
}

console.log(`Verified ${entries.length} dist entrypoints (ESM + CJS).`);
