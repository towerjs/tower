#!/usr/bin/env bash
#
# Generated-app test (create-tower scaffolding path).
#
# Verifies the consumer experience of scaffolding a brand-new app: packs the
# real tower packages, runs `tower create` through the local create-tower bin
# with non-interactive flags, then installs the generated project, loads its
# config through the tower CLI, and builds it. Runs once for TypeScript and
# once for plain JavaScript.
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
echo "  Running: tower create (TypeScript + JavaScript, from local packs) + npm install + tower about + npm run build"
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

scaffold_and_verify() {
  local app_name="$1"
  shift
  cd "$TEST_APP_DIR"
  if TOWER_PACK_DIR="$PACK_DIR" \
     node "$ROOT/packages/create-tower/dist/index.js" "$app_name" "$@" >/dev/null 2>&1 && \
     cd "$TEST_APP_DIR/$app_name" && npm install >/dev/null 2>&1 && \
     npx tower about >/dev/null 2>&1 && \
     npm run build >/dev/null 2>&1; then
    echo "  PASS: $app_name"
  else
    echo "  FAIL: $app_name"
    exit 1
  fi
}

scaffold_and_verify test-app --no-tailwind --modules vault,gatehouse --vault skip
scaffold_and_verify js-app --js --no-tailwind --modules vault,gatehouse --vault skip

echo ""
echo "=== GENERATED APP TEST PASSED ==="