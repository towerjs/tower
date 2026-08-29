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
#   - Illustrative fragments (config shapes, API signature listings) must not
#     be fenced as ```ts/```tsx — use a plain ``` fence so the checker treats
#     them as prose, not as an executable example.
#
# Usage: bash scripts/verify-docs.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCS_DIR="$ROOT/docs"
TMP_DIR="$(mktemp -d)"
FAILED=0

cleanup() {
  rm -rf "$TMP_DIR"
}
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
for (const file of files) {
  const planned = isPlanned(file);
  const lines = readFileSync(file, 'utf8').split('\n');
  let inBlock = false;
  let buf = [];
  let start = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const openMatch = line.match(/^\s*```([a-zA-Z]+)/);
    if (openMatch) {
      const lang = openMatch[1];
      if (/^(ts|tsx|typescript)$/.test(lang)) {
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
      writeFileSync(join(blocksDir, name), buf.join('\n') + '\n');
      console.log('  ' + name + ' <- ' + file.slice(docsDir.length + 1) + ':' + start);
      blockCount++;
      continue;
    }

    if (inBlock) buf.push(line);
  }
}

console.log('  Extracted ' + blockCount + ' blocks from ' + files.length + ' files'
  + (plannedCount > 0 ? ' (skipped ' + plannedCount + ' blocks in planned docs)' : ''));
console.log(blockCount === 0 ? 'NO_BLOCKS' : 'BLOCKS_OK');
NODESCRIPT

BLOCKS_DIR="$TMP_DIR/blocks"
EXTRACT_OUT=$(node "$EXTRACT_SCRIPT" "$DOCS_DIR" "$BLOCKS_DIR")
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

# Docs import from bare '@towerjs/tower' and '@towerjs/tower/*' (the package name
# as users write it), not individual '@towerjs/*' packages. Add path mappings so
# tsc can resolve them.
node -e "
const fs = require('fs');
const path = require('path');
const root = '$ROOT';
const config = {
  compilerOptions: {
    target: 'ES2022',
    module: 'nodenext',
    moduleResolution: 'nodenext',
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
    jsx: 'react-jsx',
    lib: ['ES2022', 'DOM'],
    paths: {
      '@towerjs/tower': [path.join(root, 'packages/tower/src/index.ts')],
      '@towerjs/tower/*': [path.join(root, 'packages/tower/src/*'), path.join(root, 'packages/tower/src/*/index.ts')],
      '@towerjs/*': [path.join(root, 'packages/*/src/index.ts')]
    }
  },
  include: ['blocks/*.tsx']
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
echo "the block is an illustrative fragment (config shape / API signature),"
echo "re-fence it as a plain code block (\`\`\`) instead of \`\`\`ts/\`\`\`tsx."
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
