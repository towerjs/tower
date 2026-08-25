import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { nextAdapter } from './frameworks/next.js'
import type { ProjectState } from './state.js'

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
  select: vi.fn(),
  checkbox: vi.fn(),
}))

const baseState: ProjectState = {
  projectName: 'my-tower-app',
  framework: 'next',
  modules: {},
  deployment: 'vercel',
  frameworkAnswers: { tailwind: true },
  runtime: 'node',
}

describe('scaffolding — real file output', () => {
  let tmpDir: string
  let projectDir: string
  const originalUserAgent = process.env.npm_config_user_agent

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.npm_config_user_agent = 'pnpm/10.0.0'
    tmpDir = mkdtempSync(join(tmpdir(), 'tower-e2e-'))

    vi.mocked(execa).mockImplementation(async (bin: string) => {
      if (bin === 'npx') {
        mkdirSync(join(tmpDir, baseState.projectName, 'src', 'app'), { recursive: true })
        writeFileSync(
          join(tmpDir, baseState.projectName, 'package.json'),
          JSON.stringify({
            name: baseState.projectName,
            private: true,
            scripts: { dev: 'next dev' },
            dependencies: { next: 'latest', react: 'latest' },
          })
        )
        writeFileSync(join(tmpDir, baseState.projectName, 'tsconfig.json'), '{}')
        writeFileSync(join(tmpDir, baseState.projectName, 'next.config.ts'), '')
        writeFileSync(join(tmpDir, baseState.projectName, 'next.config.mjs'), '')
      }
    })

    projectDir = join(tmpDir, baseState.projectName)
  })

  afterEach(() => {
    if (originalUserAgent === undefined) {
      delete process.env.npm_config_user_agent
    } else {
      process.env.npm_config_user_agent = originalUserAgent
    }
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('writes all scaffold files for vault + gatehouse', async () => {
    const state: ProjectState = {
      ...baseState,
      modules: {
        vault: { provider: 'neon', brand: 'neon' },
        gatehouse: { credentials: true, social: { google: {}, github: {} } },
      },
    }
    await nextAdapter.generate(state, tmpDir)

    expect(existsSync(join(projectDir, 'tower.config.ts'))).toBe(true)
    expect(existsSync(join(projectDir, '.env.example'))).toBe(true)
    expect(existsSync(join(projectDir, '.env'))).toBe(true)
    expect(existsSync(join(projectDir, 'src', 'app', 'api', 'auth', '[...all]', 'route.ts'))).toBe(true)
    expect(existsSync(join(projectDir, 'src', 'proxy.ts'))).toBe(true)
    expect(existsSync(join(projectDir, '.prettierrc'))).toBe(true)
    expect(existsSync(join(projectDir, 'AGENTS.md'))).toBe(true)
    const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf-8'))
    expect(pkg.scripts.dev).toBe('tower dev')

    const config = readFileSync(join(projectDir, 'tower.config.ts'), 'utf-8')
    expect(config).toContain('defineTower')
    expect(config).toContain('vault')
    expect(config).toContain('gatehouse')
    expect(config).toContain('neon')
    expect(config).toContain('google')
    expect(config).toContain('github')

    const envExample = readFileSync(join(projectDir, '.env.example'), 'utf-8')
    expect(envExample).toContain('DATABASE_URL')
    expect(envExample).toContain('GATEHOUSE_SECRET')

    const env = readFileSync(join(projectDir, '.env'), 'utf-8')
    expect(env).toContain('GATEHOUSE_SECRET')
    expect(env).toContain('DATABASE_URL')

    const home = readFileSync(join(projectDir, 'src', 'app', 'page.tsx'), 'utf-8')
    expect(home).toContain('Your Tower application is ready')

    const agents = readFileSync(join(projectDir, 'AGENTS.md'), 'utf-8')
    expect(agents).toContain('my-tower-app')
    expect(agents).toContain('gatehouse')
    expect(agents).toContain('vault')

    const prettier = readFileSync(join(projectDir, '.prettierrc'), 'utf-8')
    expect(prettier).toContain('prettier-plugin-organize-imports')
    expect(prettier).toContain('prettier-plugin-tailwindcss')
    expect(prettier).toContain('semi')
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
    expect(env).not.toContain('GATEHOUSE_SECRET')
    expect(existsSync(join(projectDir, 'src', 'proxy.ts'))).toBe(false)
  })

  it('writes auth route and proxy for gatehouse', async () => {
    const state: ProjectState = {
      ...baseState,
      modules: { gatehouse: { credentials: true } },
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

  it('scaffolds JavaScript files when typescript is disabled', async () => {
    const state: ProjectState = {
      ...baseState,
      frameworkAnswers: { tailwind: true, typescript: false },
      runtime: 'edge',
      modules: {
        vault: { provider: 'neon', brand: 'neon' },
        gatehouse: { credentials: true },
      },
    }
    await nextAdapter.generate(state, tmpDir)

    expect(existsSync(join(projectDir, 'tower.config.js'))).toBe(true)
    expect(existsSync(join(projectDir, 'tower.config.ts'))).toBe(false)
    expect(existsSync(join(projectDir, 'src', 'app', 'page.jsx'))).toBe(true)
    expect(existsSync(join(projectDir, 'src', 'app', 'page.tsx'))).toBe(false)
    expect(existsSync(join(projectDir, 'next.config.mjs'))).toBe(true)
    expect(existsSync(join(projectDir, 'src', 'proxy.js'))).toBe(true)
    expect(existsSync(join(projectDir, 'src', 'proxy.ts'))).toBe(false)
    expect(existsSync(join(projectDir, 'src', 'app', 'api', 'auth', '[...all]', 'route.js'))).toBe(true)
    expect(existsSync(join(projectDir, 'src', 'app', 'api', 'auth', '[...all]', 'route.ts'))).toBe(false)

    const nextConfig = readFileSync(join(projectDir, 'next.config.mjs'), 'utf-8')
    expect(nextConfig).toContain('withTowerEdge')

    const agents = readFileSync(join(projectDir, 'AGENTS.md'), 'utf-8')
    expect(agents).toContain('src/proxy.js')
    expect(agents).toContain('tower.config.js')
    expect(agents).not.toContain('tower.config.ts')
  })

  it('installs @towerjs/tower and the tower CLI', async () => {
    await nextAdapter.generate(baseState, tmpDir)
    expect(execa).toHaveBeenCalledWith(
      'pnpm',
      ['add', '@towerjs/tower'],
      expect.objectContaining({
        cwd: projectDir,
      })
    )
    expect(execa).toHaveBeenCalledWith(
      'pnpm',
      ['add', '-D', '@towerjs/scribe'],
      expect.objectContaining({
        cwd: projectDir,
      })
    )
  })

  it('generates valid tower.config.ts for all module combinations', async () => {
    const combos: [string, Partial<ProjectState['modules']>][] = [
      ['no modules', {}],
      ['vault only', { vault: { provider: 'neon', brand: 'neon' } }],
      ['gatehouse only', { gatehouse: { credentials: true } }],
      ['vault + gatehouse', { vault: { provider: 'pg', brand: 'supabase' }, gatehouse: { credentials: true } }],
    ]

    for (const [, modules] of combos) {
      const state: ProjectState = {
        ...baseState,
        modules: modules as ProjectState['modules'],
      }
      await nextAdapter.generate(state, tmpDir)

      const config = readFileSync(join(projectDir, 'tower.config.ts'), 'utf-8')
      expect(config).toMatch(/^import \{ defineTower(?:, env)? \} from "@towerjs\/tower(?:\/blueprint)?"/)
      expect(config).toMatch(/export default defineTower\(/)
      expect(config).toMatch(/}\);?\s*$/)
      rmSync(projectDir, { recursive: true, force: true })
    }
  })

  it('writes consistent output for every tailwind/typescript/module/runtime combination', async () => {
    const moduleCombos: Partial<ProjectState['modules']>[] = [
      {},
      { vault: { provider: 'neon', brand: 'neon' } },
      { gatehouse: { credentials: true } },
      {
        vault: { provider: 'neon', brand: 'neon' },
        gatehouse: { credentials: true },
        courier: { email: { provider: 'resend', from: 'a@b.com' } },
      },
    ]
    const tailwindChoices = [true, false]
    const typescriptChoices = [true, false]
    const runtimeChoices = ['node', 'edge'] as const

    for (const useTailwind of tailwindChoices) {
      for (const useTypeScript of typescriptChoices) {
        for (const runtime of runtimeChoices) {
          for (const modules of moduleCombos) {
            const state: ProjectState = {
              ...baseState,
              modules,
              frameworkAnswers: { tailwind: useTailwind, typescript: useTypeScript },
              runtime,
            }
            await nextAdapter.generate(state, tmpDir)

            const configFile = useTypeScript ? 'tower.config.ts' : 'tower.config.js'
            const nextConfigFile = useTypeScript ? 'next.config.ts' : 'next.config.mjs'
            const proxyFile = useTypeScript ? 'src/proxy.ts' : 'src/proxy.js'
            const routeFile = useTypeScript ? 'route.ts' : 'route.js'

            expect(existsSync(join(projectDir, configFile))).toBe(true)
            expect(existsSync(join(projectDir, '.env.example'))).toBe(true)

            const isEdge = runtime === 'edge'
            const nextConfig = readFileSync(join(projectDir, nextConfigFile), 'utf-8')
            if (isEdge) {
              expect(nextConfig).toContain('withTowerEdge')
            } else {
              expect(nextConfig).not.toContain('withTowerEdge')
            }

            const prettier = readFileSync(join(projectDir, '.prettierrc'), 'utf-8')
            expect(prettier).toContain('prettier-plugin-organize-imports')
            if (useTailwind) {
              expect(prettier).toContain('prettier-plugin-tailwindcss')
              expect(prettier).toContain('prettier-plugin-tailwindcss-canonical-classes')
            } else {
              expect(prettier).not.toContain('prettier-plugin-tailwindcss')
              expect(prettier).not.toContain('tailwindcss-canonical')
            }

            const hasGatehouse = Boolean(modules.gatehouse)
            expect(existsSync(join(projectDir, proxyFile))).toBe(hasGatehouse)
            expect(existsSync(join(projectDir, 'src', 'app', 'api', 'auth', '[...all]', routeFile))).toBe(hasGatehouse)

            const towerAddCalls = vi
              .mocked(execa)
              .mock.calls.filter(([bin, args]) => bin === 'pnpm' && Array.isArray(args) && args[0] === 'add')
            // Selected @towerjs/* modules are direct deps so pnpm's strict
            // dependency isolation works for real generated applications.
            for (const pkg of ['@towerjs/gatehouse', '@towerjs/vault', '@towerjs/courier']) {
              const directDep = towerAddCalls.some(([, args]) => (args as string[]).includes(pkg))
              expect(directDep).toBe(Boolean(modules[pkg.split('/').pop()!]))
            }

            const edgeDevDep = towerAddCalls.some(
              ([, args]) => (args as string[]).includes('-D') && (args as string[]).includes('@towerjs/edge')
            )
            expect(edgeDevDep).toBe(isEdge)

            const scribeDevDep = towerAddCalls.some(
              ([, args]) => (args as string[]).includes('-D') && (args as string[]).includes('@towerjs/scribe')
            )
            expect(scribeDevDep).toBe(true)

            const tailwindPluginInstall = vi
              .mocked(execa)
              .mock.calls.some(
                ([bin, args]) =>
                  bin === 'pnpm' && Array.isArray(args) && (args as string[]).includes('prettier-plugin-tailwindcss')
              )
            expect(tailwindPluginInstall).toBe(useTailwind)

            rmSync(projectDir, { recursive: true, force: true })
            vi.clearAllMocks()
          }
        }
      }
    }
  })
})
