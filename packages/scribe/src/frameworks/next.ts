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

      await mkdir(join(projectDir, 'src', 'app', 'sign-in'), { recursive: true })
      await writeFile(join(projectDir, 'src', 'app', 'sign-in', 'page.tsx'), signInPage())
      await mkdir(join(projectDir, 'src', 'app', 'sign-up'), { recursive: true })
      await writeFile(join(projectDir, 'src', 'app', 'sign-up', 'page.tsx'), signUpPage())
      await mkdir(join(projectDir, 'src', 'app', 'dashboard'), { recursive: true })
      await writeFile(join(projectDir, 'src', 'app', 'dashboard', 'page.tsx'), dashboardPage())
    }

    if (state.modules.vault) {
      // Keep the default migration/seed folders present so `npx tower migrate` works out of the box.
      const migrationsDir = join(projectDir, 'src', 'vault', 'migrations')
      const seedsDir = join(projectDir, 'src', 'vault', 'seeds')
      await mkdir(migrationsDir, { recursive: true })
      await writeFile(join(migrationsDir, '.gitkeep'), '')
      await mkdir(seedsDir, { recursive: true })
      await writeFile(join(seedsDir, '.gitkeep'), '')
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

function moduleConfig(name: string, cfg: Record<string, unknown>, state: ProjectState): Record<string, unknown> {
  if (name === 'gatehouse') {
    const resolved: Record<string, unknown> = { ...cfg, provider: 'better-auth', appName: cfg.appName ?? 'My App' }
    // Default to link-based email verification when a courier email provider is configured.
    // Change to { method: "otp" } for code-based verification, or remove to disable.
    const courierEmail = (state.modules.courier as Record<string, unknown> | undefined)?.email
    if (courierEmail && resolved.emailVerification === undefined) {
      resolved.emailVerification = { sendOnSignUp: true }
    }
    return resolved
  }
  return cfg
}

function formatSocialConfig(social: Record<string, unknown>, indent: number): string[] {
  const providers = Object.keys(social)
  if (providers.length === 0) return [`${' '.repeat(indent)}social: {},`]
  const inner = providers
    .map((p) => {
      const key = p.toUpperCase().replace(/-/g, '_')
      const pad = ' '.repeat(indent + 2)
      return (
        `${pad}...(process.env.${key}_CLIENT_ID ` +
        `? { ${p}: { clientId: process.env.${key}_CLIENT_ID, clientSecret: process.env.${key}_CLIENT_SECRET! } } : {}),`
      )
    })
    .join('\n')
  return [`${' '.repeat(indent)}social: {`, inner, `${' '.repeat(indent)}},`]
}

/** Generates the tower.config.ts content for a new project. */
export function towerConfig(state: ProjectState): string {
  const modules = Object.entries(state.modules)
    .map(([name, cfg]) => {
      const resolved = moduleConfig(name, (cfg ?? {}) as Record<string, unknown>, state)
      const lines = Object.entries(resolved)
        .filter(([k, v]) => !CLI_ONLY_KEYS.has(k) && v !== undefined)
        .flatMap(([k, v]) =>
          k === 'social' && v && typeof v === 'object' ? formatSocialConfig(v as Record<string, unknown>, 6) : formatConfigLine(k, v, 6),
        )
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
      const social = (cfg as Record<string, unknown> | undefined)?.social as
        | Record<string, unknown>
        | undefined
      if (social && Object.keys(social).length > 0) {
        for (const provider of Object.keys(social)) {
          const key = provider.toUpperCase().replace(/-/g, '_')
          vars.push(`# ${provider} OAuth — optional, only needed if you enable social login`)
          vars.push(`${key}_CLIENT_ID=`)
          vars.push(`${key}_CLIENT_SECRET=`)
        }
      }
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

function signInPage(): string {
  return `'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signIn } from '@/lib/auth/actions'

type State = { error?: string } | { ok: true }

export default function SignInPage() {
  const [state, formAction, pending] = useActionState(signIn, undefined)

  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold">Sign in</h1>
      <form action={formAction} className="flex flex-col gap-3">
        {state && 'error' in state ? <p className="text-sm text-red-600">{state.error}</p> : null}
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-4 text-sm text-neutral-500">
        No account yet? <Link className="underline" href="/sign-up">Sign up</Link>
      </p>
    </main>
  )
}
`
}

function signUpPage(): string {
  return `'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signUp } from '@/lib/auth/actions'

type State = { error?: string } | { ok: true }

export default function SignUpPage() {
  const [state, formAction, pending] = useActionState(signUp, undefined)

  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold">Create your account</h1>
      <form action={formAction} className="flex flex-col gap-3">
        {state && 'error' in state ? <p className="text-sm text-red-600">{state.error}</p> : null}
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input name="name" type="text" required autoComplete="name" className="rounded-md border border-neutral-300 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input name="email" type="email" required autoComplete="email" className="rounded-md border border-neutral-300 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="new-password"
            className="rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      <p className="mt-4 text-sm text-neutral-500">
        Already have an account? <Link className="underline" href="/sign-in">Sign in</Link>
      </p>
    </main>
  )
}
`
}

function dashboardPage(): string {
  return `import { redirect } from 'next/navigation'
import { gatehouse } from 'towerjs/gatehouse'
import { signOut } from '@/lib/auth/actions'

export default async function DashboardPage() {
  const session = await gatehouse.getSession()
  if (!session) redirect('/sign-in')

  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-4 py-16">
      <h1 className="text-2xl font-semibold">Welcome, {session.user.name}</h1>
      <p className="mt-1 text-sm text-neutral-500">{session.user.email}</p>
      <form action={signOut} className="mt-8">
        <button type="submit" className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
          Sign out
        </button>
      </form>
    </main>
  )
}
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
    'pnpm lint       # Lint with oxlint/ESLint',
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
    'pnpm exec prettier --write .  # Format all files',
    '```',
    '',
  )

  return lines.join('\n')
}
