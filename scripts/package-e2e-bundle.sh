#!/usr/bin/env bash
set -euo pipefail

# ── Package the agent e2e suite as a standalone bundle ───────────────────────
# Builds conductor-ai-e2e-typescript-<version>.tar.gz: a self-contained npm
# project carrying the e2e test sources (repo-root e2e/), pinned to the
# published @io-orkes/conductor-javascript@<version> package (no SDK source
# vendored).
#
# Downstream repos (e.g. orkes-io/orkes-conductor) download the bundle from
# the javascript-sdk GitHub release and run it against their own server build.
# This replaces the agentspan-sdk-e2e-typescript-* bundles formerly cut from
# agentspan-ai/agentspan — javascript-sdk is now the canonical home of these
# suites. Mirrors conductor-oss/java-sdk's conductor-ai-e2e/release/ export.
#
# Usage:
#   ./scripts/package-e2e-bundle.sh --version 4.0.0-rc1 [--out DIR]
#
# Packaging is static (no compilation, no network) — the pinned version does
# not have to be on npm yet, so this can run before the publish job finishes.

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HERE/.." && pwd)"

VERSION=""
OUT_DIR="$HERE/e2e-bundle-dist"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    --out)     OUT_DIR="$2"; shift 2 ;;
    *) echo "ERROR: unknown arg '$1' (want --version X.Y.Z [--out DIR])" >&2; exit 1 ;;
  esac
done

[[ -n "$VERSION" ]] || { echo "ERROR: --version is required" >&2; exit 1; }

NAME="conductor-ai-e2e-typescript-$VERSION"
STAGE="$OUT_DIR/$NAME"

echo "Packaging agent e2e bundle ($NAME)..."
rm -rf "$STAGE"
mkdir -p "$STAGE"

# Suites import the SDK by package name (@io-orkes/conductor-javascript/agents),
# so the sources copy over verbatim — the in-repo jest moduleNameMapper aliases
# to src/ simply don't exist here and imports resolve from node_modules.
cp -R "$REPO_ROOT/e2e" "$STAGE/e2e"

cat > "$STAGE/package.json" <<'EOF'
{
  "name": "conductor-ai-e2e-typescript",
  "version": "@VERSION@",
  "private": true,
  "scripts": {
    "test": "jest --config jest.config.mjs --forceExit"
  },
  "dependencies": {
    "@io-orkes/conductor-javascript": "@VERSION@"
  },
  "devDependencies": {
    "@jest/globals": "^30.1.3",
    "@types/node": "^22.0.0",
    "jest": "^30.1.3",
    "jest-junit": "^16.0.0",
    "ts-jest": "^29.4.2",
    "tsx": "^4.21.0",
    "typescript": "^5.9.2",
    "zod": "^3.25.76",
    "zod-to-json-schema": "^3.23.5"
  }
}
EOF

# Standalone jest config: same shape as the repo's jest.e2e.config.mjs but with
# NO moduleNameMapper SDK aliases — the package import must resolve from the
# installed npm package, proving the published artifact.
cat > "$STAGE/jest.config.mjs" <<'EOF'
export default {
  preset: "ts-jest",
  testMatch: ["**/e2e/**/*.test.ts"],
  testTimeout: 60_000,
  // Credential names are unique per suite; 3 workers keeps server load
  // manageable (mirrors the in-repo jest.e2e.config.mjs).
  maxWorkers: 3,
  reporters: [
    "default",
    ["jest-junit", { outputDirectory: "results", outputName: "junit-e2e.xml" }],
  ],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      // isolatedModules puts ts-jest in transpile-only mode (as in the repo's
      // root tsconfig): suites dynamically import optional provider SDKs
      // (@anthropic-ai/sdk, openai, @anthropic-ai/mcp) inside try/catch and
      // skip when absent — full type-check would hard-fail on those
      // specifiers. Package-subpath resolution (…/agents) happens at runtime
      // via jest's package-exports support.
      { tsconfig: { module: "commonjs", esModuleInterop: true, isolatedModules: true } },
    ],
  },
};
EOF

