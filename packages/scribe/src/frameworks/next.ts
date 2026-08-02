import { randomBytes } from 'node:crypto'
import { execa } from 'execa'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { FrameworkAdapter } from './adapter.js'
import type { ProjectState } from '../state.js'
import { detectPackageManager, nextAppFlag, addCommand } from '../package-manager.js'

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const nextAdapter: FrameworkAdapter = {
  name: 'next',

  async generate(state: ProjectState, targetDir: string) {
    const answers = state.frameworkAnswers as { typescript?: boolean; tailwind?: boolean }
    const useTs = answers.typescript !== false
    const useTailwind = answers.tailwind === true
    const isEdge = state.runtime === 'edge'
    const pm = detectPackageManager()

    const flags: string[] = [
      state.projectName,
      '--eslint',
      '--app',
      '--src-dir',
      '--import-alias',
      '@/*',
      '--no-react-compiler',
      '--agents-md',
      nextAppFlag(pm),
    ]

    if (useTs) {
      flags.push('--ts')
    } else {
      flags.push('--js')
    }

    if (useTailwind) {
      flags.push('--tailwind')
    } else {
      flags.push('--no-tailwind')
    }

    await execa('npx', ['create-next-app@latest', ...flags], {
      cwd: targetDir,
      stdio: 'inherit',
    })

    const projectDir = join(targetDir, state.projectName)

    await writeFile(join(projectDir, 'tower.config.ts'), towerConfig(state))
    if (isEdge) {
      await writeFile(join(projectDir, 'next.config.ts'), nextConfig())
    }
    await writeFile(join(projectDir, '.env.example'), envExample(state))
    if (state.modules.gatehouse || state.modules.vault) {
      const envLines: string[] = []
      if (state.modules.gatehouse) {
        envLines.push(
          `# Authentication — auto-generated during setup`,
          `GATEHOUSE_SECRET="${randomBytes(32).toString('base64')}"`,
          `GATEHOUSE_URL="http://localhost:3000"`
        )
      }
      if (state.modules.vault) {
        if (envLines.length > 0) envLines.push(``)
        envLines.push(
          ...vaultEnvHints(state.modules.vault?.brand as string | undefined),
          `DATABASE_URL="postgres://user:password@localhost:5432/tower"`
        )
      }
      envLines.push(``)
      await writeFile(join(projectDir, '.env'), envLines.join('\n'))
    }

    if (state.modules.gatehouse) {
      const authDir = join(projectDir, 'src', 'app', 'api', 'auth', '[...all]')
      await mkdir(authDir, { recursive: true })
      await writeFile(join(authDir, 'route.ts'), authRoute())

      const actionsDir = join(projectDir, 'src', 'lib', 'auth')
      await mkdir(actionsDir, { recursive: true })
      await writeFile(join(actionsDir, 'actions.ts'), actionsFile())

      await writeFile(join(projectDir, 'src', 'proxy.ts'), proxyFile())
    }

    await writeFile(join(projectDir, '.prettierrc'), prettierConfig(useTailwind))

    const agentsPath = join(projectDir, 'AGENTS.md')
    const generated = await readFile(agentsPath, 'utf8').catch(() => '')
    const towerSection = agentsMd(state)
    await writeFile(agentsPath, generated + '\n\n' + towerSection)

    const towerDeps: string[] = ['towerjs']
    if (state.modules.gatehouse) {
      towerDeps.push('@towerjs/gatehouse')
    }
    await execa(pm, [...addCommand(pm).slice(1), ...towerDeps], { cwd: projectDir, stdio: 'inherit' })

    const cliDevDeps: string[] = ['@towerjs/scribe']
    await execa(pm, [...addCommand(pm, true).slice(1), ...cliDevDeps], { cwd: projectDir, stdio: 'inherit' })

    if (isEdge) {
      await execa(pm, [...addCommand(pm, true).slice(1), '@towerjs/edge'], { cwd: projectDir, stdio: 'inherit' })
    }

    const prettierDeps: string[] = ['prettier', 'prettier-plugin-organize-imports']
    if (useTailwind) {
      prettierDeps.push('prettier-plugin-tailwindcss', 'prettier-plugin-tailwindcss-canonical-classes')
    }
    await execa(pm, [...addCommand(pm, true).slice(1), ...prettierDeps], { cwd: projectDir, stdio: 'inherit' })
  },
}

const CLI_ONLY_KEYS = new Set(['brand'])

function formatValue(v: unknown, indent: number): string {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'string') return JSON.stringify(v)
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]'
    const items = v.map((e) => `${' '.repeat(indent + 2)}${formatValue(e, indent + 2)},`).join('\n')
    return `[\n${items}\n${' '.repeat(indent)}]`
  }
  if (typeof v === 'object') {
    const keys = Object.keys(v as Record<string, unknown>)
    if (keys.length === 0) return '{}'
    const entries = keys
      .map((k) => `${' '.repeat(indent + 2)}${k}: ${formatValue((v as Record<string, unknown>)[k], indent + 2)},`)
      .join('\n')
    return `{\n${entries}\n${' '.repeat(indent)}}`
  }
  return String(v)
}

