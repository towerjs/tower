import { createJiti } from 'jiti'
import { createTowerApp } from '@towerjs/foundation'
import type { TowerApp } from '@towerjs/foundation'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const { version: towerjsVersion } = createRequire(import.meta.url)('../package.json')

export interface CliResult {
  stdout: string[]
  stderr: string[]
  exitCode: number
}

interface CliModule {
  migrate?(): Promise<void>
  seed?(): Promise<void>
  close?(): Promise<void>
}

function ok(lines: string[]): CliResult {
  return { stdout: lines, stderr: [], exitCode: 0 }
}

function fail(msg: string): CliResult {
  return { stdout: [], stderr: [msg], exitCode: 1 }
}

/** Runs a CLI command (migrate, seed, help, or version). */
export async function run(command: string | undefined, flags: string[], configPath?: string): Promise<CliResult> {
  if (command === '--version' || command === '-v') {
    return ok([versionText()])
  }

  const runSeed = flags.includes('--seed') || flags.includes('-s')
  const skipMigrate = flags.includes('--skip-migrate')

  switch (command) {
    case 'migrate':
      return runMigrate(runSeed, configPath)
    case 'seed':
      return runSeedCmd(skipMigrate, configPath)
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      return ok(helpText())
    default:
      return fail(`Unknown command: ${command}`)
  }
}

async function runMigrate(runSeed: boolean, configPath?: string): Promise<CliResult> {
  const lines: string[] = []
  const app = await loadApp(configPath)

  const vault = getModule(app, 'vault')
  if (vault?.migrate) {
    lines.push('Running vault migrations...')
    await vault.migrate()
  }

  const gatehouse = getModule(app, 'gatehouse')
  if (gatehouse?.migrate) {
    lines.push('Running auth migrations...')
    await gatehouse.migrate()
  }

  if (runSeed && vault?.seed) {
    lines.push('Running seeds...')
    await vault.seed()
  }

  await closeModules(app)
  lines.push('Done.')
  return ok(lines)
}

async function runSeedCmd(skipMigrate: boolean, configPath?: string): Promise<CliResult> {
  const lines: string[] = []
  const app = await loadApp(configPath)

  const vault = getModule(app, 'vault')
  if (!vault?.seed) {
    return fail('Vault not configured or seeds not available.')
  }

  if (!skipMigrate && vault.migrate) {
    lines.push('Running vault migrations...')
    await vault.migrate()
  }

  lines.push('Running seeds...')
  await vault.seed()

  await closeModules(app)
  lines.push('Done.')
  return ok(lines)
}

export function getModule(app: TowerApp, name: string): CliModule | undefined {
  if (app.container.has(name)) return app.container.get<CliModule>(name)
  const prefixed = `module.${name}`
  if (app.container.has(prefixed)) return app.container.get<CliModule>(prefixed)
  return undefined
}

export async function loadApp(configPath?: string): Promise<TowerApp> {
  if (!configPath) configPath = findConfig()
  const jiti = createJiti(import.meta.url, { interopDefault: true })
  const config = await jiti.import(configPath)
  return createTowerApp(config as any)
}

export async function closeModules(app: TowerApp) {
  for (const [name] of Object.entries(app.config.modules)) {
    const mod = getModule(app, name)
    if (mod?.close) {
      await mod.close()
    }
  }
}

/** Searches up from cwd to find tower.config.ts. */
export function findConfig(cwd?: string): string {
  let dir = cwd ?? process.cwd()
  for (let i = 0; i < 20; i++) {
    for (const name of ['tower.config.ts', 'tower.config.mjs', 'tower.config.js']) {
      const fullPath = path.join(dir, name)
      if (fs.existsSync(fullPath)) return fullPath
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('Could not find tower.config.ts in this or any parent directory.')
}

export function versionText(): string {
  return `towerjs v${towerjsVersion}`
}

export function helpText(): string[] {
  return [
    '',
    'Usage: tower <command>',
    '',
    'Commands:',
    '  migrate          Run database and auth migrations',
    '  migrate --seed   Run migrations, then seeds',
    '  seed             Run seeds (runs migrations first unless --skip-migrate)',
    '  seed --skip-migrate  Run seeds without running migrations first',
    '  help             Show this message',
    '  --version, -v    Show version',
    '',
  ]
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const [command, ...flags] = process.argv.slice(2)
  const result = await run(command, flags)
  for (const line of result.stdout) process.stdout.write(line + '\n')
  for (const line of result.stderr) process.stderr.write(line + '\n')
  process.exit(result.exitCode)
}
