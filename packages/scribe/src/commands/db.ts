import { readdirSync } from 'node:fs'
import { join } from 'node:path'

import type { TowerApp } from '@towerjs/tower/foundation'
import type { Vault } from '@towerjs/vault'

import { type CliResult, fail, getModule, loadApp, ok } from '../cli.js'

const DEFAULT_MIGRATIONS_FOLDER = './src/vault/migrations'

type DbSubcommand = 'migrate' | 'rollback' | 'refresh' | 'fresh' | 'status' | 'seed' | 'setup'

const SUBCOMMANDS: DbSubcommand[] = ['migrate', 'rollback', 'refresh', 'fresh', 'status', 'seed', 'setup']

const DESTRUCTIVE: Partial<Record<DbSubcommand, string>> = {
  rollback: 'rolls back the most recent migration',
  refresh: 'rolls back ALL migrations, then re-runs them',
  fresh: 'drops the entire public schema before migrating — all data is lost',
}

export function dbHelp(): string[] {
  return [
    '',
    'Usage: tower db <subcommand> [flags]',
    '',
    'Subcommands:',
    '  migrate     Run pending database and auth migrations',
    '  rollback    Roll back the most recent migration',
    '  status      Show executed vs pending migrations',
    '  refresh     Roll back all migrations, then re-run them',
    '  fresh       Drop the schema, then migrate from scratch (--force in production)',
    '  seed        Run database seeds',
    '  setup       Migrate, run auth migrations, then seed — first-run helper',
    '',
    'Flags:',
    '  --force     Required for destructive subcommands when NODE_ENV=production',
    '  --help, -h  Show this message',
    '',
  ]
}

/** Entry point for `tower db <subcommand>`. */
export async function dbCommand(args: string[], configPath?: string): Promise<CliResult> {
  const [subcommand, ...flags] = args
  if (!subcommand || flags.includes('--help') || flags.includes('-h')) return ok(dbHelp())

  // `tower db` with a stray flag like `--seed` (legacy muscle memory) still works.
  const resolved = SUBCOMMANDS.includes(subcommand as DbSubcommand)
    ? (subcommand as DbSubcommand)
    : args.includes('migrate') || flags.includes('--seed')
      ? 'setup'
      : undefined
  if (!resolved) {
    return fail(`Unknown db subcommand "${subcommand}". Available: ${SUBCOMMANDS.join(', ')}`)
  }

  if (DESTRUCTIVE[resolved] && process.env.NODE_ENV === 'production' && !flags.includes('--force')) {
    return fail(
      `"db ${resolved}" is destructive (${DESTRUCTIVE[resolved]}). Re-run with --force to proceed in production.`
    )
  }

  const app = await loadApp(configPath)
  try {
    switch (resolved) {
      case 'migrate':
        return await migrate(app)
      case 'rollback':
        return await rollback(app)
      case 'refresh':
        return await refresh(app)
      case 'fresh':
        return await fresh(app)
      case 'status':
        return await status(app)
      case 'seed':
        return await seed(app)
      case 'setup':
        return await setup(app)
    }
  } finally {
    await closeQuietly(app)
  }
}

// ─── Subcommands ──────────────────────────────────────────────────────

async function migrate(app: TowerApp): Promise<CliResult> {
  const lines = await runMigrations(app)
  lines.push('Done.')
  return ok(lines)
}

async function rollback(app: TowerApp): Promise<CliResult> {
  const { vault, migrator } = await vaultMigrator(app)
  void vault
  const { error, results } = await migrator.migrateDown()
  if (error) throw error

  const lines = ['Rolling back...']
  for (const result of results ?? []) {
    lines.push(`  ↓ ${result.migrationName} (${result.status})`)
  }
  if (!results || results.length === 0) lines.push('  Nothing to roll back.')
  lines.push('Done.')
  return ok(lines)
}

async function refresh(app: TowerApp): Promise<CliResult> {
  const lines = await rollbackAll(app)
  lines.push('')
  const migrated = await runMigrations(app)
  return ok([...lines, ...migrated])
}

async function fresh(app: TowerApp): Promise<CliResult> {
  const vault = requireVault(app)
  const lines = ['Dropping schema...']
  await vault.db.schema.dropSchema('public').ifExists().cascade().execute()
  await vault.db.schema.createSchema('public').ifNotExists().execute()
  lines.push('Schema recreated.')

  lines.push('')
  const migrated = await runMigrations(app)

  const seeded = await seedIfAvailable(app)
  return ok([...lines, ...migrated, ...seeded])
}

