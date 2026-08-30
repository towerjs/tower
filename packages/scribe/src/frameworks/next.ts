import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { execa } from 'execa'

import { type PackageManager, detectPackageManager, nextAppFlag } from '../package-manager.js'
import type { ProjectState } from '../state.js'
import type { FrameworkAdapter } from './adapter.js'

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

async function runQuiet(command: string, args: string[], cwd: string): Promise<void> {
  try {
    await execa(command, args, { cwd, stdio: 'pipe' })
  } catch (error) {
    const result = error as { stdout?: string; stderr?: string }
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n')
    if (output) process.stderr.write(`${output}\n`)
    throw error
  }
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

    // Tower owns dependency installation so the entire generated dependency
    // graph is installed once, after package.json is complete.
    flags.push('--skip-install')

    await runQuiet('npx', ['create-next-app@latest', ...flags], targetDir)

    const projectDir = join(targetDir, state.projectName)

    // Newer create-next-app emits a partial pnpm-workspace.yaml that breaks
    // plain `pnpm add` in generated apps. Generated apps are not workspaces.
    await rm(join(projectDir, 'pnpm-workspace.yaml'), { force: true })
    const configFile = useTypeScript ? 'tower.config.ts' : 'tower.config.js'
    const pageFile = useTypeScript ? 'page.tsx' : 'page.jsx'

    await writeFile(join(projectDir, 'src', 'app', pageFile), homePage(state))
    await writeFile(join(projectDir, configFile), towerConfig(state))

    // create-next-app wires Geist via next/font and points Tailwind's
    // --font-sans at it. Tower scaffolds use the system sans-serif stack:
    // no font packages, no network fonts.
    await writeFile(join(projectDir, 'src', 'app', 'layout.tsx'), defaultLayout(state))
    {
      const globalsPath = join(projectDir, 'src', 'app', 'globals.css')
      let globals = ''
      try {
        globals = readFileSync(globalsPath, 'utf8')
      } catch {}
      const fontStack = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      if (!globals.includes('ui-sans-serif, system-ui')) {
        // @theme is a Tailwind at-rule; plain-CSS scaffolds override the body
        // font directly.
        globals +=
          "\n/* System font stack — replaces create-next-app's Geist wiring */\n" +
          (useTailwind
            ? `@theme inline {\n  --font-sans: ${fontStack};\n}\n`
            : `body {\n  font-family: ${fontStack};\n}\n`)
        await writeFile(globalsPath, globals)
      }
    }
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
      const actionsDir = join(projectDir, 'src', 'actions')
      await mkdir(actionsDir, { recursive: true })
      await writeFile(
        join(actionsDir, useTypeScript ? 'gatehouse.ts' : 'gatehouse.js'),
        gatehouseActions(useTypeScript)
      )
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

    // The dev script goes through Tower so apps get validation + diagnostics
    // (tower dev always serves on port 3000).
    const pkgPath = join(projectDir, 'package.json')
    const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as {
      scripts: Record<string, string>
    }
    pkg.scripts.dev = 'tower dev'
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

    const agentsPath = join(projectDir, 'AGENTS.md')
    const generated = await readFile(agentsPath, 'utf8').catch(() => '')
    const towerSection = agentsMd(state)
    await writeFile(agentsPath, generated + '\n\n' + towerSection)

    if (state.template) {
      await applyTemplate(state, projectDir, useTypeScript)
    }
    // Internal affordance: UI-preview mode is intentionally not a public
    // create-tower flag. Tooling opts in via TOWER_UI_PREVIEW=1.
    const previewUi = state.previewUi === true || process.env.TOWER_UI_PREVIEW === '1'
    if (previewUi) {
      await applyUiPreview({ ...state, previewUi: true }, projectDir, useTypeScript)
    }

    // Write the complete dependency graph first, then install once. This
    // avoids create-next-app plus multiple package-manager passes and ensures
    // devDependencies are present even when NODE_ENV=production is inherited.
    const packageSpec = (name: string) => {
      const linked = towerSpec(pm, name)
      return linked === name ? 'latest' : linked
    }
    const completePackage = JSON.parse(await readFile(pkgPath, 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    completePackage.dependencies ??= {}
    completePackage.dependencies['@towerjs/tower'] = packageSpec('@towerjs/tower')
    for (const moduleName of ['vault', 'gatehouse', 'courier']) {
      if (state.modules[moduleName]) {
        completePackage.dependencies[`@towerjs/${moduleName}`] = packageSpec(`@towerjs/${moduleName}`)
      }
    }
    completePackage.devDependencies ??= {}
    completePackage.devDependencies['@towerjs/scribe'] = packageSpec('@towerjs/scribe')
    if (isEdge) completePackage.devDependencies['@towerjs/edge'] = packageSpec('@towerjs/edge')
    const prettierDeps: string[] = ['prettier', 'prettier-plugin-organize-imports']
    if (useTailwind) {
      prettierDeps.push('prettier-plugin-tailwindcss', 'prettier-plugin-tailwindcss-canonical-classes')
    }
    for (const dependency of prettierDeps) completePackage.devDependencies[dependency] = 'latest'
    await writeFile(pkgPath, JSON.stringify(completePackage, null, 2) + '\n')

    if (process.env.TOWER_SKIP_INSTALL === '1') return

    const installArgs =
      pm === 'pnpm'
        ? ['install', '--prod=false', '--reporter=silent']
        : pm === 'npm'
          ? ['install', '--include=dev', '--silent']
          : ['install', '--silent']
    await runQuiet(pm, installArgs, projectDir)
  },
}

/**
 * Opt-in scaffold templates (`--template <name>`). Templates are opinionated
 * starting points layered on top of the bare default scaffold; the default
 * stays minimal so applications never start by deleting example code.
 */
const TEMPLATES: Record<string, (state: ProjectState, projectDir: string, useTypeScript: boolean) => Promise<void>> = {
  async auth(state: ProjectState, projectDir: string, useTypeScript: boolean) {
    if (!useTypeScript) throw new Error(`The "auth" template currently requires TypeScript.`)
    if (!state.modules.vault || !state.modules.gatehouse) {
      throw new Error(
        `The "auth" template requires the vault and gatehouse modules. ` +
          `Re-run with --modules vault,gatehouse or scaffold without a template.`
      )
    }

    const componentsDir = join(projectDir, 'src', 'components')
    await mkdir(componentsDir, { recursive: true })
    await writeFile(join(componentsDir, 'button.tsx'), buttonComponent())
    await writeFile(join(componentsDir, 'input.tsx'), inputComponent())

    const modelsDir = join(projectDir, 'src', 'models')
    await mkdir(modelsDir, { recursive: true })
    await writeFile(join(modelsDir, 'project.ts'), projectModel())
    const factoriesDir = join(projectDir, 'src', 'factories')
    await mkdir(factoriesDir, { recursive: true })
    await writeFile(join(factoriesDir, 'project.ts'), projectFactory())

    const migrationsDir = join(projectDir, 'src', 'vault', 'migrations')
    await writeFile(join(migrationsDir, '0001_projects.ts'), projectsMigration())

    const signInDir = join(projectDir, 'src', 'app', 'sign-in')
    const signUpDir = join(projectDir, 'src', 'app', 'sign-up')
    const dashDir = join(projectDir, 'src', 'app', 'dashboard')
    await mkdir(signInDir, { recursive: true })
    await mkdir(signUpDir, { recursive: true })
    await mkdir(dashDir, { recursive: true })
    await writeFile(join(signInDir, 'page.tsx'), signInPage(state))
    await writeFile(join(signUpDir, 'page.tsx'), signUpPage(state))
    await writeFile(join(dashDir, 'page.tsx'), dashboardPage(state))

    // Inter var via the rsms.me CDN: preconnect + preload + stylesheet, and a
    // font-family override so Tailwind's font-sans resolves to it.
    await writeFile(join(projectDir, 'src', 'app', 'layout.tsx'), authLayout(state))
    const globalsPath = join(projectDir, 'src', 'app', 'globals.css')
    let globals = ''
    try {
      globals = readFileSync(globalsPath, 'utf8')
    } catch {}
    if (!globals.includes("'Inter var'")) {
      globals +=
        '\n/* Auth template typography — Inter variable font (rsms.me) */\n' +
        ":root { --font-sans: 'Inter var', ui-sans-serif, system-ui, -apple-system, sans-serif; }\n" +
        'body { font-family: var(--font-sans); }\n'
      await writeFile(globalsPath, globals)
    }
  },
}

/** Root layout for the auth template: loads Inter var from rsms.me. */
function authLayout(_state: ProjectState): string {
  return `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tower",
  description: "Built with Tower",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://rsms.me/" />
        <link rel="preload" as="style" href="https://rsms.me/inter/inter.css" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
`
}

async function applyTemplate(state: ProjectState, projectDir: string, useTypeScript: boolean): Promise<void> {
  const template = TEMPLATES[state.template!]
  if (!template) {
    throw new Error(`Unknown template "${state.template}". Available templates: ${Object.keys(TEMPLATES).join(', ')}.`)
  }
  await template(state, projectDir, useTypeScript)
}

function buttonComponent(): string {
  return `import Link from 'next/link'
import { forwardRef } from 'react'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: string
  pending?: boolean
}

// Single primitive for every call-to-action — <Button> renders a button,
// <Button href="/path"> renders a styled link. All visual styling lives
// here; call sites use <Button> or <Button href="..."> with no classes.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { href, className = '', pending, disabled, children, ...props },
  ref
) {
  const classes = \`inline-flex items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 \${className}\`
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    )
  }
  return (
    <button ref={ref} disabled={disabled || pending} className={classes} {...props}>
      {children}
    </button>
  )
})
`
}

function inputComponent(): string {
  return `import { forwardRef } from 'react'

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label?: string }

// Minimal labeled input — restyle or replace freely.
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', label, id, ...props },
  ref
) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={\`w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 \${className}\`}
        {...props}
      />
    </div>
  )
})
`
}

/**
 * Visual-development mode (`tower create --preview-ui`).
 *
 * Strips every auth gate — the proxy (both redirect directions included) is
 * removed outright — and rewrites config to courier-console only so pages
 * render with no database. Dashboard data becomes static samples. This mode
 * exists purely to design UI; never ship it.
 */
async function applyUiPreview(state: ProjectState, projectDir: string, useTypeScript: boolean): Promise<void> {
  await rm(join(projectDir, useTypeScript ? 'src/proxy.ts' : 'src/proxy.js'), { force: true })

  const configFile = join(projectDir, useTypeScript ? 'tower.config.ts' : 'tower.config.js')
  await writeFile(
    configFile,
    `import { courier } from "@towerjs/courier";\nimport { defineTower } from "@towerjs/tower";\n\n// UI preview mode: no auth, no database. Never ship this config.\nexport default defineTower({\n  modules: [\n    courier({ email: { provider: "console", from: "Preview <preview@example.com>" } }),\n  ],\n});\n`
  )

  // Env contract shrinks to nothing meaningful in preview mode.
  await writeFile(join(projectDir, '.env.example'), '# UI preview mode — no environment variables required.\n')
  await rm(join(projectDir, '.env'), { force: true })

  if (useTypeScript && state.modules.vault && existsSync(join(projectDir, 'src', 'app', 'dashboard'))) {
    await writeFile(
      join(projectDir, 'src', 'app', 'dashboard', 'page.tsx'),
      dashboardPage({ ...state, previewUi: true })
    )
  }
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
            ? formatSocialConfig(v as Record<string, unknown>, 4)
            : formatConfigLine(k, v, 4)
        )
      if (lines.length === 0) return `  ${name}({}),`
      return `  ${name}({\n${lines.join('\n')}\n  }),`
    })
    .join('\n')

  // Only selected modules are installed, so only they may be imported.
  const imports = ['import { defineTower } from "@towerjs/tower"']
  for (const name of ['vault', 'gatehouse', 'courier']) {
    if (state.modules[name]) imports.push(`import { ${name} } from "@towerjs/${name}"`)
  }

  return `${imports.join('\n')}

export default defineTower({
  modules: [
${modules}
  ],
})
`
}

