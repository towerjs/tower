#!/usr/bin/env bash
#
# Documentation contract test.
#
# Extracts TypeScript/TSX code blocks from all docs/ .mdx files and verifies
# each one compiles against the Tower types. This ensures documented,
# executable examples don't silently diverge from the implementation.
#
# Conventions:
#   - Blocks are compiled individually (concatenating snippets into one file
#     would fail on duplicate declarations and mask per-example errors).
#   - Docs marked as planned ("badge: 'Coming Soon'" or "Status: Planned")
#     describe target APIs that are not implemented yet — their blocks are
#     not compiled.
#   - Illustrative listings (config shapes, API signature tables) are not
#     executable — fence them as ```ts signature. They keep their syntax
#     highlighting on the docs site (which reads only the language and
#     filename="..." from the fence) but are not compiled. Use this only for
#     pseudo-code: anything a reader could paste into a project must compile.
#
# Usage: bash scripts/verify-docs.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCS_DIR="$ROOT/docs"
# Blocks are compiled inside the example app: its node_modules resolve react,
# next, and the @towerjs/* packages through their published `exports` maps, so
# a documented import only passes here if it would work in a real project.
APP_DIR="$ROOT/examples/with-nextjs"
TMP_DIR="$APP_DIR/.cache/verify-docs"
FAILED=0

cleanup() {
  rm -rf "$TMP_DIR"
}

if [ ! -d "$ROOT/packages/tower/dist" ]; then
  echo "ERROR: packages are not built. Run 'pnpm build' first."
  exit 1
fi

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"
# Docs examples are ESM (top-level await, ESM-only packages), so the compiled
# blocks must be treated as ESM too.
echo '{ "type": "module" }' > "$TMP_DIR/package.json"
trap cleanup EXIT

echo "=== Extracting TypeScript code blocks from docs ==="

EXTRACT_SCRIPT="$TMP_DIR/extract.mjs"
cat > "$EXTRACT_SCRIPT" << 'NODESCRIPT'
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const docsDir = process.argv[2];
const blocksDir = process.argv[3];
mkdirSync(blocksDir, { recursive: true });

const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.mdx')) files.push(full);
  }
}
walk(docsDir);

function isPlanned(file) {
  const head = readFileSync(file, 'utf8').split('\n').slice(0, 20).join('\n');
  return /badge:\s*'Coming Soon'/.test(head) || /Status:\s*Planned/.test(head);
}

let blockCount = 0;
let plannedCount = 0;
let signatureCount = 0;
for (const file of files) {
  const planned = isPlanned(file);
  const lines = readFileSync(file, 'utf8').split('\n');
  let inBlock = false;
  let buf = [];
  let start = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const openMatch = line.match(/^\s*```([a-zA-Z]+)(.*)$/);
    if (openMatch) {
      const lang = openMatch[1];
      const signature = /(^|\s)signature(\s|$)/.test(openMatch[2]);
      if (signature) signatureCount++;
      if (/^(ts|tsx|typescript)$/.test(lang) && !signature) {
        inBlock = true;
        buf = [];
        start = i + 1;
      } else {
        inBlock = false;
      }
      continue;
    }

    if (/^\s*```\s*$/.test(line) && inBlock) {
      inBlock = false;
      if (planned) {
        plannedCount++;
        continue;
      }
      const name = 'block-' + String(blockCount).padStart(3, '0') + '.tsx';
      if (!buf.some((l) => l.trim() !== '')) {
        // An empty block means extraction is broken, not that the docs are
        // clean: tsc happily compiles empty files and the gate passes on
        // nothing. Fail loudly instead.
        console.error('Extracted an empty block from ' + file + ':' + start + ' — the extractor is broken.');
        process.exit(1);
      }
      // Each block is its own module: without an import or export, a block
      // shares the global scope with every other block (duplicate
      // declarations) and cannot use top-level await.
      const body = buf.join('\n');
      const isModule = /^\s*(import|export)\s/m.test(body);
      writeFileSync(join(blocksDir, name), body + '\n' + (isModule ? '' : '\nexport {}\n'));
      console.log('  ' + name + ' <- ' + file.slice(docsDir.length + 1) + ':' + start);
      blockCount++;
      continue;
    }

    if (inBlock) buf.push(line);
  }
}

