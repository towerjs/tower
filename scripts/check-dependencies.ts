import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

interface Violation {
  pkg: string
  file: string
  message: string
}

const WORKSPACE_ROOT = new URL('..', import.meta.url).pathname
const PACKAGES_DIR = join(WORKSPACE_ROOT, 'packages')

const ALLOWED_DEPENDENCIES: Record<string, string[]> = {
  '@towerjs/tower': [],
  '@towerjs/vault': ['@towerjs/tower'],
  '@towerjs/courier': ['@towerjs/tower'],
  '@towerjs/gatehouse': ['@towerjs/tower', '@towerjs/courier'],
  '@towerjs/edge': ['@towerjs/tower'],
  '@towerjs/scribe': ['@towerjs/tower', '@towerjs/vault', '@towerjs/gatehouse', '@towerjs/courier'],
  'create-tower': ['@towerjs/scribe'],
}

const VIOLATIONS: Violation[] = []

function addViolation(pkg: string, file: string, message: string) {
  VIOLATIONS.push({ pkg, file: relative(WORKSPACE_ROOT, file), message })
}

function getPackageName(pkgDir: string): string | null {
  try {
    const json = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf-8'))
    return json.name || null
  } catch {
    return null
  }
}

function getDeclaredDeps(pkgDir: string): {
  dependencies: Set<string>
  devDependencies: Set<string>
  peerDependencies: Set<string>
} {
  try {
    const json = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf-8'))
    return {
      dependencies: new Set(Object.keys(json.dependencies || {})),
      devDependencies: new Set(Object.keys(json.devDependencies || {})),
      peerDependencies: new Set(Object.keys(json.peerDependencies || {})),
    }
  } catch {
    return { dependencies: new Set(), devDependencies: new Set(), peerDependencies: new Set() }
  }
}

function walkFiles(dir: string): string[] {
  const files: string[] = []
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
        files.push(...walkFiles(full))
      } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        files.push(full)
      }
    }
  } catch {
    // directory doesn't exist
  }
  return files
}

// These match import/export statements at the start of a line (after optional whitespace).
// The `m` flag makes `^` match line boundaries.
// Capture groups: [1] = 'type ' if present (or empty), [2] = package path
const IMPORT_RE = /^(?:\s*)import\s+(type\s+)?(?:\{[^}]*\}|\*)\s+from\s+['"](@towerjs\/[a-z][a-z0-9/_-]*)['"]/gm
const EXPORT_FROM_RE = /^(?:\s*)export\s+(type\s+)?(?:\{[^}]*\}|\*)\s+from\s+['"](@towerjs\/[a-z][a-z0-9/_-]*)['"]/gm
const DYNAMIC_IMPORT_RE = /import\(['"](@towerjs\/[a-z][a-z0-9/_-]*)['"]\)/g

function scanPackage(pkgDir: string) {
  const pkgName = getPackageName(pkgDir)
  if (!pkgName) return
  if (!(pkgName in ALLOWED_DEPENDENCIES)) return

  const allowed = ALLOWED_DEPENDENCIES[pkgName]
  const declared = getDeclaredDeps(pkgDir)
  const srcDir = join(pkgDir, 'src')
  if (!existsSync(srcDir)) return

  for (const file of walkFiles(srcDir)) {
    const content = readFileSync(file, 'utf-8')

    function checkImport(typeKw: string | undefined, imported: string, isDynamic: boolean) {
      const basePkg = imported.split('/').slice(0, 2).join('/')
      if (basePkg === pkgName) return

      // Direction rule
      if (!allowed.includes(basePkg)) {
        addViolation(
          pkgName,
          file,
          `imports "${imported}" from "${basePkg}" — not in allowed dependencies [${allowed.join(', ') || 'none'}]`
        )
      }

      // Declaration rule
      if (isDynamic) {
        if (!declared.dependencies.has(basePkg)) {
          addViolation(pkgName, file, `dynamic import("${imported}") — "${basePkg}" must be in dependencies`)
        }
      } else if (typeKw) {
        // Type-only imports: allowed in deps, devDeps, or peerDeps
        if (
          !declared.dependencies.has(basePkg) &&
          !declared.devDependencies.has(basePkg) &&
          !declared.peerDependencies.has(basePkg)
        ) {
          addViolation(
            pkgName,
            file,
            `type-only import "${imported}" — "${basePkg}" must be declared in dependencies, devDependencies, or peerDependencies`
          )
        }
      } else {
        // Runtime imports: must be in dependencies
        if (!declared.dependencies.has(basePkg)) {
          const inDev = declared.devDependencies.has(basePkg)
          const inPeer = declared.peerDependencies.has(basePkg)
          addViolation(
            pkgName,
            file,
            `runtime import "${imported}" — "${basePkg}" must be in dependencies (found: ${inDev ? 'devDependencies' : inPeer ? 'peerDependencies' : 'not declared'})`
          )
        }
      }
    }

    // Static imports
    let match: RegExpExecArray | null
    IMPORT_RE.lastIndex = 0
    while ((match = IMPORT_RE.exec(content)) !== null) {
      checkImport(match[1], match[2], false)
    }

    // Static re-exports (export ... from)
    EXPORT_FROM_RE.lastIndex = 0
    while ((match = EXPORT_FROM_RE.exec(content)) !== null) {
      checkImport(match[1], match[2], false)
    }

    // Dynamic imports
    DYNAMIC_IMPORT_RE.lastIndex = 0
    while ((match = DYNAMIC_IMPORT_RE.exec(content)) !== null) {
      checkImport(undefined, match[1], true)
    }
  }
}

// --- Main ---

const packages = readdirSync(PACKAGES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => join(PACKAGES_DIR, d.name))

for (const pkgDir of packages) {
  scanPackage(pkgDir)
}

if (VIOLATIONS.length > 0) {
  console.error(`\n❌ Found ${VIOLATIONS.length} dependency violation(s):\n`)
  for (const v of VIOLATIONS) {
    console.error(`  ${v.file}`)
    console.error(`    ${v.pkg} ${v.message}`)
    console.error()
  }
  process.exit(1)
} else {
  console.log('✅ All dependency rules pass.')
}
