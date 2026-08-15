#!/usr/bin/env bash
#
# v0.1.0 Release Gate Checklist
#
# These checks verify the Tower product from a consumer's perspective. They
# require network access and are intended to be run manually before tagging
# v0.1.0, not as part of the standard CI test suite.
#
# Usage: bash scripts/release-gate.sh
#
# Prerequisites:
#   - Node.js >= 22.6
#   - pnpm >= 9
#   - Docker (for Postgres-dependent checks)
#   - Network access (for create-next-app)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAILED=0

check() {
  local name="$1"
  echo ""
  echo "=== $1 ==="
}

pass() {
  echo "  ✓ $*"
}

fail() {
  echo "  ✗ $*"
  FAILED=1
}

pending() {
  echo "  ○ $* (manual)"
}

cd "$ROOT"

check "1. Build all packages"
if pnpm build >/dev/null 2>&1; then
  pass "Build succeeds"
else
  fail "Build failed"
fi

check "2. Unit + contract tests"
if pnpm test >/dev/null 2>&1; then
  pass "All tests pass"
else
  fail "Tests failed"
fi

check "3. Typecheck"
if pnpm typecheck >/dev/null 2>&1; then
  pass "Typecheck clean"
else
  fail "Typecheck errors"
fi

check "4. Lint"
if pnpm lint >/dev/null 2>&1; then
  pass "Lint clean"
else
  fail "Lint warnings/errors"
fi

check "5. Dependency rules"
if pnpm check:deps >/dev/null 2>&1; then
  pass "Dependency rules pass"
else
  fail "Dependency rule violations"
fi

check "6. Tarball structure"
if bash scripts/verify-tarball.sh >/dev/null 2>&1; then
  pass "Tarball structure valid"
else
  fail "Tarball verification failed"
fi

check "6b. Documentation examples"
if bash scripts/verify-docs.sh >/dev/null 2>&1; then
  pass "All documented examples compile"
else
  fail "Documentation examples fail to compile"
fi

check "7. Generated app (requires network)"
echo ""
echo "  Manual steps — run these and verify each succeeds:"
echo "    1. pnpm db:up  ← start Postgres container"
echo "    2. pnpm create tower test-app"
echo "    3. Select: no tailwind (or tailwind), modules: gatehouse + vault"
echo "    4. cd test-app"
echo "    5. pnpm install"
echo "    6. Set DATABASE_URL in .env"
echo "    7. pnpm build  ← THIS IS THE KEY GATE"
echo "    8. pnpm dev    ← app should boot"
echo ""
echo "  If 'pnpm build' exits 0, this gate passes."

check "8. E2E auth flow (requires Docker + network)"
echo ""
echo "  Running: pnpm test:e2e:docker  ← auto-starts Postgres, runs the suite, tears Postgres down"
if pnpm test:e2e:docker >/dev/null 2>&1; then
  pass "All e2e auth flows pass (Postgres auto-started and torn down)"
else
  fail "E2E auth flows failed"
fi

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "=== AUTOMATED GATES PASSED ==="
  echo "Complete the manual gate (#7, generated app) before releasing."
else
  echo "=== SOME GATES FAILED ==="
  exit 1
fi
