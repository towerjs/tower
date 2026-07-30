import { describe, expect, it, vi, beforeEach } from 'vitest'
import { towerConfig, envExample, capitalize } from './next.js'
import type { ProjectState } from '../state.js'

const baseState: ProjectState = {
  projectName: 'my-app',
  framework: 'next',
  modules: {},
  frameworkAnswers: { typescript: true, tailwind: true },
}

describe('capitalize', () => {
  it('capitalizes the first letter', () => {
    expect(capitalize('vault')).toBe('Vault')
    expect(capitalize('gatehouse')).toBe('Gatehouse')
  })
})

describe('towerConfig', () => {
  it('generates config with no modules', () => {
    const result = towerConfig(baseState)

    expect(result).toContain('import { defineTower } from "towerjs/blueprint"')
    expect(result).toContain('modules:')
  })

  it('generates config with vault module', () => {
    const state: ProjectState = {
      ...baseState,
      modules: { vault: { provider: 'neon', brand: 'neon' } },
    }
    const result = towerConfig(state)

    expect(result).toContain('vault: {')
    expect(result).toContain('provider: "neon"')
    expect(result).not.toContain('brand')
  })

  it('generates config with gatehouse module', () => {
    const state: ProjectState = {
      ...baseState,
      modules: { gatehouse: {} },
    }
    const result = towerConfig(state)

    expect(result).toContain('gatehouse:')
    expect(result).toContain('appName: "My App"')
  })

  it('generates config with multiple modules', () => {
    const state: ProjectState = {
      ...baseState,
      modules: {
        vault: { provider: 'neon', brand: 'neon' },
        gatehouse: { provider: 'better-auth' },
      },
    }
    const result = towerConfig(state)

    expect(result).toContain('vault:')
    expect(result).toContain('gatehouse:')
    expect(result).toContain('provider: "neon"')
    expect(result).toContain('provider: "better-auth"')
    expect(result).not.toContain('brand')
  })

  it('generates config with Tower-shaped gatehouse features', () => {
    const state: ProjectState = {
      ...baseState,
      modules: {
        gatehouse: { provider: 'better-auth', credentials: true, social: { google: {} } },
      },
    }
    const result = towerConfig(state)

    expect(result).toContain('credentials: true')
    expect(result).toContain('google')
  })

  it('generates courier config with provider', () => {
    const state: ProjectState = {
      ...baseState,
      modules: { courier: { email: { provider: 'resend', from: 'My App <onboarding@resend.dev>' } } },
    }
    const result = towerConfig(state)

    expect(result).toContain('provider: "resend"')
    expect(result).toContain('onboarding@resend.dev')
  })
})

