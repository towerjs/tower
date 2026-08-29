#!/usr/bin/env bash
#
# Preview a create-tower app scaffolded from the LOCAL working tree.
#
# Builds the workspace, scaffolds with the local scribe CLI in UI-preview
# mode (`TOWER_UI_PREVIEW=1`, internal: no auth gating, no database — every
# page renders so you can design freely), and starts the dev server.
#
# The app resolves @towerjs/* via `link:` deps pointing at packages/*, so it
# always runs the code in your working tree (rebuild with `pnpm build` — or
# re-run this script — to pick up package changes). It is a fully standalone
# pnpm project with its own lockfile and node_modules: nothing in the repo is
# modified, and turbo/pnpm never see it. It lives in the gitignored
# <repo>/.preview/ — it must stay inside the repo, because Turbopack only
# resolves the link: symlinks when packages/ is under its root.
#
# Typical loop: run this, edit the app's UI under .preview/<name>/src with
# the dev server running, then copy the result back into the scaffold
# templates in packages/scribe/src/frameworks/next.ts.
#
# Usage: scripts/preview-app.sh [auth|default] [options]
#   --name <name>   app directory name        (default: preview-<template>)
#   --fresh         delete the app and re-scaffold (discards your UI edits!)
#   --no-dev        set up only; don't start the dev server
#
# Re-running without --fresh keeps the existing app (and your edits) and
# just rebuilds the packages and starts the dev server.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="default"
if [ $# -gt 0 ] && [[ "$1" != --* ]]; then
  TEMPLATE="$1"
  shift
fi

case "$TEMPLATE" in
  auth) FLAGS=(--template auth --tailwind --modules vault,gatehouse,courier) ;;
  default) FLAGS=(--modules vault,gatehouse,courier) ;;
  *) echo "Unknown template '$TEMPLATE'. Use 'auth' or 'default'." >&2; exit 1 ;;
esac

NAME="preview-$TEMPLATE"
PARENT_DIR="$ROOT/.preview"
FRESH=0
RUN_DEV=1
while [ $# -gt 0 ]; do
  case "$1" in
    --name) NAME="$2"; shift 2 ;;
    --fresh) FRESH=1; shift ;;
    --no-dev) RUN_DEV=0; shift ;;
    *) echo "Unknown option '$1'." >&2; exit 1 ;;
  esac
done
APP_DIR="$PARENT_DIR/$NAME"

echo "==> Building workspace"
(cd "$ROOT" && pnpm build > /dev/null)

if [ -d "$APP_DIR" ] && [ "$FRESH" -eq 0 ]; then
  echo "==> Reusing existing app at $APP_DIR (pass --fresh to re-scaffold)"
else
  echo "==> Scaffolding $NAME (UI-preview mode, local packages via link:)"
  rm -rf "$APP_DIR"
  mkdir -p "$PARENT_DIR"
  cd "$PARENT_DIR"
  # npm_config_user_agent makes scribe treat this as a pnpm-driven scaffold,
  # matching the pnpm install below. TOWER_SKIP_INSTALL defers all installs
  # to that single install; TOWER_PACK_DIR makes @towerjs/* resolve as link:
  # deps into the local packages.
  TOWER_UI_PREVIEW=1 TOWER_SKIP_INSTALL=1 TOWER_PACK_DIR="$ROOT/packages" \
    npm_config_user_agent="pnpm/$(pnpm --version) node/$(node --version)" \
    node "$ROOT/packages/scribe/dist/cli.js" create "${FLAGS[@]}" "$NAME"

  # Standalone workspace marker: keeps pnpm from walking up into the tower
  # monorepo (when generated under .preview/) and mirrors its build allowances.
  cat > "$APP_DIR/pnpm-workspace.yaml" <<'YAML'
allowBuilds:
  esbuild: true
  sharp: true
  unrs-resolver: true
YAML

  echo "==> Installing dependencies"
  (cd "$APP_DIR" && pnpm install)
fi

echo ""
echo "==> UI preview ready: $APP_DIR"
if [ "$RUN_DEV" -eq 0 ]; then
  echo "==> Start it with: cd ${APP_DIR#"$ROOT/"} && pnpm dev"
  exit 0
fi
echo "==> All routes are public. Starting dev server (Ctrl+C to stop)"
cd "$APP_DIR"
exec pnpm dev
