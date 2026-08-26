#!/usr/bin/env bash
#
# Scaffolds an app from the LOCAL workspace code and runs it in UI-preview
# mode (`TOWER_UI_PREVIEW=1`, internal): no auth gating, no database — every
# page renders so you can design freely.
#
# The app is generated into <repo>/.preview/<name>, which is gitignored and
# becomes a temporary workspace member so @towerjs/* resolves to the local
# packages (zero duplicated node_modules).
#
# Usage: scripts/preview-app.sh [auth|default] [app-name]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="${1:-default}"
NAME="${2:-preview-$TEMPLATE}"
PREVIEW_DIR="$ROOT/.preview"
APP_DIR="$PREVIEW_DIR/$NAME"

case "$TEMPLATE" in
  auth) FLAGS=(--template auth --tailwind --modules vault,gatehouse,courier) ;;
  default) FLAGS=(--modules vault,gatehouse,courier) ;;
  *) echo "Unknown template '$TEMPLATE'. Use 'auth' or 'default'." >&2; exit 1 ;;
esac

echo "==> Building workspace"
# A leftover .preview workspace entry breaks turbo/pnpm here — strip it first.
python3 - "$ROOT/pnpm-workspace.yaml" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
cleaned = '\n'.join(l for l in s.splitlines() if '.preview' not in l)
if cleaned != s:
    open(p, 'w').write(cleaned.rstrip() + '\n')
PY
(cd "$ROOT" && pnpm build > /dev/null)

echo "==> Scaffolding $NAME (--preview-ui, no installs)"
rm -rf "$APP_DIR"
mkdir -p "$PREVIEW_DIR"
cd "$PREVIEW_DIR"
TOWER_UI_PREVIEW=1 TOWER_SKIP_INSTALL=1 node "$ROOT/packages/scribe/dist/cli.js" create "${FLAGS[@]}" "$NAME"

echo "==> Wiring $NAME into the workspace (temporary)"
node - "$NAME" "$ROOT" <<'NODE'
const { readFileSync, writeFileSync, rmSync } = require('node:fs')
const [name, root] = process.argv.slice(2)
const dir = `${root}/.preview/${name}`

// App manifest: workspace deps only.
const pkgPath = `${dir}/package.json`
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
pkg.dependencies = {
  '@towerjs/gatehouse': 'workspace:*',
  '@towerjs/vault': 'workspace:*',
  '@towerjs/courier': 'workspace:*',
  '@towerjs/tower': 'workspace:*',
  next: pkg.dependencies?.next ?? 'latest',
  react: pkg.dependencies?.react ?? 'latest',
  'react-dom': pkg.dependencies?.['react-dom'] ?? 'latest',
}
pkg.devDependencies = { '@towerjs/scribe': 'workspace:*' }
// No build script: turbo must not treat the preview as a buildable package.
if (pkg.scripts) delete pkg.scripts.build
delete pkg.pnpm
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

// Standalone-workspace file from create-next-app must go — the app joins the
// monorepo workspace instead.
rmSync(`${dir}/pnpm-workspace.yaml`, { force: true })

// tsconfig paths mirror examples/with-nextjs.
const tsPath = `${dir}/tsconfig.json`
let ts = {}
try { ts = JSON.parse(readFileSync(tsPath, 'utf8')) } catch {}
const base = '../../packages'
const paths = (ts.compilerOptions ??= {}).paths ??= {}
Object.assign(paths, {
  '@/*': ['./src/*'],
  '@towerjs/tower': [`${base}/tower/dist/index`],
  '@towerjs/vault': [`${base}/vault/dist/index`],
  '@towerjs/vault/model': [`${base}/vault/dist/model`],
  '@towerjs/vault/factory': [`${base}/vault/dist/factory`],
  '@towerjs/gatehouse': [`${base}/gatehouse/dist/index`],
  '@towerjs/gatehouse/actions': [`${base}/gatehouse/dist/frameworks/actions/index`],
  '@towerjs/gatehouse/next': [`${base}/gatehouse/dist/frameworks/next`],
  '@towerjs/courier': [`${base}/courier/dist/index`],
})
writeFileSync(tsPath, JSON.stringify(ts, null, 2) + '\n')

// Root workspace gains the preview app (local-only change).
const wsPath = `${root}/pnpm-workspace.yaml`
let ws = readFileSync(wsPath, 'utf8')
if (!ws.includes('.preview')) {
  ws = ws.replace(/packages:\n/, "packages:\n  - '.preview/*'\n")
  writeFileSync(wsPath, ws)
}
NODE

echo "==> Installing dependencies"
(cd "$ROOT" && pnpm install > /dev/null 2>&1)

echo ""
echo "==> UI preview ready: $APP_DIR"
echo "==> All routes are public. Starting dev server (Ctrl+C to stop)"
cd "$APP_DIR"
exec pnpm dev
