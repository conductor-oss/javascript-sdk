#!/usr/bin/env bash
set -euo pipefail

# ── Validator for package-e2e-bundle.sh ──────────────────────────────────────
# Builds the bundle at a throwaway version and asserts:
#   - tarball exists and extracts to the expected dir
#   - carries an executable, syntactically-valid run.sh + README
#   - every e2e source/fixture from the repo made it in (file-count parity)
#   - the SDK is pinned at the version, with no @VERSION@ placeholder left
#   - package.json is valid JSON and the jest config has NO src aliases
#     (imports must resolve from the installed npm package)
# All checks are static + deterministic (no network, no install, no server).
# Run: ./scripts/test-package-e2e-bundle.sh

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HERE/.." && pwd)"
VERSION="9.9.9-test"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "  ok: $*"; }

"$HERE/package-e2e-bundle.sh" --version "$VERSION" --out "$WORK/dist" >/dev/null

NAME="conductor-ai-e2e-typescript-$VERSION"
TAR="$WORK/dist/$NAME.tar.gz"

[[ -f "$TAR" ]] || fail "tarball not produced ($TAR)"
pass "tarball produced"

mkdir -p "$WORK/x"
tar -xzf "$TAR" -C "$WORK/x"
ROOT="$WORK/x/$NAME"
[[ -d "$ROOT" ]] || fail "tarball does not extract to $NAME/"
pass "extracts to $NAME/"

[[ -f "$ROOT/run.sh" ]] || fail "missing run.sh"
[[ -x "$ROOT/run.sh" ]] || fail "run.sh not executable"
bash -n "$ROOT/run.sh"  || fail "run.sh has a bash syntax error"
[[ -f "$ROOT/README.md" ]] || fail "missing README.md"
pass "run.sh + README present and valid"

# Every e2e file (sources, configs, fixtures) made it into the bundle.
SRC_COUNT="$(find "$REPO_ROOT/e2e" -type f | wc -l | tr -d ' ')"
BUNDLE_COUNT="$(find "$ROOT/e2e" -type f | wc -l | tr -d ' ')"
[[ "$SRC_COUNT" == "$BUNDLE_COUNT" ]] \
  || fail "source parity: repo e2e/ has $SRC_COUNT files, bundle has $BUNDLE_COUNT"
pass "all $SRC_COUNT e2e files present"

# SDK pinned at the packaged version, no unexpanded placeholders anywhere.
python3 -c "
import json, sys
p = json.load(open(sys.argv[1]))
assert p['dependencies']['@io-orkes/conductor-javascript'] == sys.argv[2], \
    f'pin mismatch: {p[\"dependencies\"]}'
" "$ROOT/package.json" "$VERSION" \
  || fail "package.json does not pin @io-orkes/conductor-javascript@$VERSION"
if grep -rn '@VERSION@' "$ROOT" >/dev/null 2>&1; then
  fail "unexpanded @VERSION@ placeholder left in bundle"
fi
pass "SDK pinned at $VERSION, no placeholders"

# The standalone jest config must resolve the SDK from node_modules — no
# moduleNameMapper aliases pointing package imports back at repo sources.
[[ -f "$ROOT/jest.config.mjs" ]] || fail "missing jest.config.mjs"
! grep -q "src/agents" "$ROOT/jest.config.mjs" \
  || fail "jest.config.mjs still aliases the in-repo SDK source"
grep -q "jest-junit" "$ROOT/jest.config.mjs" \
  || fail "jest.config.mjs missing junit reporter"
pass "jest config standalone (no src aliases), junit reporter wired"

echo "ALL CHECKS PASSED"
