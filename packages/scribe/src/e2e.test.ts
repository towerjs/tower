import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { ProjectState } from './state.js'

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
  select: vi.fn(),
  checkbox: vi.fn(),
}))

import { execa } from 'execa'
import { nextAdapter } from './frameworks/next.js'

const baseState: ProjectState = {
  projectName: 'my-tower-app',
  framework: 'next',
  modules: {},
  deployment: 'vercel',
  frameworkAnswers: { typescript: true, tailwind: true },
}

describe('scaffolding — real file output', () => {
  let tmpDir: string
  let projectDir: string

  beforeEach(() => {
    vi.clearAllMocks()
    tmpDir = mkdtempSync(join(tmpdir(), 'tower-e2e-'))

    vi.mocked(execa).mockImplementation(async (bin: string) => {
      if (bin === 'npx') {
        mkdirSync(join(tmpDir, baseState.projectName, 'src', 'app'), { recursive: true })
        writeFileSync(
          join(tmpDir, baseState.projectName, 'package.json'),
          JSON.stringify({
            name: baseState.projectName,
            private: true,
            dependencies: { next: 'latest', react: 'latest' },
          })
        )
        writeFileSync(join(tmpDir, baseState.projectName, 'tsconfig.json'), '{}')
        writeFileSync(join(tmpDir, baseState.projectName, 'next.config.ts'), '')
      }
    })

    projectDir = join(tmpDir, baseState.projectName)
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('writes tower.config.ts and .env.example for vault + gatehouse', async () => {
    const state: ProjectState = {
      ...baseState,
      modules: {
        vault: { provider: 'neon', brand: 'neon' },
        gatehouse: { provider: 'better-auth', credentials: true, social: { google: {}, github: {} } },
      },
    }
    await nextAdapter.generate(state, tmpDir)

    expect(existsSync(join(projectDir, 'tower.config.ts'))).toBe(true)
    expect(existsSync(join(projectDir, '.env.example'))).toBe(true)
    expect(existsSync(join(projectDir, '.env'))).toBe(true)
    expect(existsSync(join(projectDir, 'src', 'app', 'api', 'auth', '[...all]', 'route.ts'))).toBe(true)
    expect(existsSync(join(projectDir, 'src', 'proxy.ts'))).toBe(true)

    const config = readFileSync(join(projectDir, 'tower.config.ts'), 'utf-8')
    expect(config).toContain('defineTower')
    expect(config).toContain('vault')
    expect(config).toContain('gatehouse')
    expect(config).toContain('neon')
    expect(config).toContain('google')
    expect(config).toContain('github')

    const envExample = readFileSync(join(projectDir, '.env.example'), 'utf-8')
    expect(envExample).toContain('DATABASE_URL')
    expect(envExample).toContain('BETTER_AUTH_SECRET')

    const env = readFileSync(join(projectDir, '.env'), 'utf-8')
    expect(env).toContain('BETTER_AUTH_SECRET')
    expect(env).toContain('DATABASE_URL')
  })

  it('writes .env with DATABASE_URL when only vault is enabled', async () => {
    const state: ProjectState = {
      ...baseState,
      modules: { vault: { provider: 'neon', brand: 'neon' } },
    }
    await nextAdapter.generate(state, tmpDir)

    expect(existsSync(join(projectDir, '.env'))).toBe(true)
    const env = readFileSync(join(projectDir, '.env'), 'utf-8')
    expect(env).toContain('DATABASE_URL')
    expect(env).not.toContain('BETTER_AUTH_SECRET')
    expect(existsSync(join(projectDir, 'src', 'proxy.ts'))).toBe(false)
  })

  it('writes auth route and proxy for gatehouse', async () => {
    const state: ProjectState = {
      ...baseState,
      modules: { gatehouse: { provider: 'better-auth', credentials: true } },
    }
    await nextAdapter.generate(state, tmpDir)

    expect(existsSync(join(projectDir, '.env'))).toBe(true)
    expect(existsSync(join(projectDir, 'src', 'app', 'api', 'auth', '[...all]', 'route.ts'))).toBe(true)
    expect(existsSync(join(projectDir, 'src', 'proxy.ts'))).toBe(true)

    const route = readFileSync(join(projectDir, 'src', 'app', 'api', 'auth', '[...all]', 'route.ts'), 'utf-8')
    expect(route).toContain('@towerjs/gatehouse/next')

    const proxy = readFileSync(join(projectDir, 'src', 'proxy.ts'), 'utf-8')
    expect(proxy).toContain('gatehouse.proxy')
    expect(proxy).toContain('/sign-in')
  })

  it('installs towerjs dependency', async () => {
    await nextAdapter.generate(baseState, tmpDir)
    expect(execa).toHaveBeenLastCalledWith(
      'pnpm',
      ['add', 'towerjs'],
      expect.objectContaining({
        cwd: projectDir,
      })
    )
  })

  it('generates valid tower.config.ts for all module combinations', async () => {
    const combos: [string, Partial<ProjectState['modules']>][] = [
      ['no modules', {}],
      ['vault only', { vault: { provider: 'neon', brand: 'neon' } }],
      ['gatehouse only', { gatehouse: { provider: 'better-auth', credentials: true } }],
      ['vault + gatehouse', { vault: { provider: 'pg', brand: 'supabase' }, gatehouse: { provider: 'better-auth' } }],
    ]

    for (const [, modules] of combos) {
      const state: ProjectState = {
        ...baseState,
        modules: modules as ProjectState['modules'],
      }
      await nextAdapter.generate(state, tmpDir)

      const config = readFileSync(join(projectDir, 'tower.config.ts'), 'utf-8')
      expect(config).toMatch(/^import \{ defineTower \} from "towerjs\/blueprint"/)
      expect(config).toMatch(/export default defineTower\(/)
      expect(config).toMatch(/}\);?\s*$/)
      rmSync(projectDir, { recursive: true, force: true })
    }
  })
})