/**
 * Default root layout — no next/font, no Geist. Tailwind's default
 * font-sans (system UI stack) applies to everything.
 */
function defaultLayout(state: ProjectState): string {
  return `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "${state.projectName}",
  description: "Built with Tower",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
`
}

function homePage(state: ProjectState): string {
  const moduleNames = Object.keys(state.modules)
  const moduleDescriptions: Record<string, string> = {
    vault: 'PostgreSQL + Kysely',
    gatehouse: 'Better Auth',
    courier: 'Email / SMS / Push',
  }
  const isAuth = state.template === 'auth'

  return `${isAuth ? `import { Button } from '@/components/button'\n\n` : ''}export default function Home() {
  const modules = [
    ${moduleNames.map((n) => `{ name: '${n}', description: '${moduleDescriptions[n]}' }`).join(',\n    ')}
  ]

  return (
    <main className="min-h-screen bg-white dark:bg-neutral-950 flex flex-col items-center justify-center px-4 py-20">
      <div className="max-w-2xl w-full space-y-10 text-center">
        <div className="flex items-center justify-center gap-3">
          <svg className="w-10 h-10 text-neutral-900 dark:text-neutral-100" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="currentColor"/>
            <path d="M8 16L14 22L24 10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-neutral-300 dark:text-neutral-700 text-2xl font-light">+</span>
          <svg className="w-9 h-9" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Next.js">
            <circle cx="90" cy="90" r="90" className="fill-neutral-900 dark:fill-neutral-100" />
            <path
              d="M149.508 157.52L69.142 54H54v71.97h12.114V69.384l84.535 106.695a90.304 90.304 0 0 0-1.141-18.559z"
              className="fill-white dark:fill-neutral-950"
            />
            <path d="M115 54h12v72h-12z" className="fill-white dark:fill-neutral-950" />
          </svg>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Your Tower application is ready
        </h1>
        <p className="text-lg text-neutral-500 dark:text-neutral-400">
          Tower scaffolded your infrastructure. The application is yours to build.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 text-left">
          {modules.map((mod) => (
            <div key={mod.name} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <span className="font-medium capitalize text-neutral-900 dark:text-neutral-100">{mod.name}</span>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{mod.description}</p>
            </div>
          ))}
        </div>
        <div className="pt-2 flex items-center justify-center gap-3">
          ${
            state.template === 'auth' && state.modules.gatehouse
              ? `<Button href="/sign-in">Sign in</Button>
          <Button href="/dashboard">Open dashboard</Button>`
              : `<a href="https://towerjs.dev" className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200">Read the docs</a>`
          }
        </div>
      </div>
    </main>
  )
}
`
}

function authRoute(): string {
  return `import { createGatehouseHandlers } from "@towerjs/gatehouse/next";

