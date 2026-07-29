#!/usr/bin/env node
/**
 * Verify the documented agent configuration contract.
 *
 * docs/agents/reference/agent-schema.json documents the wire shape emitted by
 * AgentConfigSerializer under `agentConfig`. That shape is shared with the
 * Python and Java SDKs and consumed by the server's agent compiler, so drift is
 * a cross-SDK compatibility bug rather than a docs nit -- and nothing validated
 * it until now.
 *
 * Checks:
 *   1. The schema file exists, parses, and compiles under its declared dialect.
 *   2. Every serialized agent config fixture in e2e/_configs/ validates.
 *   3. The structural invariants the contract depends on still hold.
 *   4. The canonical documentation paths exist.
 *
 * Follows scripts/verify-dist.mjs in style; the Node equivalent of java-sdk's
 * tools/agent-schema/verify.py.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const SCHEMA_PATH = "docs/agents/reference/agent-schema.json";
const CORPUS_DIR = "e2e/_configs";

const failures = [];
const fail = (message) => failures.push(message);

// ── 1. Schema loads and compiles under its declared dialect ─────────────────
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

// Pick the Ajv build matching $schema. Ajv's default export is draft-07; 2019-09
// and 2020-12 have their own entrypoints.
const dialect = String(schema.$schema ?? "");
const ajvModule = dialect.includes("2020-12")
  ? "ajv/dist/2020.js"
  : dialect.includes("2019-09")
    ? "ajv/dist/2019.js"
    : "ajv";

const { default: Ajv } = await import(ajvModule);
const ajv = new Ajv({ allErrors: true, strict: false });

let validate;
try {
  validate = ajv.compile(schema);
} catch (error) {
  console.error(
    `FAIL ${SCHEMA_PATH} does not compile as ${dialect || "draft-07"}: ${error.message}`,
  );
  process.exit(1);
}
console.log(`Compiled ${SCHEMA_PATH} as ${dialect || "draft-07"}.`);

// ── 2. Every fixture validates ──────────────────────────────────────────────
if (!existsSync(CORPUS_DIR)) {
  fail(`${CORPUS_DIR} is missing -- the schema has nothing to validate against.`);
} else {
  const fixtures = readdirSync(CORPUS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  if (fixtures.length === 0) {
    fail(`${CORPUS_DIR} contains no fixtures -- the schema would be unverified.`);
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

  console.log(`Validated ${fixtures.length} agent configs against the schema.`);
}

// ── 3. Structural invariants ────────────────────────────────────────────────
// Resolved through the root $ref so this survives restructuring, as long as the
// guarantees themselves hold.
const defs = schema.$defs ?? schema.definitions ?? {};
const rootRef = String(schema.$ref ?? "");
const rootName = rootRef.replace(/^#\/(\$defs|definitions)\//, "");
const agentConfig = rootRef ? defs[rootName] : schema;

const assertions = [
  ["the root resolves to an object schema", () => !!agentConfig && typeof agentConfig === "object"],
  [
    "name is required (it becomes the workflow definition name)",
    () => (agentConfig?.required ?? []).includes("name"),
  ],
  [
    "name is constrained to an identifier pattern",
    () => typeof agentConfig?.properties?.name?.pattern === "string",
  ],
  [
    "agents is recursive, so sub-agents are validated by the same schema",
    () => /agentConfig$/.test(String(agentConfig?.properties?.agents?.items?.$ref ?? "")),
  ],
  [
    "tools reference the shared tool definition",
    () => /tool$/.test(String(agentConfig?.properties?.tools?.items?.$ref ?? "")),
  ],
  ["a tool definition exists", () => !!defs.tool && typeof defs.tool === "object"],
  [
    "agentConfig stays closed, so adding a serializer field fails this check until the contract is updated",
    () => agentConfig?.additionalProperties === false,
  ],
  [
    "tool stays open, since tool config is type-specific and not enumerable here",
    () => defs.tool?.additionalProperties !== false,
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
for (const required of [
  "docs/agents/reference/agent-schema.json",
  "docs/agents/reference/agent-schema.md",
  "docs/agents/README.md",
  "docs/README.md",
  "docs/documentation-standard.md",
]) {
  if (!existsSync(required)) fail(`${required} is missing.`);
}

// docs/agents/generated/ was never part of this SDK and must not appear.
for (const forbidden of ["docs/agents/generated"]) {
  if (existsSync(forbidden)) fail(`${forbidden} must not exist.`);
}

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s):`);
  for (const f of failures) console.error(`  FAIL ${f}`);
  process.exit(1);
}

console.log(`All ${assertions.length} schema invariants and documentation paths verified.`);
