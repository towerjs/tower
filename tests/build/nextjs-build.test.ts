import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { beforeAll, describe, expect, it } from 'vitest'

const EXAMPLE_DIR = resolve(import.meta.dirname, '..', '..', 'examples', 'with-nextjs')
const ROOT_DIR = resolve(import.meta.dirname, '..', '..')
const NEXT_DIR = resolve(EXAMPLE_DIR, '.next')

describe('Next.js build acceptance', () => {
  beforeAll(() => {
    if (!existsSync(resolve(EXAMPLE_DIR, 'node_modules'))) {
      execSync('pnpm install', { cwd: EXAMPLE_DIR, stdio: 'pipe' })
    }
    // Build workspace deps first (edge, etc.) so the example app can resolve their dist
    execSync('pnpm build', { cwd: ROOT_DIR, stdio: 'pipe' })
  }, 180_000)

  it('builds the example app', () => {
    expect(existsSync(NEXT_DIR)).toBe(true)
    expect(existsSync(resolve(NEXT_DIR, 'build-manifest.json'))).toBe(true)
    expect(existsSync(resolve(NEXT_DIR, 'server'))).toBe(true)
  })
})
