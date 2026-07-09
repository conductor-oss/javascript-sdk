#!/usr/bin/env bash
#
# Run one cell of the v4 integration-test matrix, mirroring the
# `integration-tests-v4-sm` job in .github/workflows/pull_request.yml.
#
# Required (shell env or .env at repo root):
#   CONDUCTOR_SERVER_URL, CONDUCTOR_AUTH_KEY, CONDUCTOR_AUTH_SECRET
#
# Usage:
#   scripts/run-integration-v4.sh [-n|--node 20|22|24] [-s|--shard 1|2|3]
#                                 [-t|--test <path|pattern>] [-c|--coverage] [-- jest args]
# Examples:
#   scripts/run-integration-v4.sh                       # node 24, shard 1/3
#   scripts/run-integration-v4.sh --node 22 --shard 2   # node 22, shard 2/3
#   scripts/run-integration-v4.sh --coverage            # include the coverage report (off by default)
#   # Run a single test file (--test disables sharding so the file isn't filtered out):
#   scripts/run-integration-v4.sh --test src/integration-tests/WorkflowExecutor.test.ts
#   scripts/run-integration-v4.sh --node 20 --test WorkflowExecutor
#   scripts/run-integration-v4.sh -- --testPathPatterns="WorkflowExecutor"
set -euo pipefail

NODE_VERSION=24
SHARD=1
TOTAL_SHARDS=3
TEST_PATTERN=""
COVERAGE=0

# Print the leading comment block (everything after the shebang up to the first
# non-comment line) as help text, so it stays in sync with the header above.
usage() { awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "$0"; }

extra=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -n|--node)  NODE_VERSION="${2:?--node needs a value}"; shift 2 ;;
    -s|--shard) SHARD="${2:?--shard needs a value}"; shift 2 ;;
    -t|--test)  TEST_PATTERN="${2:?--test needs a path or pattern}"; shift 2 ;;
    -c|--coverage) COVERAGE=1; shift ;;
    -h|--help)  usage; exit 0 ;;
    --)         shift; extra=("$@"); break ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

case "$NODE_VERSION" in 20|22|24) ;; *) echo "Error: --node must be 20, 22, or 24 (got '$NODE_VERSION')" >&2; exit 1 ;; esac
case "$SHARD" in 1|2|3) ;; *) echo "Error: --shard must be 1, 2, or 3 (got '$SHARD')" >&2; exit 1 ;; esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

missing=()
for var in CONDUCTOR_SERVER_URL CONDUCTOR_AUTH_KEY CONDUCTOR_AUTH_SECRET; do
  if [[ -z "${!var:-}" ]]; then
    missing+=("$var")
  fi
done
if (( ${#missing[@]} > 0 )); then
  echo "Error: missing required environment variable(s): ${missing[*]}" >&2
  echo "Set them in your shell or in a .env file at the repo root (see .env.example)." >&2
  exit 1
fi

export ORKES_BACKEND_VERSION=4
export CONDUCTOR_REQUEST_TIMEOUT_MS="${CONDUCTOR_REQUEST_TIMEOUT_MS:-120000}"
export CONDUCTOR_RETRY_SERVER_ERRORS="${CONDUCTOR_RETRY_SERVER_ERRORS:-true}"

test_cmd=(npm run test:integration:v4 -- --ci --runInBand --testTimeout=120000)
if [[ "${COVERAGE}" == "1" ]]; then
  test_cmd+=(--coverage)
fi
if [[ -n "${TEST_PATTERN}" ]]; then
  # Targeting a specific test: don't shard, or the file may be filtered out.
  test_cmd+=("--testPathPatterns=${TEST_PATTERN}")
else
  test_cmd+=("--shard=${SHARD}/${TOTAL_SHARDS}")
fi
if (( ${#extra[@]} > 0 )); then
  test_cmd+=("${extra[@]}")
fi

if [[ -n "${TEST_PATTERN}" ]]; then
  echo "Running v4 integration tests | node ${NODE_VERSION} | test '${TEST_PATTERN}' | server ${CONDUCTOR_SERVER_URL}"
else
  echo "Running v4 integration tests | node ${NODE_VERSION} | shard ${SHARD}/${TOTAL_SHARDS} | server ${CONDUCTOR_SERVER_URL}"
fi

if command -v fnm >/dev/null 2>&1; then
  fnm exec --using="${NODE_VERSION}" -- "${test_cmd[@]}"
else
  current_major="$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/')"
  if [[ "${current_major}" != "${NODE_VERSION}" ]]; then
    echo "Error: requested Node ${NODE_VERSION} but current Node is v${current_major:-unknown} and fnm is not installed." >&2
    echo "Install fnm (see SDK_DEVELOPMENT.md) or switch your Node version manually before running." >&2
    exit 1
  fi
  "${test_cmd[@]}"
fi