cat > "$STAGE/run.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
# Runs the agent e2e suite against a live Conductor server with the agent
# runtime enabled (conductor-oss >= 3.32.0-rc.8, or orkes-conductor with
# agentspan.embedded=true).
#
# Required services (NOT started by this script):
#   - Conductor server → AGENTSPAN_SERVER_URL (default http://localhost:8080/api)
#   - mcp-testkit      → MCP_TESTKIT_URL      (default http://localhost:3001)
# Optional:
#   - AGENTSPAN_LLM_MODEL (default openai/gpt-4o-mini); the provider API key
#     must be configured on the SERVER — the suites never read it.
#   - AGENTSPAN_CLI_PATH (default `agentspan` on PATH) — CLI suites skip if absent.
#
# Requires node >= 20. Usage: ./run.sh [extra jest args]
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
npm install --no-audit --no-fund --loglevel=error
npx jest --config jest.config.mjs --forceExit "$@"
npx tsx e2e/generate-report.ts results/junit-e2e.xml results/report.html || true
echo "Results: $HERE/results/junit-e2e.xml (report.html alongside)"
EOF
chmod +x "$STAGE/run.sh"

cat > "$STAGE/README.md" <<'EOF'
# Conductor Agent SDK (typescript) — E2E suite @VERSION@

Self-contained end-to-end tests for the Conductor JavaScript/TypeScript agent
SDK, pinned to release **@VERSION@**. Resolves
`@io-orkes/conductor-javascript@@VERSION@` from npm — no SDK source is
vendored. Cut from
[conductor-oss/javascript-sdk](https://github.com/conductor-oss/javascript-sdk)
(`e2e/`); supersedes the `agentspan-sdk-e2e-typescript-*` bundles formerly
released from agentspan-ai/agentspan.

## Prerequisites (you provide these)

| Requirement                       | Env var                | Default                     |
|-----------------------------------|------------------------|-----------------------------|
| node >= 20                        | —                      | —                           |
| Conductor server w/ agent runtime | `AGENTSPAN_SERVER_URL` | `http://localhost:8080/api` |
| LLM model                         | `AGENTSPAN_LLM_MODEL`  | `openai/gpt-4o-mini`        |
| mcp-testkit (MCP suites)          | `MCP_TESTKIT_URL`      | `http://localhost:3001`     |
| agentspan CLI (CLI suites)        | `AGENTSPAN_CLI_PATH`   | `agentspan` (on `PATH`)     |

The server needs the agent runtime: conductor-oss `>= 3.32.0-rc.8`, or
orkes-conductor booted with `agentspan.embedded=true`. LLM provider API keys
(e.g. `OPENAI_API_KEY`) go to the **server** process, not this suite.
Suites that need an absent optional service (CLI, LangGraph wrappers) skip
rather than fail.

## Run

```bash
./run.sh                                        # full suite
./run.sh -t 'suite1'                            # filter, plus any jest args
```

JUnit XML lands in `results/junit-e2e.xml`, HTML report in
`results/report.html`.

## Testing an unreleased SDK

```bash
npm install @io-orkes/conductor-javascript@<other-version-or-tarball>
npx jest --config jest.config.mjs --forceExit
```
EOF

# Stamp the version everywhere (skip binary fixtures).
find "$STAGE" -type f ! -name '*.png' ! -name '*.jpg' ! -name '*.jpeg' \
    ! -name '*.gif' ! -name '*.webp' ! -name '*.pdf' -print0 \
  | xargs -0 sed -i.bak "s/@VERSION@/$VERSION/g"
find "$STAGE" -name '*.bak' -delete

mkdir -p "$OUT_DIR"
tar -czf "$OUT_DIR/$NAME.tar.gz" -C "$OUT_DIR" "$NAME"
rm -rf "$STAGE"

echo "OK: $OUT_DIR/$NAME.tar.gz"
