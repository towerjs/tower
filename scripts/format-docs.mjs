#!/usr/bin/env node
// Formats fenced ts/tsx/js/jsx code blocks inside docs/*.mdx using the
// project's Prettier config, including import sorting. Plain ``` fences
// (illustrative fragments) are left untouched.
//
// Note: import sorting is done here directly because prettier-plugin-organize-imports
// is currently non-functional with Prettier 3 + TypeScript 7 (it sorts nothing,
// repo-wide). This keeps docs' import ordering consistent with the intended behavior.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

import prettier from 'prettier'

const require = createRequire(import.meta.url)
const ROOT = process.cwd()
const DOCS_DIR = resolve(ROOT, 'docs')
const CONFIG = require(resolve(ROOT, 'package.json')).prettier ?? {}

const PARSERS = {
  ts: 'typescript',
  typescript: 'typescript',
  tsx: 'typescript',
  js: 'babel',
  javascript: 'babel',
  jsx: 'babel',
}

// Matches a whole import statement, single- or multi-line.
const IMPORT_RE = /(import\s+(?:type\s+)?[\s\S]*?from\s*['"][^'"]+['"]\s*;?)|(import\s*['"][^'"]+['"]\s*;?)/g

function sortImports(code) {
  const matches = [...code.matchAll(IMPORT_RE)]
  if (matches.length < 2) return code

  const first = matches[0]
  const last = matches[matches.length - 1]
  const start = first.index
  const end = last.index + last[0].length
  const trailing = last[0].match(/\s+$/)?.[0] ?? ''

  // Only reorder when imports form a contiguous block (no real code between them).
  const between = code.slice(start, end)
  if (/[^;\s]/.test(between.replace(IMPORT_RE, ''))) return code

  const specifier = (imp) => {
    const from = imp.match(/from\s*['"]([^'"]+)['"]/)
    if (from) return from[1]
    const side = imp.match(/import\s*['"]([^'"]+)['"]/)
    if (side) return ' ' + side[1] // side-effect imports sort first
    return '~' + imp
  }

  const sorted = matches.map((m) => m[0].replace(/\s+$/, '')).sort((a, b) => specifier(a).localeCompare(specifier(b)))
  return code.slice(0, start) + sorted.join('\n') + trailing + code.slice(end)
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, acc)
    else if (entry.name.endsWith('.mdx')) acc.push(full)
  }
  return acc
}

async function formatDocs() {
  const files = walk(DOCS_DIR)
  let changedFiles = 0

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n')
    const out = []
    let inBlock = false
    let lang = ''
    let buf = []
    let fileChanged = false

    const flush = async () => {
      const parser = PARSERS[lang]
      const code = buf.join('\n')
      if (parser && code.trim().length > 0) {
        try {
          const formatted = (await prettier.format(code, { ...CONFIG, parser })).replace(/\n+$/, '')
          const sorted = sortImports(formatted)
          out.push(...sorted.split('\n'))
          if (sorted !== code) fileChanged = true
        } catch {
          // Leave syntactically-incomplete fragments untouched.
          out.push(...buf)
        }
      } else {
        out.push(...buf)
      }
      buf = []
    }

    for (const line of lines) {
      const open = line.match(/^(\s*)```([a-zA-Z]+)(.*)$/)
      if (open && !inBlock) {
        inBlock = true
        lang = open[2]
        buf = []
        out.push(line)
        continue
      }
      if (/^\s*```\s*$/.test(line) && inBlock) {
        inBlock = false
        await flush()
        out.push(line)
        continue
      }
      if (inBlock) {
        buf.push(line)
        continue
      }
      out.push(line)
    }

    if (fileChanged) {
      writeFileSync(file, out.join('\n'))
      changedFiles++
    }
  }

  console.log(`format-docs: ${changedFiles} file(s) reformatted`)
}

await formatDocs()
