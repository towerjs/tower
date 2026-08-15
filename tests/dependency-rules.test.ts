import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packagesDir = resolve(__dirname, '..', 'packages')

interface Rule {
  source: string
  allowed: string[]
  forbidden: string[]
}

const rules: Rule[] = [
  {
    source: 'foundation',
    allowed: [],
    forbidden: ['@towerjs/'],
  },
  {
    source: 'blueprint',
    allowed: ['@towerjs/foundation'],
    forbidden: ['@towerjs/vault', '@towerjs/gatehouse', '@towerjs/courier', '@towerjs/edge', '@towerjs/scribe'],
  },
  {
    source: 'vault',
    allowed: ['@towerjs/blueprint', '@towerjs/foundation'],
    forbidden: ['@towerjs/gatehouse', '@towerjs/courier'],
  },
  {
    source: 'courier',
    allowed: ['@towerjs/blueprint', '@towerjs/foundation'],
    forbidden: ['@towerjs/vault', '@towerjs/gatehouse'],
  },
  {
    source: 'gatehouse',
    allowed: ['@towerjs/blueprint', '@towerjs/foundation', '@towerjs/courier'],
    forbidden: ['@towerjs/vault'],
  },
]

function collectSourceFiles(pkgDir: string): string[] {
  const srcDir = resolve(packagesDir, pkgDir, 'src')
  const files: string[] = []
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.ts') &&
        !entry.name.endsWith('.test.ts') &&
        !entry.name.endsWith('.test-d.ts')
      ) {
        files.push(full)
      }
    }
  }
  walk(srcDir)
  return files
}

function extractImports(content: string): string[] {
  const imports: string[] = []
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue
    const match = line.match(/from\s+['"]([^'"]+)['"]/)
    if (match) {
      imports.push(match[1])
    }
  }
  return imports
}

function checkRule(rule: Rule) {
  describe(`dependency rules for @towerjs/${rule.source}`, () => {
    const files = collectSourceFiles(rule.source)

    if (files.length === 0) {
      it('has source files to check', () => {
        expect(files.length).toBeGreaterThan(0)
      })
      return
    }

    let violations = 0
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      const imports = extractImports(content)

      for (const imp of imports) {
        if (!imp.startsWith('@towerjs/')) continue

        violations++
        const relPath = file.replace(packagesDir, 'packages')
        const isAllowed = rule.allowed.some((a) => imp.startsWith(a))

        it(`${relPath} must not import ${imp}`, () => {
          expect(isAllowed).toBe(true)
        })
      }
    }

    if (violations === 0) {
      it('has no forbidden imports', () => {
        expect(violations).toBe(0)
      })
    }
  })
}

for (const rule of rules) {
  checkRule(rule)
}
