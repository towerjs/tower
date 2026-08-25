#!/usr/bin/env bash
#
# Scaffolds an app from the LOCAL workspace code and runs it in UI-preview
# mode (`--preview-ui`): no auth gating, no database — every page renders so
# you can design freely. Never ship a preview-mode scaffold.
#
# Usage: scripts/preview-app.sh [auth|default] [app-name]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="${1:-default}"
NAME="${2:-preview-$TEMPLATE}"
# Outside the repo so the monorepo workspace never captures the app.
PREVIEW_DIR="${TOWER_PREVIEW_DIR:-$HOME/tower-design-preview}"

case "$TEMPLATE" in
  auth) FLAGS=(--template auth --modules vault,gatehouse,courier) ;;
  default) FLAGS=(--modules vault,gatehouse,courier) ;;
  *) echo "Unknown template '$TEMPLATE'. Use 'auth' or 'default'." >&2; exit 1 ;;
esac

echo "==> Building workspace"
(cd "$ROOT" && pnpm build > /dev/null)

echo "==> Packing local packages"
PACK_DIR="$PREVIEW_DIR/pack"
rm -rf "$PREVIEW_DIR/$NAME"
mkdir -p "$PACK_DIR"
for pkg in tower vault gatehouse courier scribe edge; do
  (cd "$ROOT/packages/$pkg" && pnpm pack --pack-destination "$PACK_DIR" > /dev/null 2>&1)
done

echo "==> Scaffolding $NAME (--preview-ui)"
mkdir -p "$PREVIEW_DIR"
cd "$PREVIEW_DIR"
export TOWER_PACK_DIR="$PACK_DIR"
# Isolate the pnpm store so repo/preview version drift can never break installs.
export TOWER_SKIP_INSTALL=1
export npm_config_user_agent="pnpm/10.0.0"
TOWER_UI_PREVIEW=1 node "$ROOT/packages/scribe/dist/cli.js" create "${FLAGS[@]}" "$NAME"

echo "==> Installing dependencies"
(cd "$NAME" && pnpm install > /dev/null 2>&1)
(cd "$NAME" && CI=true pnpm add "$PACK_DIR"/*.tgz > /dev/null 2>&1)

if [ ! -x "$NAME/node_modules/.bin/tower" ]; then
  echo "Dependency installation failed — run 'pnpm add $PACK_DIR/*.tgz' in the app." >&2
  exit 1
fi

echo "==> UI preview ready: $PREVIEW_DIR/$NAME"
echo "==> Starting dev server (Ctrl+C to stop) — all routes are public"
cd "$NAME"
exec pnpm dev
