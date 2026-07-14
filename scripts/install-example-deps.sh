#!/usr/bin/env bash
# Installs the per-framework dependencies for examples/agents/<framework>/.
# The top-level and quickstart agent examples need no install — they resolve
# @io-orkes/conductor-javascript/agents straight to the repo sources via
# examples/agents/tsconfig.json (run them with `npx tsx`).
set -euo pipefail
cd "$(dirname "$0")/.."
for dir in examples/agents/vercel-ai examples/agents/langgraph examples/agents/openai examples/agents/adk; do
  if [ -f "$dir/package.json" ]; then
    echo "Installing deps for $dir..."
    (cd "$dir" && npm install --legacy-peer-deps)
  fi
done
echo "Done."