describe('envExample', () => {
  it('returns empty for no modules', () => {
    expect(envExample(baseState)).toBe('\n')
  })

  it('includes DATABASE_URL when vault is enabled', () => {
    const state: ProjectState = {
      ...baseState,
      modules: { vault: { provider: 'neon', brand: 'neon' } },
    }
    const result = envExample(state)

    expect(result).toContain('DATABASE_URL')
    expect(result).toContain('Neon Console → Connection Details')
  })

  it('shows Supabase-specific hints', () => {
    const state: ProjectState = {
      ...baseState,
      modules: { vault: { provider: 'pg', brand: 'supabase' } },
    }
    const result = envExample(state)

    expect(result).toContain('DATABASE_URL')
    expect(result).toContain('Supabase Dashboard → Project Settings → Database')
    expect(result).toContain('port 6543')
  })

  it('shows Railway-specific hints', () => {
    const state: ProjectState = {
      ...baseState,
      modules: { vault: { provider: 'pg', brand: 'railway' } },
    }
    const result = envExample(state)

    expect(result).toContain('Railway Dashboard')
    expect(result).toContain('PostgreSQL plugin')
  })

  it('shows generic hints for other providers', () => {
    const state: ProjectState = {
      ...baseState,
      modules: { vault: { provider: 'pg', brand: 'other' } },
    }
    const result = envExample(state)

    expect(result).toContain('DATABASE_URL')
    expect(result).not.toContain('Dashboard')
  })

  it('includes gatehouse env vars', () => {
    const state: ProjectState = {
      ...baseState,
      modules: { gatehouse: { provider: 'better-auth' } },
    }
    const result = envExample(state)

    expect(result).toContain('GATEHOUSE_SECRET')
    expect(result).toContain('GATEHOUSE_URL')
  })

  it('shows courier hint when no provider configured', () => {
    const state: ProjectState = {
      ...baseState,
      modules: { courier: {} },
    }
    const result = envExample(state)

    expect(result).toContain('Add a provider in tower.config.ts')
  })

  it('shows Resend env vars when resend is configured', () => {
    const state: ProjectState = {
      ...baseState,
      modules: { courier: { email: { provider: 'resend' } } },
    }
    const result = envExample(state)

    expect(result).toContain('RESEND_API_KEY')
    expect(result).not.toContain('SMTP_HOST')
  })

  it('shows SMTP env vars when smtp is configured', () => {
    const state: ProjectState = {
      ...baseState,
      modules: { courier: { email: { provider: 'smtp' } } },
    }
    const result = envExample(state)

    expect(result).toContain('SMTP_HOST')
    expect(result).not.toContain('AWS_ACCESS_KEY_ID')
  })
})

// ─── nextAdapter.prompt and generate need separate mocks ───────────

vi.mock('@inquirer/prompts', () => ({
  select: vi.fn(),
}))

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}))

import { nextAdapter } from './next.js'
import { select } from '@inquirer/prompts'
import { execa } from 'execa'
import { mkdir, writeFile } from 'node:fs/promises'

describe('nextAdapter.prompt', () => {
  it('returns typescript and tailwind choices', async () => {
    vi.mocked(select).mockResolvedValueOnce(true).mockResolvedValueOnce(true)

    const answers = await nextAdapter.prompt()

    expect(answers).toEqual({ typescript: true, tailwind: true })
  })

  it('allows opting out of typescript and tailwind', async () => {
    vi.mocked(select).mockResolvedValueOnce(false).mockResolvedValueOnce(false)

    const answers = await nextAdapter.prompt()

    expect(answers).toEqual({ typescript: false, tailwind: false })
  })
})

