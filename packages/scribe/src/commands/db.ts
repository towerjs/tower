import { readdirSync } from 'node:fs'
import { join } from 'node:path'

import type { TowerApp } from '@towerjs/tower/foundation'
import type { Vault } from '@towerjs/vault'

import { DummyDriver, Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely'
import type { LogEvent } from 'kysely'

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
    '  --pretend   Print the SQL each migration would run without executing',
    '  --force     Required for destructive subcommands when NODE_ENV=production',
    '  --help, -h  Show this message',
    '',
  ]
}

/** Entry point for `tower db <subcommand>`. */
export interface DbFlags {
  force?: boolean
  pretend?: boolean
  help?: boolean
}

/** Parses the flags accepted by `tower db` subcommands. Unknown flags are ignored. */
export function parseDbFlags(flags: string[]): DbFlags {
  return {
    force: flags.includes('--force'),
    pretend: flags.includes('--pretend'),
    help: flags.includes('--help') || flags.includes('-h'),
  }
}

/**
 * Decides whether a destructive subcommand may proceed.
 *
 * - Outside production: allowed.
 * - Production with --force: allowed.
 * - Production in an interactive terminal without --force: ask for explicit
 *   confirmation.
 * - Production non-interactive without --force: blocked (CI and cron jobs
 *   must opt in deliberately).
 */
export function destructiveDecision(
  subcommand: DbSubcommand,
  flags: DbFlags,
  env: NodeJS.ProcessEnv = process.env,
  isInteractive = Boolean((process.stdout as any).isTTY && (process.stdin as any).isTTY)
): { allowed: true; reason: string } | { allowed: false; needsPrompt: boolean; reason: string } {
  if (!DESTRUCTIVE[subcommand]) return { allowed: true, reason: 'non-destructive' }
  if (env.NODE_ENV !== 'production') return { allowed: true, reason: 'not production' }
  if (flags.force) return { allowed: true, reason: '--force' }
  const detail = `"db ${subcommand}" is destructive (${DESTRUCTIVE[subcommand]}).`
  if (!isInteractive) {
    return { allowed: false, needsPrompt: false, reason: `${detail} Re-run with --force to proceed in production.` }
  }
  return { allowed: false, needsPrompt: true, reason: `${detail} Confirm to proceed.` }
}

async function confirmDestructive(subcommand: DbSubcommand, flags: DbFlags): Promise<CliResult | undefined> {
  const decision = destructiveDecision(subcommand, flags)
  if (decision.allowed) return undefined

  if (!decision.needsPrompt) return fail(decision.reason)

  const confirmed = await promptConfirm(`${decision.reason}\nProceed? Type "yes" to continue`)
  if (!confirmed) return fail('Aborted.')
  return undefined
}

/** Minimal yes/no confirmation for interactive terminals. */
async function promptConfirm(question: string): Promise<boolean> {
  const readline = await import('node:readline/promises')
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = (await rl.question(`${question}: `)).trim().toLowerCase()
    return answer === 'yes' || answer === 'y'
  } finally {
    rl.close()
  }
}

export async function dbCommand(args: string[], configPath?: string): Promise<CliResult> {
  const [subcommand, ...rest] = args
  const parsed = parseDbFlags(rest)
  if (!subcommand || parsed.help) return ok(dbHelp())

  // `tower db` with a stray flag like `--seed` (legacy muscle memory) still works.
  const resolved = SUBCOMMANDS.includes(subcommand as DbSubcommand)
    ? (subcommand as DbSubcommand)
    : rest.includes('--seed')
      ? 'setup'
      : undefined
  if (!resolved) {
    return fail(`Unknown db subcommand "${subcommand}". Available: ${SUBCOMMANDS.join(', ')}`)
  }

  const blocked = await confirmDestructive(resolved, parsed)
  if (blocked) return blocked

  const app = await loadApp(configPath)
  try {
    switch (resolved) {
      case 'migrate':
        return await migrate(app, parsed)
      case 'rollback':
        return await rollback(app, parsed)
      case 'refresh':
        return await refresh(app, parsed)
      case 'fresh':
        return await fresh(app, parsed)
      case 'status':
        return await status(app)
      case 'seed':
        return await seed(app)
      case 'setup':
        return await setup(app, parsed)
    }
  } finally {
    await closeQuietly(app)
  }
}

