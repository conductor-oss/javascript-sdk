#!/usr/bin/env bash
#
# Spin up a local Conductor OSS stack and run the SDK integration suite against
# it, mirroring the `integration-tests-oss` job in
# .github/workflows/pull_request.yml. Orkes-only tests are gated out via
# CONDUCTOR_SERVER_TYPE=oss (see the test:integration:oss npm script).
#
# The stack (Conductor OSS + Postgres + httpbin) is defined in
# scripts/docker-compose-oss.yaml and is torn down automatically on exit.
#
# Test output is written to both stdout and a log file (default:
# scripts/oss-test-run.log, override with -l|--log) so it can be shared later.
#
# Usage:
#   scripts/run-integration-oss.sh [-t|--test <path|pattern>] [-l|--log <file>] [--keep-up] [-- jest args]
# Examples:
#   scripts/run-integration-oss.sh                       # full OSS-gated suite
#   scripts/run-integration-oss.sh --test WorkflowExecutor
#   scripts/run-integration-oss.sh --log /tmp/oss.log    # custom log path
#   scripts/run-integration-oss.sh --keep-up             # leave the stack running afterwards
#   scripts/run-integration-oss.sh -- --testPathPatterns="EventClient"
set -euo pipefail

TEST_PATTERN=""
KEEP_UP=0
LOG_FILE=""

# Print the leading comment block (everything after the shebang up to the first
# non-comment line) as help text, so it stays in sync with the header above.
usage() { awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "$0"; }

extra=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--test) TEST_PATTERN="${2:?--test needs a path or pattern}"; shift 2 ;;
    -l|--log)  LOG_FILE="${2:?--log needs a file path}"; shift 2 ;;
    --keep-up) KEEP_UP=1; shift ;;
    -h|--help) usage; exit 0 ;;
    --)        shift; extra=("$@"); break ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose-oss.yaml"
LOG_FILE="${LOG_FILE:-${SCRIPT_DIR}/oss-test-run.log}"
cd "${REPO_ROOT}"

# Guard: this script spins up and tests against a *local* OSS stack. If enterprise
# / remote server vars are already in the environment they would silently redirect
# the suite at a deployed server (e.g. sdkdev) and make Orkes-only tests pass,
# defeating the purpose of the OSS run. Refuse to run unless explicitly overridden.
if [[ "${ALLOW_REMOTE_SERVER:-0}" != "1" ]]; then
  offending=()
  [[ -n "${CONDUCTOR_AUTH_KEY:-}" ]] && offending+=("CONDUCTOR_AUTH_KEY")
  [[ -n "${CONDUCTOR_AUTH_SECRET:-}" ]] && offending+=("CONDUCTOR_AUTH_SECRET")
  if [[ -n "${CONDUCTOR_SERVER_URL:-}" \
        && ! "${CONDUCTOR_SERVER_URL}" =~ ^https?://(localhost|127\.0\.0\.1)(:|/|$) ]]; then
    offending+=("CONDUCTOR_SERVER_URL=${CONDUCTOR_SERVER_URL}")
  fi
  if (( ${#offending[@]} > 0 )); then
    echo "Error: refusing to run the OSS suite — remote/enterprise server vars are set:" >&2
    printf '  - %s\n' "${offending[@]}" >&2
    echo >&2
    echo "This script runs against a LOCAL OSS stack. Unset these first:" >&2
    echo "  unset CONDUCTOR_SERVER_URL CONDUCTOR_AUTH_KEY CONDUCTOR_AUTH_SECRET" >&2
    echo "Or set ALLOW_REMOTE_SERVER=1 to bypass this check intentionally." >&2
    exit 1
  fi
fi

CONDUCTOR_SERVER_URL="${CONDUCTOR_SERVER_URL:-http://localhost:8080/api}"
HEALTH_URL="${CONDUCTOR_SERVER_URL%/api}/health"

compose() { docker compose -f "${COMPOSE_FILE}" "$@"; }

cleanup() {
  if [[ "${KEEP_UP}" == "1" ]]; then
    echo "--keep-up set: leaving the OSS stack running. Tear down with:"
    echo "  docker compose -f ${COMPOSE_FILE} down -v"
    return
  fi
  echo "Tearing down Conductor OSS stack..."
  compose down -v || true
}
trap cleanup EXIT

echo "Starting Conductor OSS stack (${COMPOSE_FILE})..."
compose up -d

echo "Waiting for Conductor to be healthy at ${HEALTH_URL} ..."
# Portable wait loop using bash's built-in SECONDS (macOS has no `timeout`).
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"
deadline=$(( SECONDS + HEALTH_TIMEOUT ))
until curl -sf "${HEALTH_URL}" >/dev/null 2>&1; do
  if (( SECONDS >= deadline )); then
    echo "Error: Conductor did not become healthy within ${HEALTH_TIMEOUT}s." >&2
    compose logs conductor-server || true
    exit 1
  fi
  sleep 5
done
echo "Conductor is up."

export CONDUCTOR_SERVER_URL
export CONDUCTOR_SERVER_TYPE=oss
export HTTPBIN_SERVICE_HOSTNAME="${HTTPBIN_SERVICE_HOSTNAME:-httpbin}"
export CONDUCTOR_REQUEST_TIMEOUT_MS="${CONDUCTOR_REQUEST_TIMEOUT_MS:-120000}"
export CONDUCTOR_RETRY_SERVER_ERRORS="${CONDUCTOR_RETRY_SERVER_ERRORS:-true}"

test_cmd=(npm run test:integration:oss -- --ci --runInBand --testTimeout=120000)
if [[ -n "${TEST_PATTERN}" ]]; then
  # Targeting a specific test: pass it straight through as a path pattern.
  test_cmd+=("--testPathPatterns=${TEST_PATTERN}")
fi
if (( ${#extra[@]} > 0 )); then
  test_cmd+=("${extra[@]}")
fi

if [[ -n "${TEST_PATTERN}" ]]; then
  echo "Running OSS integration tests | test '${TEST_PATTERN}' | server ${CONDUCTOR_SERVER_URL}"
else
  echo "Running OSS integration tests | full OSS-gated suite | server ${CONDUCTOR_SERVER_URL}"
fi
echo "Writing output to ${LOG_FILE}"

# Tee to a log file for later sharing. pipefail ensures the test command's exit
# status (not tee's) is what propagates.
"${test_cmd[@]}" 2>&1 | tee "${LOG_FILE}"
