#!/bin/bash
# Run all examples and capture results
set -a
source .env 2>/dev/null
set +a

TIMEOUT=60
RESULTS_FILE="examples/_results.jsonl"
> "$RESULTS_FILE"

run_example() {
  local file="$1"
  local name=$(basename "$file" .ts)
  local dir=$(dirname "$file" | sed 's|examples/||')
  if [ "$dir" = "examples" ]; then dir="root"; fi
  local label="$dir/$name"
  if [ "$dir" = "root" ]; then label="$name"; fi

  echo -n "Running $label ... "

  local output
  local exit_code
  output=$(timeout $TIMEOUT npx ts-node --compiler-options '{"experimentalDecorators":true,"esModuleInterop":true,"target":"ES2022","module":"commonjs","moduleResolution":"node","strict":false,"skipLibCheck":true}' "$file" 2>&1)
  exit_code=$?

  # Extract workflow ID if present
  local wf_id=$(echo "$output" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)

  # Extract status
  local status_line=$(echo "$output" | grep -i "status:" | tail -1)

  if [ $exit_code -eq 0 ]; then
    echo "OK"
    echo "{\"file\":\"$label\",\"result\":\"OK\",\"exit_code\":0,\"workflow_id\":\"$wf_id\",\"status\":\"$status_line\"}" >> "$RESULTS_FILE"
  elif [ $exit_code -eq 124 ]; then
    echo "TIMEOUT"
    echo "{\"file\":\"$label\",\"result\":\"TIMEOUT\",\"exit_code\":124,\"workflow_id\":\"$wf_id\",\"status\":\"\"}" >> "$RESULTS_FILE"
  else
    local err_line=$(echo "$output" | grep -iE "error|Error|fail|reject" | head -1 | tr '"' "'")
    echo "FAIL ($exit_code)"
    echo "{\"file\":\"$label\",\"result\":\"FAIL\",\"exit_code\":$exit_code,\"workflow_id\":\"$wf_id\",\"status\":\"$status_line\",\"error\":\"$err_line\"}" >> "$RESULTS_FILE"
  fi
}

echo "=== Running all examples ==="
echo ""

# Core examples
for f in examples/quickstart.ts examples/helloworld.ts examples/dynamic-workflow.ts examples/kitchensink.ts examples/workflow-ops.ts examples/workers-e2e.ts examples/test-workflows.ts examples/worker-configuration.ts examples/task-context.ts examples/task-configure.ts examples/event-listeners.ts examples/metrics.ts; do
  run_example "$f"
done

# Skip express-worker-service (it runs a server and doesn't exit)
echo "Skipping express-worker-service.ts (long-running server)"
echo "{\"file\":\"express-worker-service\",\"result\":\"SKIPPED\",\"exit_code\":-1,\"workflow_id\":\"\",\"status\":\"Long-running server\"}" >> "$RESULTS_FILE"

# Agentic workflows (require LLM integration - will likely fail gracefully)
for f in examples/agentic-workflows/*.ts; do
  run_example "$f"
done

# API journeys
for f in examples/api-journeys/*.ts; do
  run_example "$f"
done

# Advanced
for f in examples/advanced/*.ts; do
  run_example "$f"
done

echo ""
echo "=== Done ==="
echo "Results in $RESULTS_FILE"
