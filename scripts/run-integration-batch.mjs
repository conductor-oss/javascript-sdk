#!/usr/bin/env node
/**
 * Runs one batch of integration tests (by file count). Splits src/integration-tests/*.test.* into 5 batches.
 * Usage: node scripts/run-integration-batch.mjs <batchIndex 0-4> [-- jest args...]
 * Example: npm run test:integration:v5:batch -- 0
 * Example: npm run test:integration:v5:batch -- 2 -- --ci --coverage
 */

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const INTEGRATION_DIR = path.join(__dirname, "..", "src", "integration-tests");
const TOTAL_BATCHES = 5;

function getIntegrationTestFiles() {
  const files = fs.readdirSync(INTEGRATION_DIR);
  return files
    .filter((f) => /\.test\.(ts|tsx|js|jsx)$/i.test(f))
    .sort();
}

function getPatternForBatch(batchIndex) {
  const files = getIntegrationTestFiles();
  const chunkSize = Math.ceil(files.length / TOTAL_BATCHES);
  const start = batchIndex * chunkSize;
  const end = Math.min(start + chunkSize, files.length);
  const batchFiles = files.slice(start, end);
  // Match full filename so e.g. MetadataClient.test.ts and MetadataClient.complete.test.ts stay distinct
  return batchFiles.map((f) => f.replace(/\./g, "\\.")).join("|");
}

const raw = process.argv[2];
const batchIndex = raw === undefined ? 0 : parseInt(raw, 10);
if (Number.isNaN(batchIndex) || batchIndex < 0 || batchIndex >= TOTAL_BATCHES) {
  console.error(`Usage: run-integration-batch.mjs <batchIndex 0-${TOTAL_BATCHES - 1}> [-- jest args...]`);
  console.error(`Example: npm run test:integration:v5:batch -- 0`);
  console.error(`Example: npm run test:integration:v5:batch -- 2 -- --ci --coverage`);
  process.exit(1);
}

if (raw === undefined) {
  console.log(`Running integration batch 0 (default). Use "npm run test:integration:v5:batch -- <0-4>" for a specific batch.\n`);
}

const rest = process.argv.slice(raw === undefined ? 2 : 3).filter((a) => a !== "--");
const pattern = getPatternForBatch(batchIndex);

const jestArgs = [
  "--force-exit",
  "--detectOpenHandles",
  "--testMatch=**/src/integration-tests/*.test.[jt]s?(x)",
  `--testPathPatterns=${pattern}`,
  ...rest,
];

const result = spawnSync("npx", ["jest", ...jestArgs], {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
