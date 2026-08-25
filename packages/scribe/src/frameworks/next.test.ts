import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { execa } from 'execa'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProjectState } from '../state.js'
import { capitalize, envExample, towerConfig } from './next.js'
import { nextAdapter } from './next.js'

const baseState: ProjectState = {
  projectName: 'my-app',
  framework: 'next',
  modules: {},
  frameworkAnswers: { tailwind: true },
  deployment: 'vercel',
  runtime: 'node',
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

    expect(result).toContain('import { defineTower')
    expect(result).toContain('from "@towerjs/tower"')
    expect(result).toContain('modules: [')
  })

  it('keeps architecture in tower.config.ts and credentials in the environment contract', () => {
    const stateWithSocial: ProjectState = {
      ...baseState,
      modules: { gatehouse: { social: { google: {} } } },
    }
    const config = towerConfig(stateWithSocial)
    const environment = envExample(stateWithSocial)

    expect(config).toContain("env.optional('GOOGLE_CLIENT_ID')")
    expect(config).not.toContain('process.env.')
    expect(environment).toContain('GOOGLE_CLIENT_ID=')
    expect(environment).toContain('GOOGLE_CLIENT_SECRET=')
  })

  it('generates config with vault module', () => {
    const state: ProjectState = {
      ...baseState,
      modules: { vault: { provider: 'neon', brand: 'neon' } },
    }
    const result = towerConfig(state)

    expect(result).toContain('vault({')
    expect(result).toContain('provider: "neon"')
    expect(result).not.toContain('brand')
  })

  it('generates config with gatehouse module', () => {
    const state: ProjectState = {
      ...baseState,
      modules: { gatehouse: {} },
    }
    const result = towerConfig(state)

    expect(result).toContain('gatehouse({')
    expect(result).toContain('appName: "My App"')
  })

  it('generates config with multiple modules', () => {
    const state: ProjectState = {
      ...baseState,
      modules: {
        vault: { provider: 'neon', brand: 'neon' },
        gatehouse: { credentials: true },
      },
    }
    const result = towerConfig(state)

    expect(result).toContain('vault({')
    expect(result).toContain('gatehouse({')
    expect(result).toContain('provider: "neon"')
    expect(result).toContain('credentials: true')
    expect(result).not.toContain('brand')
  })

  it('generates config with Tower-shaped gatehouse features', () => {
    const state: ProjectState = {
      ...baseState,
      modules: {
        gatehouse: { credentials: true, social: { google: {} } },
      },
    }
    const result = towerConfig(state)

    expect(result).toContain('credentials: true')
    expect(result).toContain('google')
    expect(result).toContain("env.optional('GOOGLE_CLIENT_ID')")
    expect(result).not.toContain('GOOGLE_CLIENT_ID ? { google: {} }')
  })

  it('emits guarded social config that skips providers without credentials', () => {
    const state: ProjectState = {
      ...baseState,
      modules: {
        gatehouse: { credentials: true, social: { google: {}, github: {} } },
      },
    }
    const result = towerConfig(state)

    expect(result).toContain(
      "...(env.optional('GOOGLE_CLIENT_ID') ? { google: { clientId: env.string('GOOGLE_CLIENT_ID'), clientSecret: env.string('GOOGLE_CLIENT_SECRET') } } : {})"
    )
    expect(result).toContain(
      "...(env.optional('GITHUB_CLIENT_ID') ? { github: { clientId: env.string('GITHUB_CLIENT_ID'), clientSecret: env.string('GITHUB_CLIENT_SECRET') } } : {})"
    )
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

  it('defaults to link-based email verification when gatehouse and courier email are configured', () => {
    const state: ProjectState = {
      ...baseState,
      modules: {
        gatehouse: { credentials: true },
        courier: { email: { provider: 'resend', from: 'My App <onboarding@resend.dev>' } },
      },
    }
    const result = towerConfig(state)

    expect(result).toContain('emailVerification: {')
    expect(result).toContain('sendOnSignUp: true')
  })

  it('does not add email verification without a courier email provider', () => {
    const state: ProjectState = {
      ...baseState,
      modules: { gatehouse: { credentials: true } },
    }
    const result = towerConfig(state)

    expect(result).not.toContain('emailVerification')
  })

  it('does not override an explicit emailVerification config', () => {
    const state: ProjectState = {
      ...baseState,
      modules: {
        gatehouse: { credentials: true, emailVerification: { method: 'otp' } },
        courier: { email: { provider: 'resend', from: 'My App <onboarding@resend.dev>' } },
      },
    }
    const result = towerConfig(state)

    expect(result).toContain('method: "otp"')
    expect(result).not.toContain('sendOnSignUp: true')
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
      modules: { gatehouse: {} },
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

  it('references tower.config.js in courier hint for JavaScript projects', () => {
    const state: ProjectState = {
      ...baseState,
      frameworkAnswers: { tailwind: true, typescript: false },
      modules: { courier: {} },
    }
    const result = envExample(state)

    expect(result).toContain('Add a provider in tower.config.js')
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

  it('shows social provider env vars when social login is enabled', () => {
    const state: ProjectState = {
      ...baseState,
      modules: { gatehouse: { credentials: true, social: { google: {}, github: {} } } },
    }
    const result = envExample(state)

    expect(result).toContain('GOOGLE_CLIENT_ID=')
    expect(result).toContain('GOOGLE_CLIENT_SECRET=')
    expect(result).toContain('GITHUB_CLIENT_ID=')
    expect(result).toContain('GITHUB_CLIENT_SECRET=')
  })
})

// ─── nextAdapter.generate needs separate mocks ───────────

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('# Next.js project\n'),
}))

vi.mock('../package-manager.js', () => ({
  detectPackageManager: vi.fn(() => 'pnpm'),
  nextAppFlag: vi.fn((pm: string) => `--use-${pm}`),
  addCommand: vi.fn((pm: string, dev = false) => [pm, 'add', ...(dev ? ['-D'] : [])]),
}))

describe('nextAdapter.generate', () => {
  const state: ProjectState = {
    projectName: 'my-app',
    framework: 'next',
    modules: {},
    frameworkAnswers: { tailwind: true },
    deployment: 'vercel',
    runtime: 'node',
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
        '--ts',
        '--tailwind',
        '--src-dir',
        '--no-react-compiler',
        '--agents-md',
      ]),
      { cwd: '/target', stdio: 'inherit' }
    )
  })

  it('passes --js to create-next-app when typescript is disabled', async () => {
    const jsState: ProjectState = {
      ...state,
      frameworkAnswers: { tailwind: true, typescript: false },
    }

    await nextAdapter.generate(jsState, '/target')

    expect(execa).toHaveBeenCalledWith(
      'npx',
      expect.arrayContaining(['create-next-app@latest', '--js', '--tailwind']),
      { cwd: '/target', stdio: 'inherit' }
    )
  })

  it('writes tower.config.js and page.jsx when typescript is disabled', async () => {
    const jsState: ProjectState = {
      ...state,
      frameworkAnswers: { tailwind: true, typescript: false },
    }

    await nextAdapter.generate(jsState, '/target')

    expect(writeFile).toHaveBeenCalledWith(expect.stringContaining('tower.config.js'), expect.any(String))
    expect(writeFile).toHaveBeenCalledWith(expect.stringContaining(join('src', 'app', 'page.jsx')), expect.any(String))
    const configWrite = vi
      .mocked(writeFile)
      .mock.calls.find(([p]) => typeof p === 'string' && p.includes('tower.config'))
    expect(configWrite![0]).not.toContain('tower.config.ts')
  })

  it('writes route.js and proxy.js for gatehouse when typescript is disabled', async () => {
    const jsState: ProjectState = {
      ...state,
      frameworkAnswers: { tailwind: true, typescript: false },
      modules: { gatehouse: { credentials: true } },
    }

    await nextAdapter.generate(jsState, '/target')

    expect(writeFile).toHaveBeenCalledWith(expect.stringContaining('route.js'), expect.stringContaining('GET'))
    expect(writeFile).toHaveBeenCalledWith(expect.stringContaining('proxy.js'), expect.any(String))
    const proxyWrite = vi.mocked(writeFile).mock.calls.find(([p]) => typeof p === 'string' && p.includes('proxy'))
    expect(proxyWrite![0]).not.toContain('proxy.ts')
  })

  it('writes next.config.mjs for edge runtime when typescript is disabled', async () => {
    const jsState: ProjectState = {
      ...state,
      frameworkAnswers: { tailwind: true, typescript: false },
      runtime: 'edge',
    }

    await nextAdapter.generate(jsState, '/target')

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('next.config.mjs'),
      expect.stringContaining('withTowerEdge')
    )
    const configWrite = vi
      .mocked(writeFile)
      .mock.calls.find(([p]) => typeof p === 'string' && p.includes('next.config'))
    expect(configWrite![0]).not.toContain('next.config.ts')
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
      modules: { gatehouse: { credentials: true } },
    }

    await nextAdapter.generate(stateWithGatehouse, '/target')

    expect(mkdir).toHaveBeenCalledWith(expect.stringContaining('auth'), { recursive: true })
    expect(writeFile).toHaveBeenCalledWith(expect.stringContaining('route.ts'), expect.stringContaining('GET'))
    expect(writeFile).toHaveBeenCalledWith(expect.stringContaining('proxy.ts'), expect.any(String))
  })

  it('does not generate sign-in/sign-up pages by default — only with --template auth', async () => {
    const stateWithGatehouse: ProjectState = {
      ...state,
      modules: { gatehouse: { credentials: true } },
    }

    await nextAdapter.generate(stateWithGatehouse, '/target')

    expect(mkdir).not.toHaveBeenCalledWith(expect.stringContaining(join('src', 'app', 'sign-in')), { recursive: true })
  })

  it('auth template emits ui components, auth pages, dashboard, and model files', async () => {
    const authState: ProjectState = {
      ...state,
      template: 'auth',
      modules: { vault: {}, gatehouse: { credentials: true } },
    }

    await nextAdapter.generate(authState, '/target')

    expect(writeFile).toHaveBeenCalledWith(expect.stringContaining(join('ui', 'button.tsx')), expect.any(String))
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('sign-in'),
      expect.stringContaining('gatehouse/actions')
    )
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('dashboard'),
      expect.stringContaining('Project.scope')
    )
    expect(writeFile).toHaveBeenCalledWith(expect.stringContaining(join('models', 'project.ts')), expect.any(String))
  })

  it('rejects unknown templates', async () => {
    await expect(nextAdapter.generate({ ...state, template: 'bogus' }, '/target')).rejects.toThrow(
      'Unknown template "bogus"'
    )
  })

  it('writes a minimal homepage', async () => {
    await nextAdapter.generate(state, '/target')

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining(join('src', 'app', 'page.tsx')),
      expect.stringContaining('Your Tower application is ready')
    )
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
        gatehouse: { credentials: true },
      },
    }

    await nextAdapter.generate(stateWithModules, '/target')

    const [, agentsContent] = vi
      .mocked(writeFile)
      .mock.calls.find(([path]) => typeof path === 'string' && path.includes('AGENTS.md')) ?? ['']
    expect(agentsContent).toContain('my-app')
    expect(agentsContent).toContain('gatehouse')
    expect(agentsContent).toContain('vault')
  })

  it('AGENTS.md references js files and fences for JavaScript projects', async () => {
    const jsState: ProjectState = {
      ...state,
      frameworkAnswers: { tailwind: true, typescript: false },
      modules: { gatehouse: { credentials: true } },
    }

    await nextAdapter.generate(jsState, '/target')

    const [, agentsContent] = vi
      .mocked(writeFile)
      .mock.calls.find(([path]) => typeof path === 'string' && path.includes('AGENTS.md')) ?? ['']
    expect(agentsContent).toContain('src/proxy.js')
    expect(agentsContent).toContain('tower.config.js')
    expect(agentsContent).not.toContain('src/proxy.ts')
    expect(agentsContent).not.toContain('tower.config.ts')
    expect(agentsContent).toContain('```js')
    expect(agentsContent).toContain("formData.get('password'))")
  })

  it('AGENTS.md appends Tower content after the generated Next.js content', async () => {
    await nextAdapter.generate(state, '/target')

    const [, agentsContent] = vi
      .mocked(writeFile)
      .mock.calls.find(([path]) => typeof path === 'string' && path.includes('AGENTS.md')) ?? ['']
    expect(agentsContent).toContain('# Next.js project')
    expect(agentsContent).toContain('\n\n# Project:')
    expect(agentsContent).toContain('composable monolithic stack')
  })

  it('installs @towerjs/tower dependency', async () => {
    await nextAdapter.generate(state, '/target')

    expect(execa).toHaveBeenCalledWith('pnpm', ['add', '@towerjs/tower'], {
      cwd: expect.stringContaining('my-app'),
      stdio: 'inherit',
    })
  })

  it('installs @towerjs/gatehouse when gatehouse is selected', async () => {
    const stateWithGatehouse: ProjectState = {
      ...state,
      modules: { gatehouse: { credentials: true } },
    }

    await nextAdapter.generate(stateWithGatehouse, '/target')

    expect(execa).toHaveBeenCalledWith('pnpm', ['add', '@towerjs/tower', '@towerjs/gatehouse'], {
      cwd: expect.stringContaining('my-app'),
      stdio: 'inherit',
    })
  })

  it('installs selected vault and courier dependencies directly', async () => {
    const stateWithModules: ProjectState = {
      ...state,
      modules: { vault: { provider: 'pg' }, courier: { email: { provider: 'console' } } },
    }

    await nextAdapter.generate(stateWithModules, '/target')

    expect(execa).toHaveBeenCalledWith('pnpm', ['add', '@towerjs/tower', '@towerjs/vault', '@towerjs/courier'], {
      cwd: expect.stringContaining('my-app'),
      stdio: 'inherit',
    })
  })

  it('does not install @towerjs/gatehouse without gatehouse', async () => {
    await nextAdapter.generate(state, '/target')

    const gatehouseAdd = vi
      .mocked(execa)
      .mock.calls.find(([, args]) => Array.isArray(args) && args.includes('@towerjs/gatehouse'))
    expect(gatehouseAdd).toBeUndefined()
  })

  it('does not add product-specific pnpm workspace configuration', async () => {
    await nextAdapter.generate(state, '/target')

    const workspaceWrite = vi
      .mocked(writeFile)
      .mock.calls.find(([path]) => typeof path === 'string' && path.endsWith('pnpm-workspace.yaml'))
    expect(workspaceWrite).toBeUndefined()
  })

  it('does not install @towerjs/edge on node runtime', async () => {
    await nextAdapter.generate(state, '/target')

    const edgeAdd = vi
      .mocked(execa)
      .mock.calls.find(([, args]) => Array.isArray(args) && args.includes('@towerjs/edge'))
    expect(edgeAdd).toBeUndefined()
  })

  it('does not write next.config.ts with withTowerEdge on node runtime', async () => {
    await nextAdapter.generate(state, '/target')

    const nextConfigCall = vi
      .mocked(writeFile)
      .mock.calls.find(([path]) => typeof path === 'string' && path.includes('next.config.ts'))
    expect(nextConfigCall).toBeUndefined()
  })

  it('installs @towerjs/edge as a dev dependency on edge runtime', async () => {
    const edgeState: ProjectState = {
      ...state,
      runtime: 'edge',
    }

    await nextAdapter.generate(edgeState, '/target')

    expect(execa).toHaveBeenCalledWith('pnpm', ['add', '-D', '@towerjs/edge'], {
      cwd: expect.stringContaining('my-app'),
      stdio: 'inherit',
    })
  })

  it('writes next.config.ts with withTowerEdge on edge runtime', async () => {
    const edgeState: ProjectState = {
      ...state,
      runtime: 'edge',
    }

    await nextAdapter.generate(edgeState, '/target')

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('next.config.ts'),
      expect.stringContaining('withTowerEdge')
    )
  })

  it('writes .prettierrc with tailwind plugins when tailwind is selected', async () => {
    await nextAdapter.generate(state, '/target')

    const [, prettierContent] = vi
      .mocked(writeFile)
      .mock.calls.find(([path]) => typeof path === 'string' && path.includes('.prettierrc')) ?? ['']
    expect(prettierContent).toContain('prettier-plugin-tailwindcss')
    expect(prettierContent).toContain('prettier-plugin-tailwindcss-canonical-classes')
  })

  it('writes .prettierrc without tailwind plugins when tailwind is not selected', async () => {
    const stateWithoutTailwind: ProjectState = {
      ...state,
      frameworkAnswers: { tailwind: false },
    }

    await nextAdapter.generate(stateWithoutTailwind, '/target')

    const [, prettierContent] = vi
      .mocked(writeFile)
      .mock.calls.find(([path]) => typeof path === 'string' && path.includes('.prettierrc')) ?? ['']
    expect(prettierContent).toContain('prettier-plugin-organize-imports')
    expect(prettierContent).not.toContain('prettier-plugin-tailwindcss')
  })

  it('installs prettier and prettier-plugin-organize-imports', async () => {
    await nextAdapter.generate(state, '/target')

    const prettierCalls = vi
      .mocked(execa)
      .mock.calls.filter(([, args]) => Array.isArray(args) && args.includes('prettier-plugin-organize-imports'))
    expect(prettierCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('installs tailwind prettier plugins when tailwind is selected', async () => {
    await nextAdapter.generate(state, '/target')

    const tailwindCall = vi
      .mocked(execa)
      .mock.calls.find(([, args]) => Array.isArray(args) && args.includes('prettier-plugin-tailwindcss'))
    expect(tailwindCall).toBeDefined()
    expect(tailwindCall![1]).toContain('prettier-plugin-tailwindcss-canonical-classes')
  })

  it('does not install tailwind prettier plugins without tailwind', async () => {
    const stateWithoutTailwind: ProjectState = {
      ...state,
      frameworkAnswers: { tailwind: false },
    }

    await nextAdapter.generate(stateWithoutTailwind, '/target')

    const tailwindCall = vi
      .mocked(execa)
      .mock.calls.find(([, args]) => Array.isArray(args) && args.includes('prettier-plugin-tailwindcss'))
    expect(tailwindCall).toBeUndefined()
  })
})
