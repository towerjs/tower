#!/usr/bin/env bash
#
# Documentation contract test.
#
# Extracts TypeScript code blocks from all docs/ .mdx files and verifies they
# compile against the Tower types. This ensures documentation examples don't
# silently diverge from the implementation.
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

# Extract code blocks delimited by ```ts/tsx/typescript ... ```
# Concatenate them into a single .tsx file for compilation.
OUTPUT_FILE="$TMP_DIR/docs-examples.tsx"
echo "// Auto-generated from docs/ — do not edit manually" > "$OUTPUT_FILE"
echo "import * as React from 'react'" >> "$OUTPUT_FILE"
echo "import * as towerjs from 'towerjs'" >> "$OUTPUT_FILE"
echo "import * as vault from 'towerjs/vault'" >> "$OUTPUT_FILE"
echo "import * as gatehouse from 'towerjs/gatehouse'" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Extract TypeScript code blocks from all .mdx files using Node.js (bash's
# backtick handling in regex is unreliable, so we write the script to a file).
EXTRACT_SCRIPT="$TMP_DIR/extract.mjs"
cat > "$EXTRACT_SCRIPT" << 'NODESCRIPT'
import { readFileSync, readdirSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const docsDir = process.argv[2];
const outputFile = process.argv[3];

const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.mdx')) files.push(full);
  }
}
walk(docsDir);

let blockCount = 0;
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  let inBlock = false;

  for (const line of lines) {
    const openMatch = line.match(/^\s*```([a-zA-Z]+)/);
    if (openMatch) {
      const lang = openMatch[1];
      if (/^(ts|tsx|typescript)$/.test(lang)) {
        inBlock = true;
        appendFileSync(outputFile, '\n// === From ' + file.slice(docsDir.length + 1) + ' ===\n');
      } else {
        inBlock = false;
      }
      continue;
    }

    if (/^\s*```\s*$/.test(line) && inBlock) {
      inBlock = false;
      continue;
    }

    if (inBlock) {
      appendFileSync(outputFile, line + '\n');
      blockCount++;
    }
  }
}

console.log('  Extracted ' + blockCount + ' lines from ' + files.length + ' files');
NODESCRIPT

node "$EXTRACT_SCRIPT" "$DOCS_DIR" "$OUTPUT_FILE"

echo ""

# Check if we extracted any code
CODE_LINES=$(wc -l < "$OUTPUT_FILE")
if [ "$CODE_LINES" -le 4 ]; then
  echo "No TypeScript code blocks found in docs."
  exit 0
fi

echo "=== Compiling extracted examples ==="

# Create a tsconfig that extends the root config (which has @towerjs/* path
# mappings) but only checks our extracted examples file.
# Docs import from bare 'towerjs' and 'towerjs/*' (the package name as users
# write it), not '@towerjs/*'. Add path mappings so tsc can resolve them.
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
      'towerjs': [path.join(root, 'packages/towerjs/src/index.ts')],
      'towerjs/*': [path.join(root, 'packages/towerjs/src/*'), path.join(root, 'packages/towerjs/src/*/index.ts')],
      '@towerjs/*': [path.join(root, 'packages/*/src/index.ts')]
    }
  },
  include: ['docs-examples.tsx']
};
fs.writeFileSync('$TMP_DIR/tsconfig.json', JSON.stringify(config, null, 2));
"

# Run tsc from the temp dir so relative paths in the examples resolve
cd "$TMP_DIR"
TSC="$ROOT/node_modules/.bin/tsc"
if [ ! -x "$TSC" ]; then
  echo "ERROR: tsc not found at $TSC"
  exit 1
fi
if "$TSC" --project "$TMP_DIR/tsconfig.json" --noEmit 2>&1 | head -40; then
  echo ""
  echo "=== DOCS CONTRACT TEST PASSED ==="
else
  echo ""
  echo "=== DOCS CONTRACT TEST FAILED ==="
  FAILED=1
fi

exit $FAILED