describe('nextAdapter.generate', () => {
  const state: ProjectState = {
    projectName: 'my-app',
    framework: 'next',
    modules: {},
    frameworkAnswers: { typescript: true, tailwind: true },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls execa with create-next-app and correct flags', async () => {
    await nextAdapter.generate(state, '/target')

    expect(execa).toHaveBeenCalledWith(
      'npx',
      expect.arrayContaining([
        'create-next-app@latest',
        'my-app',
        '--typescript',
        '--tailwind',
        '--no-turbopack',
        '--src-dir',
      ]),
      { cwd: '/target', stdio: 'inherit' }
    )
  })

  it('writes tower.config.ts and .env.example', async () => {
    await nextAdapter.generate(state, '/target')

    expect(writeFile).toHaveBeenCalledWith(expect.stringContaining('tower.config.ts'), expect.any(String))
    expect(writeFile).toHaveBeenCalledWith(expect.stringContaining('.env.example'), expect.any(String))
  })

  it('writes .env when vault or gatehouse is configured', async () => {
    const stateWithModules: ProjectState = {
      ...state,
      modules: { vault: { provider: 'neon', brand: 'neon' } },
    }

    await nextAdapter.generate(stateWithModules, '/target')

    expect(writeFile).toHaveBeenCalledWith(expect.stringContaining('.env'), expect.stringContaining('DATABASE_URL'))
  })

  it('creates auth route and proxy file for gatehouse', async () => {
    const stateWithGatehouse: ProjectState = {
      ...state,
      modules: { gatehouse: { provider: 'better-auth' } },
    }

    await nextAdapter.generate(stateWithGatehouse, '/target')

    expect(mkdir).toHaveBeenCalledWith(expect.stringContaining('auth'), { recursive: true })
    expect(writeFile).toHaveBeenCalledWith(expect.stringContaining('route.ts'), expect.stringContaining('GET'))
    expect(writeFile).toHaveBeenCalledWith(expect.stringContaining('proxy.ts'), expect.any(String))
  })

  it('creates actions.ts when gatehouse is selected', async () => {
    const stateWithGatehouse: ProjectState = {
      ...state,
      modules: { gatehouse: { provider: 'better-auth' } },
    }

    await nextAdapter.generate(stateWithGatehouse, '/target')

    expect(mkdir).toHaveBeenCalledWith(expect.stringContaining('lib/auth'), { recursive: true })
    expect(writeFile).toHaveBeenCalledWith(expect.stringContaining('actions.ts'), expect.stringContaining("from 'towerjs/gatehouse/actions'"))
  })

  it('does not create actions.ts when gatehouse is not selected', async () => {
    await nextAdapter.generate(state, '/target')

    expect(writeFile).not.toHaveBeenCalledWith(expect.stringContaining('actions.ts'), expect.any(String))
  })

  it('writes .prettierrc for all projects', async () => {
    await nextAdapter.generate(state, '/target')

    expect(writeFile).toHaveBeenCalledWith(expect.stringContaining('.prettierrc'), expect.any(String))
  })

  it('writes AGENTS.md for all projects', async () => {
    await nextAdapter.generate(state, '/target')

    expect(writeFile).toHaveBeenCalledWith(expect.stringContaining('AGENTS.md'), expect.any(String))
  })

  it('AGENTS.md contains project name and module info', async () => {
    const stateWithModules: ProjectState = {
      ...state,
      modules: {
        vault: { provider: 'neon' },
        gatehouse: { provider: 'better-auth' },
      },
    }

    await nextAdapter.generate(stateWithModules, '/target')

    const [, agentsContent] = vi.mocked(writeFile).mock.calls.find(
      ([path]) => typeof path === 'string' && path.includes('AGENTS.md'),
    ) ?? ['']
    expect(agentsContent).toContain('my-app')
    expect(agentsContent).toContain('gatehouse')
    expect(agentsContent).toContain('vault')
  })

  it('installs towerjs dependency', async () => {
    await nextAdapter.generate(state, '/target')

    expect(execa).toHaveBeenCalledWith('pnpm', ['add', 'towerjs'], {
      cwd: expect.stringContaining('my-app'),
      stdio: 'inherit',
    })
  })

  it('installs prettier and prettier-plugin-organize-imports', async () => {
    await nextAdapter.generate(state, '/target')

    const prettierCalls = vi.mocked(execa).mock.calls.filter(
      ([, args]) => Array.isArray(args) && args.includes('prettier-plugin-organize-imports'),
    )
    expect(prettierCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('installs tailwind prettier plugins when tailwind is selected', async () => {
    await nextAdapter.generate(state, '/target')

    const tailwindCall = vi.mocked(execa).mock.calls.find(
      ([, args]) => Array.isArray(args) && args.includes('prettier-plugin-tailwindcss'),
    )
    expect(tailwindCall).toBeDefined()
    expect(tailwindCall![1]).toContain('prettier-plugin-tailwindcss-canonical-classes')
  })

  it('does not install tailwind prettier plugins without tailwind', async () => {
    const stateWithoutTailwind: ProjectState = {
      ...state,
      frameworkAnswers: { typescript: true, tailwind: false },
    }

    await nextAdapter.generate(stateWithoutTailwind, '/target')

    const tailwindCall = vi.mocked(execa).mock.calls.find(
      ([, args]) => Array.isArray(args) && args.includes('prettier-plugin-tailwindcss'),
    )
    expect(tailwindCall).toBeUndefined()
  })
})
