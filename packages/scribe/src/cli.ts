#!/usr/bin/env node
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { detectRuntime } from '@towerjs/tower/foundation'
import type { TowerApp, TowerConfig, TowerModule } from '@towerjs/tower/foundation'

import { createJiti } from 'jiti'

import { createCommand } from './commands/create.js'
import { dbCommand } from './commands/db.js'
import { makeCommand, makeHelp } from './generators/make.js'
import { helpText } from './help.js'
import { createModuleDefinitions } from './runtime.js'

export { helpText }

const { version } = createRequire(import.meta.url)('../package.json')

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

export function ok(lines: string[]): CliResult {
  return { stdout: lines, stderr: [], exitCode: 0 }
}

export function fail(msg: string): CliResult {
  return { stdout: [], stderr: [msg], exitCode: 1 }
}

/** Runs a CLI command (create, about, migrate, seed, help, or version). */
export async function run(command: string | undefined, flags: string[], configPath?: string): Promise<CliResult> {
  if (command === '--version' || command === '-v') {
    return ok([versionText()])
  }
  if (command === 'db') return await dbCommand(flags, configPath)

  const runSeed = flags.includes('--seed') || flags.includes('-s')
  const skipMigrate = flags.includes('--skip-migrate')

  try {
    switch (command) {
      case 'create':
        if (flags.includes('--help') || flags.includes('-h')) return ok(helpText())
        await createCommand(flags)
        return ok([])
      case 'about':
        return runAbout(configPath)
      case 'migrate':
        return await runMigrate(runSeed, configPath)
      case 'seed':
        return await runSeedCmd(skipMigrate, configPath)
      case 'make':
        if (flags.includes('--help') || flags.includes('-h') || flags.length === 0) return ok(makeHelp())
        return ok(makeCommand(flags))
      case undefined:
      case 'help':
      case '--help':
      case '-h':
        return ok(helpText())
      default:
        return fail(`Unknown command: ${command}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`${message}\n`)
    return fail(message)
  }
}

function envStatus(name: string): string {
  return typeof process !== 'undefined' && process.env[name] ? '✓' : '—'
}

function moduleProvider(config: Record<string, unknown>): string {
  // Don't trigger TowerModule getters (courier.email etc) which throw when not initialized
  if (typeof (config as any).name === 'string' && typeof (config as any).initialize === 'function') {
    return 'configured'
  }
  if (Object.prototype.hasOwnProperty.call(config, 'provider') && typeof config.provider === 'string')
    return String(config.provider)
  if (Object.prototype.hasOwnProperty.call(config, 'email')) {
    const email = (config as Record<string, unknown>).email
    if (email && typeof email === 'object' && typeof (email as Record<string, unknown>).provider === 'string') {
      return String((email as Record<string, unknown>).provider)
    }
  }
  return 'configured'
}

async function runAbout(configPath?: string): Promise<CliResult> {
  const resolvedPath = configPath ?? findConfig()
  const config = await loadConfig(resolvedPath)
  const runtime = detectRuntime()
  const rawModules = (config as any).modules as unknown
  const modulesObj: Record<string, unknown> = Array.isArray(rawModules)
    ? Object.fromEntries((rawModules as any[]).map((m: any) => [m.name ?? m, m]))
    : ((rawModules as Record<string, unknown>) ?? {})
  const lines = [
    versionText(),
    '',
    'Application',
    `  Config     ${resolvedPath}`,
    `  Environment ${process.env.NODE_ENV ?? 'development'}`,
    `  Runtime    ${runtime.name}${runtime.isServerless ? ' (serverless)' : ''}`,
    '',
    'Modules',
  ]

  for (const [name, moduleConfig] of Object.entries(modulesObj)) {
    lines.push(`  ${name.padEnd(11)} ✓ ${moduleProvider(moduleConfig as Record<string, unknown>)}`)
  }
  if (Object.keys(modulesObj).length === 0) lines.push('  (none)')

  lines.push('', 'Environment')
  const envKeys = new Set<string>()
  if (modulesObj.vault) envKeys.add('DATABASE_URL')
  if (modulesObj.gatehouse) envKeys.add('GATEHOUSE_SECRET')
  const courierMod = modulesObj.courier as any
  if (courierMod) {
    // Don't trigger TowerModule getters (courier.email) which throw when not initialized
    const isTowerModule = typeof courierMod.name === 'string' && typeof courierMod.initialize === 'function'
    if (isTowerModule) {
      // For TowerModule, we don't have the original email provider — just add generic
      envKeys.add('RESEND_API_KEY')
    } else if (Object.prototype.hasOwnProperty.call(courierMod, 'email')) {
      const email = courierMod.email as Record<string, unknown> | undefined
      if (email?.provider === 'resend') envKeys.add('RESEND_API_KEY')
      if (email?.provider === 'smtp') {
        envKeys.add('SMTP_HOST')
        envKeys.add('SMTP_USER')
        envKeys.add('SMTP_PASS')
      }
    }
  }
  for (const key of envKeys) lines.push(`  ${key.padEnd(19)} ${envStatus(key)}`)
  if (envKeys.size === 0) lines.push('  (no module environment variables)')

  return ok(lines)
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
  try {
    const direct = app.container.get<CliModule>(name)
    if (direct) return direct
  } catch {}
  try {
    return app.container.get<CliModule>(`module.${name}`)
  } catch {
    return undefined
  }
}

/** Loads the raw tower config without initializing any modules. */
export async function loadConfig(configPath: string): Promise<TowerConfig> {
  loadEnvFor(configPath)
  const jiti = createJiti(import.meta.url, { interopDefault: true })
  const loaded = await jiti.import(configPath)
  return ((loaded as { default?: TowerConfig }).default ?? loaded) as TowerConfig
}

export async function loadApp(configPath?: string): Promise<TowerApp> {
  if (!configPath) configPath = findConfig()
  const resolvedConfig = await loadConfig(configPath)
  const modules = await createModuleDefinitions(resolvedConfig.modules)
  const { initTower } = await import('@towerjs/tower/runtime')
  return initTower(modules, resolvedConfig)
}

/**
 * Loads `.env` / `.env.local` files from the directory containing the Tower
 * config so the CLI (migrate/seed) sees the same environment as `next dev`.
 * Existing process.env values are never overridden.
 */
export function loadEnvFor(configPath: string): void {
  const dir = path.dirname(configPath)
  for (const file of ['.env', '.env.local', '.env.development']) {
    const fullPath = path.join(dir, file)
    if (!fs.existsSync(fullPath)) continue
    const raw = fs.readFileSync(fullPath, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (process.env[key] !== undefined) continue
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    }
  }
}

export async function closeModules(app: TowerApp) {
  const modules = app.config.modules as unknown as Array<TowerModule | string> | Record<string, unknown>
  const names = Array.isArray(modules)
    ? modules.map((m: any) => (typeof m === 'string' ? m : m.name))
    : Object.keys(modules as Record<string, unknown>)
  for (const name of names) {
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
  return `tower v${version}`
}

const currentFile = fs.realpathSync(fileURLToPath(import.meta.url))
const isMain = process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === currentFile
if (isMain) {
  const [command, ...flags] = process.argv.slice(2)
  run(command, flags).then(
    (result) => {
      for (const line of result.stdout) process.stdout.write(line + '\n')
      for (const line of result.stderr) process.stderr.write(line + '\n')
      process.exit(result.exitCode)
    },
    (err) => {
      if (String(err).includes('User force closed the prompt')) {
        process.exit(0)
      }
      console.error(err)
      process.exit(1)
    }
  )
}