import tower from "../../../../../tower.config";

export const { GET, POST } = createGatehouseHandlers(tower);
`
}

/** Sample model for the generated app's golden path (#97). */
function projectModel(): string {
  return `import { Model } from '@towerjs/vault/model'

export type ProjectRow = {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export class Project extends Model<ProjectRow> {
  static table = 'projects'

  static scopes = {
    recent: (q: any) => q.orderBy('created_at', 'desc').limit(20),
  } as const
}
`
}

function projectFactory(): string {
  return `import { defineFactory } from '@towerjs/vault/factory'
import { Project } from '../models/project.js'

// Factories build valid rows through Project.create(), honoring casts and
// the provider boundary. Use them in seeds, tests, and e2e:
//   await ProjectFactory.create({ name: 'Override' })
export const ProjectFactory = defineFactory(Project, ({ seq }) => ({
  name: \`Project \${seq}\`,
  description: null,
}))
`
}

function projectsMigration(): string {
  return `import type { Vault } from '@towerjs/vault'

export async function up(db: Vault) {
  await db.schema
    .createTable('projects')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(db.fn('gen_random_uuid')))
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(db.fn('now')))
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(db.fn('now')))
    .execute()
}

export async function down(db: Vault) {
  await db.schema.dropTable('projects').execute()
}
`
}

/** Server-rendered dashboard reading through the model API. In UI-preview mode it renders static samples with no imports at all. */
function dashboardPage(state: ProjectState): string {
  const header = state.modules.gatehouse
    ? `        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Dashboard</h1>
          <form action={signOut}>
            <button type="submit" className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
              Sign out
            </button>
          </form>
        </div>`
    : `        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Dashboard</h1>`

  if (state.previewUi) {
    return `'use client'

const sampleProjects = [
  { id: '1', name: 'Design System', description: 'Landing page polish' },
  { id: '2', name: 'Auth flows', description: 'Sign-in / sign-up' },
  { id: '3', name: 'Dashboard', description: 'Model API list' },
]

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-neutral-950 px-6 py-16">
      <div className="mx-auto max-w-3xl space-y-8">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Dashboard</h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          Reading from your Vault database through the Tower model API.
        </p>

        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {sampleProjects.map((project) => (
            <li key={project.id} className="flex items-center justify-between px-4 py-3">
              <span className="font-medium text-neutral-900 dark:text-neutral-100">{project.name}</span>
              <span className="text-sm text-neutral-500 dark:text-neutral-400">{project.description}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
`
  }
  const imports = state.modules.gatehouse ? `import { signOut } from '@/actions/gatehouse'\n` : ''
  return `import { Project } from '@/models/project'
${imports}
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  // Reads go through the Tower model API. Drop to vault.selectFrom(...) or
  // Kysely's sql tag when you need more control.
  let projects: Awaited<ReturnType<typeof Project.all>> = []
  let error: string | null = null
  try {
    projects = await Project.scope('recent').get()
  } catch {
    error = 'Database not reachable yet — run migrations first.'
  }

  return (
    <main className="min-h-screen bg-white dark:bg-neutral-950 px-6 py-16">
      <div className="mx-auto max-w-3xl space-y-8">
${header}
        <p className="text-neutral-500 dark:text-neutral-400">
          Reading from your Vault database through the Tower model API.
        </p>

        {error && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {error}
          </p>
        )}
        {projects.length > 0 ? (
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {projects.map((project) => (
              <li key={project.get('id')} className="flex items-center justify-between px-4 py-3">
                <span className="font-medium text-neutral-900 dark:text-neutral-100">{project.get('name')}</span>
                <span className="text-sm text-neutral-500 dark:text-neutral-400">{project.get('description')}</span>
              </li>
            ))}
          </ul>
        ) : (
          !error && (
            <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
              No projects yet.
            </p>
          )
        )}
      </div>
    </main>
  )
}
`
}

const AUTH_FORM_CLASSES = {
  input:
    'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100',
  label: 'mb-1.5 block text-sm font-medium text-neutral-900 dark:text-neutral-100',
} as const

function formStyles(): string {
  return `const styles = {
  input: '${AUTH_FORM_CLASSES.input}',
  label: '${AUTH_FORM_CLASSES.label}',
}
`
}

function signInPage(state: ProjectState): string {
  const magic = state.frameworkAnswers.magicLinks === true
  return `'use client'

import { requestMagicLink, signIn } from '@/actions/gatehouse'
import type { ActionResult } from '@towerjs/gatehouse/next'

import { Button } from '@/components/button'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect } from 'react'

const inputClass =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100'
const labelClass = 'mb-1.5 block text-sm font-medium text-neutral-900 dark:text-neutral-100'

export default function SignInPage() {
  const router = useRouter()
  const [pw, pwAction, pwPending] = useActionState<ActionResult | undefined, FormData>(signIn, undefined)
  ${
    magic
      ? `const [magic, magicAction, magicPending] = useActionState<ActionResult | undefined, FormData>(
    requestMagicLink,
    undefined
  )`
      : ''
  }
${''}
  useEffect(() => {
    if (pw?.ok) router.push('/dashboard')
  }, [pw, router])

  return (
    <main className="min-h-screen bg-white dark:bg-neutral-950 flex flex-col items-center justify-center px-4 py-20">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-center text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Sign in
        </h1>

        <form action={pwAction} className="space-y-4">
          {pw?.error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {pw.error}
            </div>
          )}
          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input id="email" name="email" type="email" required placeholder="you@example.com" className={inputClass} />
          </div>
          <div>
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <input id="password" name="password" type="password" required className={inputClass} />
          </div>
          <Button type="submit" pending={pwPending}>
            Sign in
          </Button>
        </form>
${''}
${
  magic
    ? `        <form action={magicAction} className="space-y-3 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          {magic?.ok && (
            <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              If an account exists for that email, we&apos;ve sent you a magic link.
            </div>
          )}
          <input type="hidden" name="type" value="sign-in" />
          <input id="magic-email" name="email" type="email" required placeholder="Email me a magic link" className={inputClass} />
          <Button type="submit" pending={magicPending}>
            Send magic link
          </Button>
        </form>`
    : ''
}
${''}
        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
          No account?{' '}
          <Link href="/sign-up" className="font-medium text-neutral-900 underline underline-offset-2 dark:text-neutral-100">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  )
}
`
}

function signUpPage(_state: ProjectState): string {
  return `'use client'

import { signUp } from '@/actions/gatehouse'
import type { ActionResult } from '@towerjs/gatehouse/next'

import { Button } from '@/components/button'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect } from 'react'

${formStyles()}

export default function SignUpPage() {
  const router = useRouter()
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(signUp, undefined)

  useEffect(() => {
    if (state?.ok) router.push('/dashboard')
  }, [state, router])

  return (
    <main className="min-h-screen bg-white dark:bg-neutral-950 flex flex-col items-center justify-center px-4 py-20">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-center text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Create your account
        </h1>

        <form action={action} className="space-y-4">
          {state?.error && !state.ok && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {state.error}
            </div>
          )}
          <div>
            <label htmlFor="name" className={styles.label}>
              Name
            </label>
            <input id="name" name="name" type="text" required className={styles.input} />
          </div>
          <div>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <input id="email" name="email" type="email" required placeholder="you@example.com" className={styles.input} />
          </div>
          <div>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <input id="password" name="password" type="password" required minLength={8} className={styles.input} />
          </div>
          <Button type="submit" pending={pending}>
            Create account
          </Button>
        </form>

        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
          Already have an account?{' '}
          <Link href="/sign-in" className="font-medium text-neutral-900 underline underline-offset-2 dark:text-neutral-100">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
`
}

function nextConfig(): string {
  return `import { withTowerEdge } from "@towerjs/edge";

export default withTowerEdge({});
`
}

function proxyFile(): string {
  return `import { createGatehouseProxy } from "@towerjs/gatehouse/next";

import tower from "../tower.config";

const { handler } = createGatehouseProxy(tower, {
  public: ["/", "/sign-in", "/sign-up"],
});

export const proxy = handler;

export const config = {
  matcher: ["/((?!_next/static|favicon.ico|api/auth).*)"],
};
`
}

function gatehouseActions(useTypeScript: boolean): string {
  return `'use server'

import * as gatehouseActions from '@towerjs/gatehouse/actions'
import { initTower } from '@towerjs/tower/runtime'

import tower from '../../tower.config'

function configured${useTypeScript ? '<T extends (...args: any[]) => Promise<any>>(action: T): T' : '(action)'} {
  return (async (...args${useTypeScript ? ': Parameters<T>' : ''}) => {
    await initTower(tower.modules, tower)
    return action(...args)
  })${useTypeScript ? ' as T' : ''}
}

export const banUser = configured(gatehouseActions.banUser)
export const cancelInvitation = configured(gatehouseActions.cancelInvitation)
export const changePassword = configured(gatehouseActions.changePassword)
export const createOrganization = configured(gatehouseActions.createOrganization)
export const deleteOrganization = configured(gatehouseActions.deleteOrganization)
export const disableTwoFactor = configured(gatehouseActions.disableTwoFactor)
export const enableTwoFactor = configured(gatehouseActions.enableTwoFactor)
export const generateBackupCodes = configured(gatehouseActions.generateBackupCodes)
export const inviteMember = configured(gatehouseActions.inviteMember)
export const rejectInvitation = configured(gatehouseActions.rejectInvitation)
export const removeMember = configured(gatehouseActions.removeMember)
export const requestMagicLink = configured(gatehouseActions.requestMagicLink)
export const revokeOtherSessions = configured(gatehouseActions.revokeOtherSessions)
export const revokeSession = configured(gatehouseActions.revokeSession)
export const sendVerificationOTP = configured(gatehouseActions.sendVerificationOTP)
export const setActiveOrganization = configured(gatehouseActions.setActiveOrganization)
export const signIn = configured(gatehouseActions.signIn)
export const signInWithOTP = configured(gatehouseActions.signInWithOTP)
export const signOut = configured(gatehouseActions.signOut)
export const signUp = configured(gatehouseActions.signUp)
export const updateMemberRole = configured(gatehouseActions.updateMemberRole)
export const updateOrganization = configured(gatehouseActions.updateOrganization)
export const updateProfile = configured(gatehouseActions.updateProfile)
export const verifyTwoFactor = configured(gatehouseActions.verifyTwoFactor)
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
    'Import Tower core from `@towerjs/tower` and modules from their respective packages:',
    '',
    '```' + fence + ' ',
    "import { defineTower } from '@towerjs/tower'",
    "import { vault } from '@towerjs/vault'",
    "import { gatehouse } from '@towerjs/gatehouse'",
    "import { courier } from '@towerjs/courier'",
    "import { getSession, action } from '@towerjs/gatehouse/next'",
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
    'Import tower-supplied actions directly from `@towerjs/gatehouse/actions`:',
    '',
    '```' + fence + ' ',
    "import { signIn, signUp, signOut } from '@towerjs/gatehouse/actions'",
    '```',
    '',
    'For actions with custom returns (e.g. `enableTwoFactor`, `generateBackupCodes`)',
    'or custom logic, use `action` from `@towerjs/gatehouse/next`:',
    '',
    '```' + fence + ' ',
    "'use server'",
    '',
    "import { action } from '@towerjs/gatehouse/next'",
    "import { gatehouse } from '@towerjs/gatehouse'",
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

/**
 * Resolves a tower package name to an install spec. When TOWER_PACK_DIR is
 * set it points at the monorepo's packages/ directory: packages are linked
 * in place (no copies, no packing), so generated apps always run current
 * code. npm has no `link:` protocol; its `file:` installs directory deps as
 * symlinks, which is the same thing.
 */
function towerSpec(pm: PackageManager, name: string): string {
  const packDir = process.env.TOWER_PACK_DIR
  if (!packDir) return name
  const dir = name.startsWith('@') ? name.replace('@towerjs/', '') : name
  return (pm === 'npm' ? 'file:' : 'link:') + join(packDir, dir)
}
