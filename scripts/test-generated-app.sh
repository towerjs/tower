#!/usr/bin/env bash
#
# Generated-app test (create-tower scaffolding path).
#
# Verifies the consumer experience of scaffolding a brand-new app: packs the
# real tower packages, runs `tower create` through the local create-tower bin
# with non-interactive flags, then installs and builds the generated project.
#
# This is the one check that can't live in the unit test suite — it needs
# network (create-next-app) and does a real npm install + next build. Run it
# before tagging a release.
#
# Usage: bash scripts/test-generated-app.sh
#
# Prerequisites:
#   - Node.js >= 22.6
#   - pnpm >= 9
#   - Network access (for create-next-app)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT"

echo "=== Generated app (create-tower scaffolding path, requires network) ==="
echo "  Running: tower create test-app (from local packs) + npm install + npm run build"
echo ""

TEST_APP_DIR="$(mktemp -d)"
PACK_DIR="$TEST_APP_DIR/packs"
mkdir -p "$PACK_DIR"
for pkg in towerjs foundation blueprint vault gatehouse courier edge scribe; do
  (cd "$ROOT/packages/$pkg" && pnpm pack --pack-destination "$PACK_DIR" >/dev/null 2>&1)
done

cleanup() {
  rm -rf "$TEST_APP_DIR"
}
trap cleanup EXIT

if cd "$TEST_APP_DIR" && \
   TOWER_PACK_DIR="$PACK_DIR" \
   node "$ROOT/packages/create-tower/dist/index.js" test-app --no-tailwind --modules vault,gatehouse --vault skip >/dev/null 2>&1 && \
   cd "$TEST_APP_DIR/test-app" && npm install >/dev/null 2>&1 && npm run build >/dev/null 2>&1; then
  echo ""
  echo "=== GENERATED APP TEST PASSED ==="
else
  echo ""
  echo "=== GENERATED APP TEST FAILED ==="
  exit 1
fi