async function status(app: TowerApp): Promise<CliResult> {
  const { migrator } = await vaultMigrator(app)
  const executed = await executedMigrations(migrator)
  const files = migrationFiles()

  const lines = ['Migrations', `  ${files.filter((f) => executed.has(f)).length}/${files.length} applied`, '']
  for (const file of files) {
    lines.push(`  ${executed.has(file) ? '✓' : '·'} ${file}`)
  }
  if (files.length === 0) lines.push('  No migrations found.')
  return ok(lines)
}

async function seed(app: TowerApp): Promise<CliResult> {
  const lines = await seedIfAvailable(app)
  if (lines.length === 0) return fail('Vault not configured or seeds not available.')
  lines.push('Done.')
  return ok(lines)
}

async function setup(app: TowerApp): Promise<CliResult> {
  const migrated = await runMigrations(app)
  const seeded = await seedIfAvailable(app)
  return ok([...migrated, ...seeded, 'Setup complete.'])
}

// ─── Helpers ──────────────────────────────────────────────────────────

function requireVault(app: TowerApp): {
  db: Vault
  migrate?: () => Promise<void>
  seed?: (name?: string) => Promise<unknown>
} {
  const vault = getModule(app, 'vault') as any
  if (!vault?.db) {
    throw new Error('Vault is not configured. Add vault() to your tower.config modules.')
  }
  return vault
}

async function runMigrations(app: TowerApp): Promise<string[]> {
  const lines: string[] = []
  const vault = getModule(app, 'vault')
  if (vault?.migrate) {
    lines.push('Running database migrations...')
    await vault.migrate()
  }
  const gatehouse = getModule(app, 'gatehouse')
  if (gatehouse?.migrate) {
    lines.push('Running auth migrations...')
    await gatehouse.migrate()
  }
  if (!vault?.migrate && !gatehouse?.migrate) {
    lines.push('Nothing to migrate.')
  }
  return lines
}

async function seedIfAvailable(app: TowerApp): Promise<string[]> {
  const vault = getModule(app, 'vault')
  if (!vault?.seed) return []
  const lines = ['Running seeds...']
  await vault.seed()
  return lines
}

async function closeQuietly(app: TowerApp): Promise<void> {
  try {
    const { closeModules } = await import('../cli.js')
    await closeModules(app)
  } catch {}
}

interface MigratorLike {
  migrateDown(): Promise<{ error?: unknown; results?: Array<{ migrationName: string; status: string }> }>
  migrateToLatest(): Promise<{ error?: unknown; results?: Array<{ migrationName: string; status: string }> }>
  /** Kysely's Migrator keeps an internal provider we can read for executed names. */
  readonly provider?: unknown
}

async function vaultMigrator(
  app: TowerApp
): Promise<{ vault: ReturnType<typeof requireVault>; migrator: MigratorLike }> {
  const vault = requireVault(app)
  const { createMigrator } = await import('@towerjs/vault')
  const config = app.config as { modules?: unknown }
  const folder = vaultFolder(config) ?? DEFAULT_MIGRATIONS_FOLDER
  const migrator = (await createMigrator(vault.db, { folder })) as unknown as MigratorLike
  return { vault, migrator }
}

function vaultFolder(config: { modules?: unknown }): string | undefined {
  const modules = config.modules
  const arr = Array.isArray(modules) ? modules : []
  const vaultMod = arr.find((m: any) => m?.name === 'vault') as any
  return vaultMod?.migrations?.folder
}

async function rollbackAll(app: TowerApp): Promise<string[]> {
  const { migrator } = await vaultMigrator(app)
  const lines = ['Rolling back all migrations...']
  for (;;) {
    const { error, results } = await migrator.migrateDown()
    if (error) throw error
    if (!results || results.length === 0) break
    for (const result of results) lines.push(`  ↓ ${result.migrationName} (${result.status})`)
  }
  return lines
}

async function executedMigrations(migrator: MigratorLike): Promise<Set<string>> {
  try {
    const provider = (migrator as any).provider ?? (migrator as any).migrationProvider
    const migs = typeof provider?.getMigrations === 'function' ? await provider.getMigrations() : {}
    return new Set(Object.keys(migs))
  } catch {
    return new Set()
  }
}

function migrationFiles(): string[] {
  try {
    return readdirSync(join(process.cwd(), DEFAULT_MIGRATIONS_FOLDER))
      .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
      .map((f) => f.replace(/\.(ts|js)$/, ''))
      .sort()
  } catch {
    return []
  }
}