// ─── Subcommands ──────────────────────────────────────────────────────

async function migrate(app: TowerApp, parsed: DbFlags): Promise<CliResult> {
  const lines = parsed.pretend ? await pretendMigrations(app) : await runSteppedMigrations(app)
  lines.push('Done.')
  return ok(lines)
}

async function rollback(app: TowerApp, parsed: DbFlags): Promise<CliResult> {
  const { migrator } = await vaultMigrator(app, parsed.pretend)
  const { error, results } = await migrator.migrateDown()
  if (error) throw error

  const lines = ['Rolling back...']
  for (const result of results ?? []) {
    lines.push(`  ↓ ${result.migrationName} (${result.status})`)
  }
  if (!results || results.length === 0) lines.push('  Nothing to roll back.')
  lines.push(parsed.pretend ? 'Pretend run complete — nothing was executed.' : 'Done.')
  return ok(lines)
}

async function refresh(app: TowerApp, parsed: DbFlags): Promise<CliResult> {
  const lines = await rollbackAll(app, parsed)
  lines.push('')
  const migrated = parsed.pretend ? await pretendMigrations(app) : await runSteppedMigrations(app)
  if (parsed.pretend) migrated.push('Pretend run complete — nothing was executed.')
  return ok([...lines, ...migrated])
}

async function fresh(app: TowerApp, parsed: DbFlags): Promise<CliResult> {
  const vault = requireVault(app)
  const lines = ['Dropping schema...']
  if (parsed.pretend) {
    lines.push('  [pretend] DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
  } else {
    await vault.db.schema.dropSchema('public').ifExists().cascade().execute()
    await vault.db.schema.createSchema('public').ifNotExists().execute()
    lines.push('Schema recreated.')
  }

  lines.push('')
  const migrated = parsed.pretend ? await pretendMigrations(app) : await runSteppedMigrations(app)
  if (parsed.pretend) {
    const seeds = countSeedFiles()
    if (seeds > 0) lines.push('', `[pretend] Would run ${seeds} seed file(s).`)
    migrated.push('Pretend run complete — nothing was executed.')
    return ok([...lines, ...migrated])
  }

  const seeded = await seedIfAvailable(app)
  return ok([...lines, ...migrated, ...seeded])
}

async function status(app: TowerApp): Promise<CliResult> {
  const { ordered, executed } = await vaultMigrator(app)

  const lines = ['Migrations', `  ${ordered.filter((n) => executed.has(n)).length}/${ordered.length} applied`, '']
  for (const name of ordered) {
    lines.push(`  ${executed.has(name) ? '\u2713' : '\u00b7'} ${name}`)
  }
  if (ordered.length === 0) lines.push('  No migrations found.')
  return ok(lines)
}

async function seed(app: TowerApp): Promise<CliResult> {
  const lines = await seedIfAvailable(app)
  if (lines.length === 0) return fail('Vault not configured or seeds not available.')
  lines.push('Done.')
  return ok(lines)
}

async function setup(app: TowerApp, parsed: DbFlags): Promise<CliResult> {
  const migrated = parsed.pretend ? await pretendMigrations(app) : await runSteppedMigrations(app)
  if (parsed.pretend) {
    migrated.push('Pretend run complete — nothing was executed.')
    return ok(migrated)
  }
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

/**
 * Runs pending vault migrations one at a time, each in its own committed
 * transaction — if migration N fails, migrations 1..N-1 stay applied and a
 * re-run resumes from N. Auth migrations follow once the schema is in place.
 */
async function runSteppedMigrations(app: TowerApp): Promise<string[]> {
  const lines = await runVaultStepped(app)
  const gatehouse = getModule(app, 'gatehouse')
  if (gatehouse?.migrate) {
    lines.push('Running auth migrations...')
    await gatehouse.migrate()
  }
  if (lines.length === 0 && !gatehouse?.migrate) lines.push('Nothing to migrate.')
  return lines
}

async function runVaultStepped(app: TowerApp): Promise<string[]> {
  const vault = getModule(app, 'vault') as any
  if (!vault?.db) return []
  const { migrator, executed, ordered } = await vaultMigrator(app)
  const pending = ordered.filter((name) => !executed.has(name))
  if (pending.length === 0) return []

  const lines = [`Running ${pending.length} pending migration(s)...`]
  for (const target of pending) {
    const { error, results } = await migrator.migrateTo(target)
    if (error) throw error
    for (const result of results ?? []) {
      lines.push(`  \u2191 ${result.migrationName} (${result.status})`)
    }
  }
  return lines
}

/**
 * Dry-run: compiles every pending migration against a non-executing driver
 * and prints the SQL it would send. The real database is never touched — no
 * schema changes, no migration-table writes.
 */
async function pretendMigrations(app: TowerApp): Promise<string[]> {
  const vault = getModule(app, 'vault') as any
  if (!vault?.db) return ['Nothing to migrate.']

  const folder = vaultFolder(app.config) ?? DEFAULT_MIGRATIONS_FOLDER
  const captured: string[] = []
  const db = new Kysely<any>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (d: Kysely<any>) => new PostgresIntrospector(d),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    log: (event: LogEvent) => {
      if (event.level === 'query') captured.push(event.query.sql)
    },
  })

  const { createMigrator } = await import('@towerjs/vault')
  const migrator = await createMigrator(db as unknown as Vault, { folder })

  captured.push('-- [pretend] migrations that migrate-to-latest would apply:')
  const { error } = await migrator.migrateToLatest()
  if (error) throw error

  const lines = ['Pretend run \u2014 SQL that would be executed:', '']
  for (const statement of captured) {
    lines.push(...statement.split('\n').map((l) => `  ${l}`))
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
  migrateTo(name: string): Promise<{ error?: unknown; results?: Array<{ migrationName: string; status: string }> }>
}

async function vaultMigrator(
  app: TowerApp,
  pretend = false
): Promise<{
  migrator: MigratorLike
  executed: Set<string>
  ordered: string[]
}> {
  const vault = requireVault(app)
  const { createMigrator } = await import('@towerjs/vault')
  const folder = vaultFolder(app.config) ?? DEFAULT_MIGRATIONS_FOLDER

  let db: Vault = vault.db
  if (pretend) db = pretendDb()

  const migrator = (await createMigrator(db, { folder })) as unknown as MigratorLike

  const definedKeys = Object.keys(await definedMigrations(migrator)).sort()
  const executed = pretend ? new Set<string>() : await executedMigrationNames(vault.db)
  return { migrator, executed, ordered: definedKeys }
}

/** A Kysely instance whose driver never touches a database — for dry-runs. */
function pretendDb(): Vault {
  return new Kysely<any>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (d: Kysely<any>) => new PostgresIntrospector(d),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  })
}

