import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'

import { execa } from 'execa'

import { type PackageManager, addCommand, detectPackageManager, nextAppFlag } from '../package-manager.js'
import type { ProjectState } from '../state.js'
import type { FrameworkAdapter } from './adapter.js'

const { version } = createRequire(import.meta.url)('../../package.json')

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const nextAdapter: FrameworkAdapter = {
  name: 'next',

  async generate(state: ProjectState, targetDir: string) {
    const answers = state.frameworkAnswers as { tailwind?: boolean; typescript?: boolean }
    const useTailwind = answers.tailwind === true
    const useTypeScript = answers.typescript !== false
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
      useTypeScript ? '--ts' : '--js',
    ]

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
    const configFile = useTypeScript ? 'tower.config.ts' : 'tower.config.js'
    const pageFile = useTypeScript ? 'page.tsx' : 'page.jsx'

    await writeFile(join(projectDir, 'src', 'app', pageFile), homePage())
    await writeFile(join(projectDir, configFile), towerConfig(state))
    if (isEdge) {
      await writeFile(join(projectDir, useTypeScript ? 'next.config.ts' : 'next.config.mjs'), nextConfig())
    }
    const environmentContract = envExample(state)
    await writeFile(join(projectDir, '.env.example'), environmentContract)
    if (Object.keys(state.modules).length > 0) {
      const localEnv = environmentContract.replace(
        /^GATEHOUSE_SECRET=$/m,
        `GATEHOUSE_SECRET="${randomBytes(32).toString('base64')}"`
      )
      await writeFile(join(projectDir, '.env'), localEnv)
    }

    if (state.modules.gatehouse) {
      const authDir = join(projectDir, 'src', 'app', 'api', 'auth', '[...all]')
      await mkdir(authDir, { recursive: true })
      await writeFile(join(authDir, useTypeScript ? 'route.ts' : 'route.js'), authRoute())

      await writeFile(join(projectDir, useTypeScript ? 'src/proxy.ts' : 'src/proxy.js'), proxyFile())
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
    // Generated code and Tower's lazy module loader are evaluated by the
    // consumer's package manager, so every selected module must be a direct
    // dependency. This is important for pnpm's strict dependency isolation.
    for (const moduleName of ['vault', 'gatehouse', 'courier']) {
      if (state.modules[moduleName]) towerDeps.push(`@towerjs/${moduleName}`)
    }
    await execa(pm, [...addCommand(pm).slice(1), ...towerInstallArgs(pm, towerDeps)], {
      cwd: projectDir,
      stdio: 'inherit',
    })

    const cliDevDeps: string[] = ['@towerjs/scribe']
    await execa(pm, [...addCommand(pm, true).slice(1), ...towerInstallArgs(pm, cliDevDeps)], {
      cwd: projectDir,
      stdio: 'inherit',
    })

    if (isEdge) {
      await execa(pm, [...addCommand(pm, true).slice(1), ...towerInstallArgs(pm, ['@towerjs/edge'])], {
        cwd: projectDir,
        stdio: 'inherit',
      })
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
  if (
    v !== null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    Object.keys(v as Record<string, unknown>).length > 0
  ) {
    return [
      `${' '.repeat(indent)}${k}: {`,
      ...renderObject(v as Record<string, unknown>, indent + 2),
      `${' '.repeat(indent)}},`,
    ]
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
        `${pad}...(env.optional('${key}_CLIENT_ID') ` +
        `? { ${p}: { clientId: env.string('${key}_CLIENT_ID'), clientSecret: env.string('${key}_CLIENT_SECRET') } } : {}),`
      )
    })
    .join('\n')
  return [`${' '.repeat(indent)}social: {`, inner, `${' '.repeat(indent)}},`]
}

/** Generates the tower.config content for a new project. */
export function towerConfig(state: ProjectState): string {
  const modules = Object.entries(state.modules)
    .map(([name, cfg]) => {
      const resolved = moduleConfig(name, (cfg ?? {}) as Record<string, unknown>, state)
      const lines = Object.entries(resolved)
        .filter(([k, v]) => !CLI_ONLY_KEYS.has(k) && v !== undefined)
        .flatMap(([k, v]) =>
          k === 'social' && v && typeof v === 'object'
            ? formatSocialConfig(v as Record<string, unknown>, 6)
            : formatConfigLine(k, v, 6)
        )
      if (lines.length === 0) return `    ${name}: {},`
      return `    ${name}: {\n${lines.join('\n')}\n    },`
    })
    .join('\n')

  return `import { defineTower, env } from "towerjs/blueprint";

export default defineTower({
  modules: {
${modules}
  },
});
`
}

