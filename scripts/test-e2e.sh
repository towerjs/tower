#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# If the caller already provided a database (e.g. a CI service), reuse it.
if [ -n "${DATABASE_URL:-}" ]; then
  cd "$ROOT"
  echo "==> Running e2e tests against existing DATABASE_URL"
  pnpm --filter @towerjs/with-nextjs test:e2e
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to run e2e tests when DATABASE_URL is unset. Install Docker Desktop, then re-run." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop, then re-run." >&2
  exit 1
fi

cd "$ROOT"

STARTED=0
if [ -z "$(docker compose ps -q postgres 2>/dev/null)" ]; then
  echo "==> Starting Postgres container"
  docker compose up -d --wait postgres
  STARTED=1
fi

cleanup() {
  if [ "$STARTED" = "1" ]; then
    echo "==> Stopping and removing Postgres container"
    docker compose down -v
  fi
}
trap cleanup EXIT

export DATABASE_URL="${DATABASE_URL:-postgres://tower:tower@localhost:5432/tower}"

echo "==> Running e2e tests"
pnpm --filter @towerjs/with-nextjs test:e2e