async function definedMigrations(migrator: MigratorLike): Promise<Record<string, unknown>> {
  try {
    const provider = (migrator as any).provider
    if (typeof provider?.getMigrations === 'function') return await provider.getMigrations()
  } catch {}
  return {}
}

/** Reads executed migration names from Kysely's bookkeeping table. */
async function executedMigrationNames(db: Vault): Promise<Set<string>> {
  try {
    const rows: Array<{ name: string }> = await (db as any).selectFrom('kysely_migration').select('name').execute()
    return new Set(rows.map((r) => String(r.name)))
  } catch {
    // Bookkeeping table doesn't exist yet — nothing has ever migrated.
    return new Set()
  }
}

function vaultFolder(config: { modules?: unknown }): string | undefined {
  const arr = Array.isArray(config.modules) ? config.modules : []
  const vaultMod = arr.find((m: any) => m?.name === 'vault') as any
  return vaultMod?.migrations?.folder
}

async function rollbackAll(app: TowerApp, parsed: DbFlags = {}): Promise<string[]> {
  const { migrator } = await vaultMigrator(app, parsed.pretend)
  const lines = ['Rolling back all migrations...']
  for (;;) {
    const { error, results } = await migrator.migrateDown()
    if (error) throw error
    if (!results || results.length === 0) break
    for (const result of results) lines.push(`  \u2193 ${result.migrationName} (${result.status})`)
  }
  return lines
}

function countSeedFiles(): number {
  try {
    return readdirSync(join(process.cwd(), './src/vault/seeds')).filter((f) => !f.startsWith('.')).length
  } catch {
    return 0
  }
}