function homePage(): string {
  return `export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '40rem', margin: '0 auto', padding: '4rem 1.5rem' }}>
      <h1>Your Tower application is ready.</h1>
      <p>
        Tower scaffolds the infrastructure — configuration, database, and auth wiring. The pages
        and UI are yours to build.
      </p>
    </main>
  )
}
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
  public: ["/"],
});

export const proxy = handler;

export const config = {
  matcher: ["/((?!_next/static|favicon.ico|api/auth).*)"],
};
`
}

function courierEnvHints(cfg: Record<string, unknown>, configFile: string): string[] {
  const email = cfg.email as Record<string, unknown> | undefined
  if (!email?.provider) return ['# Email — Courier', `# Add a provider in ${configFile} to get started`]
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
  const configFile = state.frameworkAnswers.typescript === false ? 'tower.config.js' : 'tower.config.ts'
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
      const social = (cfg as Record<string, unknown> | undefined)?.social as Record<string, unknown> | undefined
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
      vars.push(...courierEnvHints(cfg ?? {}, configFile))
    }
  }

  return vars.join('\n') + '\n'
}

function prettierConfig(tailwind: boolean): string {
  const plugins = ['prettier-plugin-organize-imports']
  if (tailwind) {
    plugins.push('prettier-plugin-tailwindcss', 'prettier-plugin-tailwindcss-canonical-classes')
  }
  return (
    JSON.stringify(
      {
        semi: false,
        singleQuote: true,
        trailingComma: 'all',
        printWidth: 120,
        tabWidth: 2,
        plugins,
      },
      null,
      2
    ) + '\n'
  )
}

function agentsMd(state: ProjectState): string {
  const useTypeScript = state.frameworkAnswers.typescript !== false
  const configFile = useTypeScript ? 'tower.config.ts' : 'tower.config.js'
  const proxyFile = useTypeScript ? 'src/proxy.ts' : 'src/proxy.js'
  const fence = useTypeScript ? 'ts' : 'js'
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
    '```' + fence + ' ',
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
    '- `src/lib/` — Shared logic and utilities',
    `- \`${proxyFile}\` — Edge middleware (runs before every request)`,
    `- \`${configFile}\` — Tower module configuration`,
    '',
    'Tower modules are initialized lazily on first use. There is no global setup step.',
    '',
    '## Server actions',
    '',
    'Import tower-supplied actions directly from `towerjs/gatehouse/actions`:',
    '',
    '```' + fence + ' ',
    "import { signIn, signUp, signOut } from 'towerjs/gatehouse/actions'",
    '```',
    '',
    'For actions with custom returns (e.g. `enableTwoFactor`, `generateBackupCodes`)',
    'or custom logic, use `action` from `towerjs/gatehouse/next`:',
    '',
    '```' + fence + ' ',
    "'use server'",
    '',
    "import { action } from 'towerjs/gatehouse/next'",
    "import { gatehouse } from 'towerjs/gatehouse'",
    '',
    ...(useTypeScript
      ? [
          'export const enableTwoFactor = action(async (formData: FormData) => {',
          "  return gatehouse.totp.enable(formData.get('password') as string)",
          '})',
        ]
      : [
          'export const enableTwoFactor = action(async (formData) => {',
          "  return gatehouse.totp.enable(formData.get('password'))",
          '})',
        ]),
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
    ''
  )

  return lines.join('\n')
}

const ALL_TOWER_PACKAGES = [
  'towerjs',
  '@towerjs/foundation',
  '@towerjs/blueprint',
  '@towerjs/vault',
  '@towerjs/gatehouse',
  '@towerjs/courier',
  '@towerjs/edge',
  '@towerjs/scribe',
]

function towerTarball(packDir: string, name: string): string {
  const suffix = name === 'towerjs' ? '' : name.replace('@towerjs/', '-')
  return join(packDir, `towerjs${suffix}-${version}.tgz`)
}

/**
 * Resolves tower package names to install args. When TOWER_PACK_DIR is set,
 * installs from locally-packed tarballs instead of the npm registry. Every
 * @towerjs/* package is installed explicitly because towerjs depends on all of
 * them and npm would otherwise try to fetch the unpublished versions.
 */
function towerInstallArgs(pm: PackageManager, names: string[]): string[] {
  const packDir = process.env.TOWER_PACK_DIR
  if (!packDir) return names

  if (pm === 'npm') {
    const tarballs = new Set(names.map((n) => towerTarball(packDir, n)))
    for (const name of ALL_TOWER_PACKAGES) tarballs.add(towerTarball(packDir, name))
    return [...tarballs]
  }
  // pnpm/yarn/bun resolve `@towerjs/*` to the workspace registry in a monorepo;
  // prefer the packed tarballs directly so the generated app is self-contained.
  return [...new Set(ALL_TOWER_PACKAGES.map((n) => towerTarball(packDir, n)))]
}
