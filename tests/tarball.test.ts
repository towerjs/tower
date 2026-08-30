import { execSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const ROOT_DIR = resolve(import.meta.dirname, '..')
const TOWER_DIR = resolve(ROOT_DIR, 'packages', 'tower')

// Must match packages/tower/package.json exports (public subpaths)
// Since S1, @towerjs/tower is the core (Foundation + Blueprint internal); modules are separate @towerjs/* packages
const SUBPATHS = ['.', './blueprint', './foundation', './runtime', './runtime/node']

describe('@towerjs/tower tarball structure', () => {
  let extractDir: string

  beforeAll(() => {
    execSync('pnpm build', { cwd: ROOT_DIR, stdio: 'pipe' })
    const packDir = mkdtempSync(join(tmpdir(), 'tower-pack-'))
    execSync('pnpm pack --pack-destination ' + packDir, { cwd: TOWER_DIR, stdio: 'pipe' })
    const tarball = readdirSync(packDir).find((f) => f.endsWith('.tgz'))
    expect(tarball).toBeTruthy()
    extractDir = mkdtempSync(join(tmpdir(), 'tower-extract-'))
    execSync(`tar -xzf ${join(packDir, tarball!)} -C ${extractDir} --strip-components=1`)
    rmSync(packDir, { recursive: true, force: true })
  }, 180_000)

  afterAll(() => {
    if (extractDir) rmSync(extractDir, { recursive: true, force: true })
  })

  it('declares every public subpath in the exports map', () => {
    const pkg = JSON.parse(readFileSync(join(extractDir, 'package.json'), 'utf8'))
    for (const subpath of SUBPATHS) {
      expect(pkg.exports[subpath], `missing export "${subpath}"`).toBeDefined()
    }
  })

  it('resolves every export to an existing file', () => {
    const pkg = JSON.parse(readFileSync(join(extractDir, 'package.json'), 'utf8'))
    for (const subpath of SUBPATHS) {
      const val = pkg.exports[subpath]
      const target = typeof val === 'string' ? val : val.default || val.types
      expect(target, `could not resolve "${subpath}"`).toBeTruthy()
      const resolved = join(extractDir, target)
      expect(readFileSync(resolved, 'utf8'), `"${subpath}" → ${target} (file not found)`).toBeDefined()
    }
  })

  it('ships a .d.ts for every export', () => {
    const pkg = JSON.parse(readFileSync(join(extractDir, 'package.json'), 'utf8'))
    for (const subpath of SUBPATHS) {
      const val = pkg.exports[subpath]
      const target = typeof val === 'string' ? val : val.types
      expect(target, `"${subpath}" missing types target`).toBeTruthy()
      const dts = join(extractDir, target.replace(/\.js$/, '.d.ts'))
      expect(readFileSync(dts, 'utf8'), `"${subpath}" missing ${target.replace(/\.js$/, '.d.ts')}`).toBeDefined()
    }
  })

  it('parses every exported JS file without syntax errors', () => {
    const pkg = JSON.parse(readFileSync(join(extractDir, 'package.json'), 'utf8'))
    const targets = new Set<string>()
    for (const subpath of SUBPATHS) {
      const val = pkg.exports[subpath]
      const target = typeof val === 'string' ? val : val.default || val.types
      if (target.endsWith('.js')) targets.add(target)
    }
    for (const target of targets) {
      expect(() => execSync(`node --check ${join(extractDir, target)}`, { stdio: 'pipe' }), target).not.toThrow()
    }
  })

  it('excludes stale build artifacts (tsbuildinfo) from the tarball', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]
      )
    const files = walk(extractDir)
    expect(files.some((f) => f.endsWith('.tsbuildinfo'))).toBe(false)
  })
})