function formatConfigLine(k: string, v: unknown, indent: number): string[] {
  if (v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v as Record<string, unknown>).length > 0) {
    return [`${' '.repeat(indent)}${k}: {`, ...renderObject(v as Record<string, unknown>, indent + 2), `${' '.repeat(indent)}},`]
  }
  return [`${' '.repeat(indent)}${k}: ${formatValue(v, indent)},`]
}

function renderObject(obj: Record<string, unknown>, indent: number): string[] {
  return Object.entries(obj).flatMap(([k, v]) => formatConfigLine(k, v, indent))
}

function moduleConfig(name: string, cfg: Record<string, unknown>): Record<string, unknown> {
  if (name === 'gatehouse') {
    return { ...cfg, appName: cfg.appName ?? 'My App' }
  }
  return cfg
}

/** Generates the tower.config.ts content for a new project. */
export function towerConfig(state: ProjectState): string {
  const modules = Object.entries(state.modules)
    .map(([name, cfg]) => {
      const resolved = moduleConfig(name, (cfg ?? {}) as Record<string, unknown>)
      const lines = Object.entries(resolved)
        .filter(([k, v]) => !CLI_ONLY_KEYS.has(k) && v !== undefined)
        .flatMap(([k, v]) => formatConfigLine(k, v, 6))
      if (lines.length === 0) return `    ${name}: {},`
      return `    ${name}: {\n${lines.join('\n')}\n    },`
    })
    .join('\n')

  return `import { defineTower } from "towerjs/blueprint";

export default defineTower({
  modules: {
${modules}
  },
});
`
}

function authRoute(): string {
  return `export { GET, POST } from "towerjs/gatehouse/next";
`
}

function nextConfig(): string {
  return `import { withTowerEdge } from "@towerjs/edge";

export default withTowerEdge({});
`
}

function proxyFile(): string {
  return `import { gatehouse } from "@towerjs/gatehouse";

const { handler } = gatehouse.proxy({
  public: ["/", "/sign-in", "/sign-up"],
  redirectIfAuthenticated: ["/sign-in", "/sign-up"],
  redirectTo: "/sign-in",
  redirectAfterSignIn: "/dashboard",
});

export const proxy = handler;

export const config = {
  matcher: ["/((?!_next/static|favicon.ico|api/auth).*)"],
};
`
}

function courierEnvHints(cfg: Record<string, unknown>): string[] {
  const email = cfg.email as Record<string, unknown> | undefined
  if (!email?.provider) return ['# Email — Courier', '# Add a provider in tower.config.ts to get started']
  const hints: Record<string, string[]> = {
    resend: ['# Email — Resend', '# RESEND_API_KEY='],
    smtp: ['# Email — SMTP', '# SMTP_HOST=', '# SMTP_USER=', '# SMTP_PASS='],
    ses: ['# Email — SES (AWS)', '# AWS_ACCESS_KEY_ID=', '# AWS_SECRET_ACCESS_KEY=', '# AWS_REGION='],
  }
  return hints[email.provider as string] ?? ['# Email — Courier']
}

function vaultEnvHints(brand?: string): string[] {
  switch (brand) {
    case 'neon':
      return ['# Database — Neon', '# Find your DATABASE_URL in the Neon Console → Connection Details']
    case 'supabase':
      return [
        '# Database — Supabase',
        '# Find your DATABASE_URL at: Supabase Dashboard → Project Settings → Database',
        '# Use the transaction pooler (port 6543) for serverless deployments',
      ]
    case 'railway':
      return [
        '# Database — Railway',
        '# Find your DATABASE_URL in the Railway Dashboard → your project → PostgreSQL plugin → Connect',
      ]
    default:
      return ['# Database']
  }
}

/** Generates the .env.example content for the new project. */
export function envExample(state: ProjectState): string {
  const vars: string[] = []

  for (const [name, cfg] of Object.entries(state.modules)) {
    if (name === 'vault') {
      if (vars.length > 0) vars.push('')
      vars.push(...vaultEnvHints(cfg?.brand as string | undefined))
      vars.push('DATABASE_URL="postgres://user:password@localhost:5432/tower"')
    }
    if (name === 'gatehouse') {
      if (vars.length > 0) vars.push('')
      vars.push('# Authentication')
      vars.push('GATEHOUSE_SECRET=')
      vars.push('GATEHOUSE_URL="http://localhost:3000"')
    }
    if (name === 'courier') {
      if (vars.length > 0) vars.push('')
      vars.push(...courierEnvHints(cfg ?? {}))
    }
  }

  return vars.join('\n') + '\n'
}

