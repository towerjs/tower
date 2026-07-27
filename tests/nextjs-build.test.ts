import { describe, it, expect, beforeAll } from 'vitest'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const EXAMPLE_DIR = resolve(import.meta.dirname, '..', 'examples', 'with-nextjs')
const NEXT_DIR = resolve(EXAMPLE_DIR, '.next')

// Only run in CI or when explicitly requested via CI=true
const runBuildTest = process.env.CI === 'true'

describe('Next.js build acceptance', () => {
  beforeAll(() => {
    if (!runBuildTest) return
    if (!existsSync(resolve(EXAMPLE_DIR, 'node_modules'))) {
      execSync('pnpm install', { cwd: EXAMPLE_DIR, stdio: 'pipe' })
    }
    execSync('pnpm build', { cwd: EXAMPLE_DIR, stdio: 'pipe' })
  })

  it('builds the example app', ({ skip }) => {
    if (!runBuildTest) skip()
    expect(existsSync(NEXT_DIR)).toBe(true)
    expect(existsSync(resolve(NEXT_DIR, 'build-manifest.json'))).toBe(true)
    expect(existsSync(resolve(NEXT_DIR, 'server'))).toBe(true)
  })
})
