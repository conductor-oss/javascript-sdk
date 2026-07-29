#!/usr/bin/env node
/**
 * Verify the documented agent configuration contract.
 *
 * docs/agents/reference/agent-schema.json is the machine-readable contract for
 * the JSON this SDK sends to the Conductor server's agent compiler. The shape is
 * shared with the Python and Java SDKs, so drift is a cross-SDK compatibility
 * bug, not a docs nit.
 *
 * Checks:
 *   1. The schema file exists and is a valid draft-07 JSON Schema.
 *   2. Every serialized agent config in e2e/_configs/ validates against it.
 *   3. The structural invariants CI asserts in the sibling SDKs hold.
 *
 * Mirrors the intent of java-sdk's tools/agent-schema/verify.py, in the
 * Node-script style this repo already uses for scripts/verify-dist.mjs.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

import Ajv from "ajv";

const SCHEMA_PATH = "docs/agents/reference/agent-schema.json";
const CORPUS_DIR = "e2e/_configs";

const failures = [];
const fail = (message) => failures.push(message);

// ── 1. Schema loads and compiles ────────────────────────────────────────────
if (!existsSync(SCHEMA_PATH)) {
  console.error(`FAIL ${SCHEMA_PATH} is missing.`);
  process.exit(1);
}

let schema;
try {
  schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
} catch (error) {
  console.error(`FAIL ${SCHEMA_PATH} is not valid JSON: ${error.message}`);
  process.exit(1);
}

const ajv = new Ajv({ allErrors: true, strict: false });
let validate;
try {
  validate = ajv.compile(schema);
} catch (error) {
  console.error(`FAIL ${SCHEMA_PATH} is not a valid JSON Schema: ${error.message}`);
  process.exit(1);
}

// ── 2. Every fixture validates ──────────────────────────────────────────────
if (!existsSync(CORPUS_DIR)) {
  fail(`${CORPUS_DIR} is missing — the schema has nothing to validate against.`);
} else {
  const fixtures = readdirSync(CORPUS_DIR).filter((f) => f.endsWith(".json")).sort();

  if (fixtures.length === 0) {
    fail(`${CORPUS_DIR} contains no fixtures — the schema is unverified.`);
  }

  for (const fixture of fixtures) {
    const path = join(CORPUS_DIR, fixture);
    let config;
    try {
      config = JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
      fail(`${path} is not valid JSON: ${error.message}`);
      continue;
    }
    if (!validate(config)) {
      for (const err of validate.errors ?? []) {
        fail(`${path}${err.instancePath || ""} ${err.message}`);
      }
    }
  }

  console.log(`Validated ${fixtures.length} agent configs against ${SCHEMA_PATH}.`);
}

// ── 3. Structural invariants ────────────────────────────────────────────────
// The sibling SDKs assert these in CI. Keep them in sync.
const assertions = [
  [
    "name is required",
    () => Array.isArray(schema.required) && schema.required.includes("name"),
  ],
  [
    "name is constrained to an identifier pattern (it becomes a workflow definition name)",
    () => typeof schema.properties?.name?.pattern === "string",
  ],
  [
    "additionalProperties stays permissive, so a newer server field does not break an older SDK",
    () => schema.additionalProperties !== false,
  ],
  [
    "agents is recursive, so sub-agents are validated by the same schema",
    () => schema.properties?.agents?.items?.$ref === "#",
  ],
  [
    "tool.toolType is an enum including worker (the only type needing a local poller)",
    () => (schema.definitions?.tool?.properties?.toolType?.enum ?? []).includes("worker"),
  ],
  [
    "strategy enumerates all nine orchestration strategies",
    () => (schema.properties?.strategy?.enum ?? []).length === 9,
  ],
  [
    "guardrail.onFail enumerates raise/retry/fix/human",
    () => {
      const values = schema.definitions?.guardrail?.properties?.onFail?.enum ?? [];
      return ["raise", "retry", "fix", "human"].every((v) => values.includes(v));
    },
  ],
  [
    "handoff.target is required (a handoff without a target is meaningless)",
    () => (schema.definitions?.handoff?.required ?? []).includes("target"),
  ],
];

for (const [description, check] of assertions) {
  let ok = false;
  try {
    ok = check() === true;
  } catch {
    ok = false;
  }
  if (!ok) fail(`schema invariant violated: ${description}`);
}

// ── 4. Documentation invariants ─────────────────────────────────────────────
// Paths the canonical structure requires, and paths it must not reintroduce.
for (const required of [
  "docs/agents/reference/agent-schema.json",
  "docs/agents/reference/agent-schema.md",
  "docs/agents/README.md",
  "docs/README.md",
  "docs/documentation-standard.md",
]) {
  if (!existsSync(required)) fail(`${required} is missing.`);
}

// docs/agents/generated/ was never part of this SDK and must not appear;
// concepts/skills.md is covered inside multi-agent.md, matching the siblings.
for (const forbidden of ["docs/agents/generated", "docs/agents/concepts/skills.md"]) {
  if (existsSync(forbidden)) fail(`${forbidden} must not exist.`);
}

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s):`);
  for (const f of failures) console.error(`  FAIL ${f}`);
  process.exit(1);
}

console.log(`All ${assertions.length} schema invariants and documentation paths verified.`);