function actionsFile(): string {
  return `'use server'

export {
  signIn,
  signUp,
  signOut,
  updateProfile,
  changePassword,
} from 'towerjs/gatehouse/actions'

// Add more actions from the registry as needed:
// createOrganization, updateOrganization, deleteOrganization,
// inviteMember, removeMember, cancelInvitation, acceptInvitation,
// revokeSession, revokeOtherSessions,
// verifyTwoFactor, disableTwoFactor,
// assignRole, removeRole

// For actions with custom returns, use \`action\` directly:
// import { action } from 'towerjs/gatehouse/next'
// import { gatehouse } from 'towerjs/gatehouse'
//
// export const enableTwoFactor = action(async (formData: FormData) => {
//   return gatehouse.totp.enable(formData.get('password') as string)
// })
`
}

function prettierConfig(tailwind: boolean): string {
  const plugins = ['prettier-plugin-organize-imports']
  if (tailwind) {
    plugins.push('prettier-plugin-tailwindcss', 'prettier-plugin-tailwindcss-canonical-classes')
  }
  return JSON.stringify(
    {
      semi: false,
      singleQuote: true,
      trailingComma: 'all',
      printWidth: 120,
      tabWidth: 2,
      plugins,
    },
    null,
    2,
  ) + '\n'
}

function agentsMd(state: ProjectState): string {
  const lines: string[] = [
    '# Project: ' + state.projectName,
    '',
    'This project uses **Tower** — a composable monolithic stack for JavaScript applications.',
    '',
    '## Modules',
    '',
  ]

  const moduleDescriptions: Record<string, string> = {
    vault: 'PostgreSQL ORM with Kysely — migrations, seeds, and type-safe queries.',
    gatehouse: 'Authentication — email/password, social login, magic links, OTP, 2FA, passkeys, orgs, API keys.',
    courier: 'Multi-channel communication — email, SMS, and push notifications.',
  }

  for (const [name, cfg] of Object.entries(state.modules)) {
    const desc = moduleDescriptions[name] ?? ''
    const provider = cfg?.provider ? ` (provider: \`${cfg.provider}\`)` : ''
    lines.push(`- **${name}**${provider} — ${desc}`)
  }

  lines.push(
    '',
    '## Getting started',
    '',
    '```bash',
    'pnpm dev        # Start the development server',
    'pnpm build      # Build for production',
    'pnpm test       # Run tests',
    'pnpm typecheck  # Type-check the project',
    '```',
    '',
    '## Import conventions',
    '',
    'Import Tower modules from the `towerjs` meta-package:',
    '',
    '```ts',
    "import { defineTower } from 'towerjs/blueprint'",
    "import { gatehouse } from 'towerjs/gatehouse'",
    "import { vault } from 'towerjs/vault'",
    "import { courier } from 'towerjs/courier'",
    "import { getSession, action } from 'towerjs/gatehouse/next'",
    '```',
    '',
    '## Architecture',
    '',
    '- `src/app/` — Next.js App Router pages and API routes',
    '- `src/lib/` — Shared logic, utilities, and server actions',
    '- `src/proxy.ts` — Edge middleware (runs before every request)',
    '- `tower.config.ts` — Tower module configuration',
    '',
    'Tower modules are initialized lazily on first use. There is no global setup step.',
    '',
    '## Server actions',
    '',
    'Common auth actions are available from `towerjs/gatehouse/actions`:',
    '',
    '```ts',
    "'use server'",
    '',
    'export {',
    '  signIn, signUp, signOut,',
    '  updateProfile, changePassword,',
    '  createOrganization, updateOrganization, deleteOrganization,',
    '  inviteMember, removeMember, cancelInvitation, acceptInvitation,',
    '  revokeSession, revokeOtherSessions,',
    '  verifyTwoFactor, disableTwoFactor,',
    '  assignRole, removeRole,',
    "} from 'towerjs/gatehouse/actions'",
    '```',
    '',
    'For actions with custom returns (e.g. `enableTwoFactor`, `generateBackupCodes`)',
    'or custom logic, use `action` from `towerjs/gatehouse/next`:',
    '',
    '```ts',
    "'use server'",
    '',
    "import { action } from 'towerjs/gatehouse/next'",
    "import { gatehouse } from 'towerjs/gatehouse'",
    '',
    "export const enableTwoFactor = action(async (formData: FormData) => {",
    "  return gatehouse.totp.enable(formData.get('password') as string)",
    '})',
    '```',
    '',
    '`action.form` handles FormData extraction automatically so you can destructure',
    'instead of calling `.get()`. Context and cookies are handled for you.',
    '',
    '## Formatting',
    '',
    'This project uses Prettier with plugins for import organization and Tailwind CSS class sorting.',
    '```bash',
    'pnpm format  # Format all files',
    '```',
    '',
  )

  return lines.join('\n')
}
