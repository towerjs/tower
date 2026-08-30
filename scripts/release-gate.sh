#!/usr/bin/env bash
#
# v0.2.0 Release Gate Checklist
#
# These checks verify the Tower product from a consumer's perspective. They
# require network access and are intended to be run manually before tagging
# v0.2.0, not as part of the standard CI test suite. Covers the full v0.2
# application layer: core restructure, models + factories, policies + social,
# tower db/make/dev/config, and the model-backed generated app.
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

check "2b. Integration tests"
if pnpm test:integration >/dev/null 2>&1; then
  pass "Integration tests pass (Postgres auto-provisioned and torn down)"
else
  fail "Integration tests failed"
fi

check "2c. Build test"
if pnpm test:build >/dev/null 2>&1; then
  pass "Next.js build test passes"
else
  fail "Build test failed"
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
echo "  Running: scripts/test-generated-app.sh  (tower create TS + JS, tower about, next build)"
if bash scripts/test-generated-app.sh >/dev/null 2>&1; then
  pass "Generated apps scaffold, load config, and build (TypeScript + JavaScript)"
else
  fail "Generated app test failed"
fi

check "8. E2E auth flow (requires Docker + network)"
echo ""
echo "  Running: pnpm test:e2e  ← provisions Postgres + browser, runs the suite, tears everything down"
if pnpm test:e2e >/dev/null 2>&1; then
  pass "All e2e auth flows pass (Postgres auto-started and torn down)"
else
  fail "E2E auth flows failed"
fi

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "=== ALL GATES PASSED ==="
  echo "Release gate complete — ready to tag and publish."
else
  echo "=== SOME GATES FAILED ==="
  exit 1
fi