const skipped = [
  plannedCount > 0 ? plannedCount + ' in planned docs' : null,
  signatureCount > 0 ? signatureCount + ' signature listings' : null,
].filter(Boolean);
console.log('  Extracted ' + blockCount + ' blocks from ' + files.length + ' files'
  + (skipped.length > 0 ? ' (skipped ' + skipped.join(', ') + ')' : ''));
console.log(blockCount === 0 ? 'NO_BLOCKS' : 'BLOCKS_OK');
NODESCRIPT

BLOCKS_DIR="$TMP_DIR/blocks"
EXTRACT_OUT=$(node "$EXTRACT_SCRIPT" "$DOCS_DIR" "$BLOCKS_DIR")

# Examples that span several files import the ones the reader creates through
# the app's own @/ alias. Those paths belong to the reader's project, so they
# resolve to `any` here; everything else in the block is still checked.
cat > "$BLOCKS_DIR/app-local.d.ts" <<'DTS'
declare module '@/*'
DTS
echo "$EXTRACT_OUT" | sed '$d'

if echo "$EXTRACT_OUT" | grep -q '^NO_BLOCKS$'; then
  echo ""
  echo "=== DOCS CONTRACT TEST FAILED ==="
  echo ""
  echo "No executable TypeScript blocks were extracted from docs/. The docs do"
  echo "contain ts/tsx examples, so this means the extractor is broken — not"
  echo "that the examples are clean."
  exit 1
fi

echo ""
echo "=== Compiling extracted examples ==="

# Inherit the example app's compiler options so blocks are checked exactly as
# Next.js app code is, and @towerjs/* resolves the way a consumer resolves it:
# through each package's exports map in node_modules.
node -e "
const fs = require('fs');
const config = {
  extends: '../../tsconfig.json',
  compilerOptions: { noEmit: true, incremental: false },
  include: ['blocks/*.tsx', 'blocks/*.d.ts']
};
fs.writeFileSync('$TMP_DIR/tsconfig.json', JSON.stringify(config, null, 2));
"

TSC="$ROOT/node_modules/.bin/tsc"
if [ ! -x "$TSC" ]; then
  echo "ERROR: tsc not found at $TSC"
  exit 1
fi

ERRORS="$TMP_DIR/errors.txt"
set +e
# --pretty false keeps the one-error-per-line "path(line,col): error TS..."
# format the report below parses.
"$TSC" --project "$TMP_DIR/tsconfig.json" --noEmit --pretty false > "$ERRORS" 2>&1
TSC_EXIT=$?
set -e

if [ "$TSC_EXIT" -eq 0 ]; then
  echo ""
  echo "=== DOCS CONTRACT TEST PASSED ==="
  exit 0
fi

echo ""
echo "=== DOCS CONTRACT TEST FAILED ==="
echo ""
echo "The following code blocks do not compile. Either fix the example or, if"
echo "the block is an illustrative listing (config shape / API signature),"
echo "re-fence it as \`\`\`ts signature so it is highlighted but not compiled."
echo ""
echo "Note: tsc reports semantic errors only once every block parses, so a run"
echo "that lists syntax errors may surface more after those are fixed."
echo ""

# Map each failing block back to the docs file and line it came from. tsc
# prints the block path relative to the working directory, so match on the
# block file name rather than anchoring at the start of the line.
grep -oE 'block-[0-9]+\.tsx' "$ERRORS" | sort -u | while read -r name; do
  origin=$(echo "$EXTRACT_OUT" | grep -F " $name <- " | sed 's/.*<- //')
  echo "--- docs/${origin:-unknown} ($name) ---"
  grep -F "$name(" "$ERRORS" | sed -E "s|^.*($name)|  \1|"
done

FAILED=1
exit $FAILED
