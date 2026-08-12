#!/usr/bin/env bash
#
# Verify the published towerjs package structure and exports map.
#
# Because the @towerjs/* packages are unpublished (workspace:* deps), this test
# extracts tarballs directly and verifies the artifact that consumers receive:
#   1. package.json exports map has all documented subpaths
#   2. Each subpath resolves to an existing file
#   3. TypeScript declaration files (.d.ts) are present for every subpath
#   4. The JS files are structurally valid (parse without syntax errors)
#
# This tests what's UNIQUE to the published artifact. Full runtime execution
# (which needs better-auth, react, next, etc.) is covered by in-monorepo tests.
#
# Usage: bash scripts/verify-tarball.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACK_DIR="$(mktemp -d)"
EXTRACT_DIR="$(mktemp -d)"
FAILED=0

cleanup() {
  rm -rf "$PACK_DIR" "$EXTRACT_DIR"
}
trap cleanup EXIT

# Expected public subpaths (must match towerjs/package.json exports)
SUBPATHS=(
  "."
  "./blueprint"
  "./foundation"
  "./gatehouse"
  "./gatehouse/react-server"
  "./gatehouse/next"
  "./gatehouse/client"
  "./vault"
  "./next"
  "./courier"
  "./runtime"
)

echo "=== Packing towerjs ==="
cd "$ROOT"
(cd packages/towerjs && pnpm pack --pack-destination "$PACK_DIR" 2>/dev/null)

TARBALL=$(ls "$PACK_DIR"/towerjs-*.tgz 2>/dev/null | head -1)
if [ -z "$TARBALL" ]; then
  echo "ERROR: towerjs tarball not found"
  exit 1
fi

echo "=== Extracting tarball ==="
rm -rf "${EXTRACT_DIR:?}/"*
mkdir -p "$EXTRACT_DIR"
tar -xzf "$TARBALL" -C "$EXTRACT_DIR" --strip-components=1 2>/dev/null

echo ""
echo "=== Verifying exports map ==="
# Read the exports field from the extracted package.json
EXPORTS_JSON=$(node -e "console.log(JSON.stringify(require('$EXTRACT_DIR/package.json').exports))")

echo "  Checking ${#SUBPATHS[@]} documented subpaths..."
for subpath in "${SUBPATHS[@]}"; do
  # Check that the exports map has this subpath
  HAS_EXPORT=$(node -e "
    const exports = $EXPORTS_JSON;
    const key = '$subpath';
    console.log(exports[key] !== undefined ? 'yes' : 'no');
  ")

  if [ "$HAS_EXPORT" = "no" ]; then
    echo "  FAIL: exports map missing subpath '$subpath'"
    FAILED=1
    continue
  fi

  # Resolve the export target to a file path
  RESOLVED=$(node -e "
    const exports = $EXPORTS_JSON;
    const key = '$subpath';
    const val = exports[key];
    // Handle both string and {default, types} shapes
    const target = typeof val === 'string' ? val : (val.default || val.types);
    console.log(target);
  ")

  if [ -z "$RESOLVED" ]; then
    echo "  FAIL: could not resolve export for '$subpath'"
    FAILED=1
    continue
  fi

  # Check the resolved file exists
  # Resolve relative to package root
  RESOLVED_PATH="$EXTRACT_DIR/$RESOLVED"
  if [ ! -f "$RESOLVED_PATH" ]; then
    echo "  FAIL: '$subpath' → '$RESOLVED' (file not found)"
    FAILED=1
    continue
  fi

  # Check .d.ts exists for this subpath
  DTS_FILE="$EXTRACT_DIR/${RESOLVED%.js}.d.ts"
  if [ ! -f "$DTS_FILE" ]; then
    echo "  FAIL: '$subpath' missing .d.ts (expected ${RESOLVED%.js}.d.ts)"
    FAILED=1
    continue
  fi

  # Verify the JS file is syntactically valid
  if ! node --check "$RESOLVED_PATH" 2>/dev/null; then
    echo "  FAIL: '$subpath' JS file has syntax errors"
    FAILED=1
    continue
  fi

  echo "  OK: $subpath → $RESOLVED"
done

echo ""
echo "=== Checking for stale artifacts (issue #27) ==="
STALE=0
if find "$EXTRACT_DIR/dist" -name "*.tsbuildinfo" 2>/dev/null | grep -q .; then
  echo "  WARN: tsbuildinfo found in dist (should be excluded from tarball)"
  STALE=1
fi
# .map files are acceptable (sourcemaps), but tsbuildinfo is not
if [ "$STALE" -eq 0 ]; then
  echo "  OK: no stale build artifacts"
fi

if [ "$FAILED" -eq 0 ]; then
  echo ""
  echo "=== TARBALL STRUCTURE VERIFICATION PASSED ==="
else
  echo ""
  echo "=== TARBALL STRUCTURE VERIFICATION FAILED ==="
  exit 1
fi
