import { randomBytes } from 'node:crypto'
import { select } from '@inquirer/prompts'
import { execa } from 'execa'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { FrameworkAdapter } from './adapter.js'
import type { ProjectState } from '../state.js'

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const nextAdapter: FrameworkAdapter = {
  name: 'next',

  async prompt() {
    const typescript = await select<boolean>({
      message: 'TypeScript?',
      choices: [
        { name: 'Yes', value: true },
        { name: 'No', value: false },
      ],
    })

    const tailwind = await select<boolean>({
      message: 'Tailwind CSS?',
      choices: [
        { name: 'Yes', value: true },
        { name: 'No', value: false },
      ],
    })

    return { typescript, tailwind }
  },

  async generate(state: ProjectState, targetDir: string) {
    const answers = state.frameworkAnswers as { typescript?: boolean; tailwind?: boolean }
    const useTs = answers.typescript !== false
    const useTailwind = answers.tailwind === true

    const flags: string[] = [
      state.projectName,
      '--eslint',
      '--app',
      '--src-dir',
      '--import-alias',
      '@/*',
      '--use-pnpm',
      '--no-turbopack',
    ]

    if (useTs) {
      flags.push('--typescript')
    } else {
      flags.push('--javascript')
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
    await writeFile(join(projectDir, '.env.example'), envExample(state))
    if (state.modules.gatehouse || state.modules.vault) {
      const envLines: string[] = []
      if (state.modules.gatehouse) {
        envLines.push(
          `# Authentication — auto-generated during setup`,
          `BETTER_AUTH_SECRET="${randomBytes(32).toString('base64')}"`,
          `BETTER_AUTH_URL="http://localhost:3000"`
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
      await writeFile(join(projectDir, 'src', 'proxy.ts'), proxyFile())
    }

    const towerDeps: string[] = ['towerjs']
    await execa('pnpm', ['add', ...towerDeps], { cwd: projectDir, stdio: 'inherit' })
  },
}

const CLI_ONLY_KEYS = new Set(['brand'])

/** Generates the tower.config.ts content for a new project. */
export function towerConfig(state: ProjectState): string {
  const modules = Object.entries(state.modules)
    .map(([name, cfg]) => {
      const entries = Object.entries(cfg ?? {})
        .filter(([k, v]) => !CLI_ONLY_KEYS.has(k) && v !== undefined)
        .map(([k, v]) => `    ${k}: ${JSON.stringify(v)},`)
      if (entries.length === 0) return `    ${name}: {},`
      return `    ${name}: {\n${entries.join('\n')}\n  },`
    })
    .join('\n')

  return `import { defineTower } from "@towerjs/blueprint";

export default defineTower({
  modules: {
${modules}
  },
});
`
}

function authRoute(): string {
  return `export { GET, POST } from "@towerjs/gatehouse/next-js";
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

export function proxy(request: Request) {
  return handler(request);
}

export const config = {
  matcher: ["/((?!_next/static|favicon.ico|api/auth).*)"],
};
`
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
      vars.push('BETTER_AUTH_SECRET=')
      vars.push('BETTER_AUTH_URL="http://localhost:3000"')
    }
  }

  return vars.join('\n') + '\n'
}
