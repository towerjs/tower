import type { TowerContext, TowerModule } from '@towerjs/tower/foundation'
import { createLazyModule } from '@towerjs/tower/runtime'

import { parseVaultConfig } from './schemas.js'
import type { Vault, VaultConfig, VaultMigrationConfig, VaultMigrator, VaultModule, VaultSeedConfig } from './types.js'

export type { VaultConfig, Vault, VaultModule, VaultSeedConfig, VaultMigrationConfig } from './types.js'

export async function createMigrator(db: Vault, config: VaultMigrationConfig): Promise<VaultMigrator> {
  const mod = await import('./migrate.js')
  return mod.createMigrator(db, config)
}

export async function migrateToLatest(db: Vault, config: VaultMigrationConfig): Promise<void> {
  const mod = await import('./migrate.js')
  return mod.migrateToLatest(db, config)
}

export async function runSeeds(db: Vault, config: VaultSeedConfig, name?: string): Promise<{ applied: string[] }> {
  const mod = await import('./seed.js')
  return mod.runSeeds(db, config, name)
}

// Provider abstraction — consumers can name the provider types (closes #93)
export type { VaultProvider, VaultProviderName, VaultProviderDef, VaultPoolConfig, VaultMigrator } from './types.js'
export { resolveProviderName, resolveVaultProvider, pgProvider, neonProvider } from './providers.js'

let _vault: VaultModule | undefined
let _pool: { end(): Promise<void> } | undefined

const NOOP_POOL: { end(): Promise<void> } = { end: async () => {} }

function resolveConnectionString(config?: VaultConfig): string {
  return config?.connectionString ?? (typeof process !== 'undefined' ? process.env.DATABASE_URL : undefined) ?? ''
}

async function loadKysely(): Promise<{
  Kysely: new (config: { dialect: import('kysely').Dialect }) => import('kysely').Kysely<any>
}> {
  return import('kysely')
}

async function validateConnection(pool: any): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('SELECT 1')
  } finally {
    client.release()
  }
}

/** Extracts a useful message from a connection failure — pg's pool.connect() rejects with an AggregateError whose message is empty. */
function resolveConnectionError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  if (err instanceof AggregateError && err.errors.length > 0) {
    const first = err.errors[0]
    if (first instanceof Error && first.message) return first.message
  }
  return String(err)
}

/**
 * Proxy singleton that dispatches to the initialized vault module.
 *
 * Throws if accessed before Tower has started. Use `vault.selectFrom()`,
 * `vault.insertInto()`, etc. for queries. All Kysely methods (fn, schema,
 * raw, dynamic, etc.) are forwarded directly — no vault.db needed.
 */
const vaultRuntime = createLazyModule<VaultModule>('vault')

function buildProxyUnconfigured(): VaultModule {
  return new Proxy({} as VaultModule, {
    get(_, prop) {
      if (prop === 'migrate' || prop === 'migrator' || prop === 'db') {
        throw new Error('Vault not configured. Set DATABASE_URL or pass connectionString to vault().')
      }
      return () => {
        throw new Error('Vault not configured. Set DATABASE_URL or pass connectionString to vault().')
      }
    },
  })
}

function buildProxyDb(db: Vault, pool: { end(): Promise<void> }): VaultModule {
  return new Proxy(db as unknown as VaultModule, {
    get(target, prop) {
      if (prop === 'db') return db
      if (prop === 'close') return () => pool.end()
      if (prop === 'transaction') {
        return <T>(fn: (trx: Vault) => Promise<T>) => db.transaction().execute(fn)
      }
      if (prop === 'migrate' || prop === 'migrator' || prop === 'seed') {
        return () => {
          throw new Error(
            'Migrations and seeds are not available on Edge Runtime. Run them locally or in a Node.js environment with `tower migrate`.'
          )
        }
      }
      return (target as any)[prop]
    },
  })
}

function buildProxyConfigured(
  db: Vault,
  pool: { end(): Promise<void> },
  migrationFolder: string,
  seedFolder: string,
  _migrator: VaultMigrator
): VaultModule {
  return new Proxy(db as unknown as VaultModule, {
    get(target, prop) {
      if (prop === 'db') return db
      if (prop === 'migrator') return _migrator
      if (prop === 'migrate') {
        return () => migrateToLatest(db, { folder: migrationFolder })
      }
      if (prop === 'seed') {
        return (name?: string) => runSeeds(db, { folder: seedFolder }, name)
      }
      if (prop === 'close') {
        return () => pool.end()
      }
      if (prop === 'transaction') {
        return <T>(fn: (trx: Vault) => Promise<T>) => db.transaction().execute(fn)
      }
      return (target as any)[prop]
    },
  })
}

async function buildProxyForRuntime(
  db: Vault,
  pool: { end(): Promise<void> },
  isEdge: boolean,
  options?: VaultConfig
): Promise<VaultModule> {
  if (isEdge) return buildProxyDb(db, pool)

  const migrationFolder = options?.migrations?.folder ?? './src/vault/migrations'
  const seedFolder = options?.seeds?.folder ?? './src/vault/seeds'
  const migrator = await createMigrator(db, { folder: migrationFolder })
  return buildProxyConfigured(db, pool, migrationFolder, seedFolder, migrator)
}

/**
 * Creates a Tower module definition for Vault.
 *
 * @example
 * ```ts
 * import { vault } from '@towerjs/vault'
 * import { defineTower } from '@towerjs/tower'
 *
 * export default defineTower({
 *   modules: [
 *     vault({ connectionString: process.env.DATABASE_URL }),
 *   ],
 * })
 * ```
 */
function createVaultModuleDefinition(options?: VaultConfig): TowerModule {
  parseVaultConfig(options)

  const initialize = async (ctx: TowerContext) => {
    const connectionString = resolveConnectionString(options)

    if (!connectionString) {
      _vault = buildProxyUnconfigured()
      ctx.services.register('vault', vaultRuntime)
      return
    }

    const { resolveProviderName, resolveVaultProvider, getPoolFromDialect } = await import('./providers.js')
    const providerName = resolveProviderName({ provider: options?.provider, connectionString }, connectionString)
    const provider = await resolveVaultProvider(providerName)
    const isEdge = ctx.runtime.name === 'edge'
    await _pool?.end().catch(() => {})

    // Provider abstraction: dialect creation is owned by the provider.
    // Application code (queries, migrations, transactions) stays provider-agnostic.
    const dialect = await provider.createDialect({
      connectionString,
      poolConfig: options?.pool,
      runtime: ctx.runtime,
    })

    const extractedPool = getPoolFromDialect(dialect as any) as any
    const effectivePool: { end(): Promise<void> } = extractedPool ?? NOOP_POOL
    _pool = effectivePool

    if (extractedPool && !isEdge) {
      try {
        await validateConnection(extractedPool)
      } catch (err) {
        await extractedPool.end().catch(() => {})
        const cause = resolveConnectionError(err)
        throw new Error(`Could not connect to database at ${connectionString.replace(/\/\/.*@/, '//***@')}: ${cause}`)
      }
    }

    const { Kysely } = await loadKysely()
    const db: Vault = new Kysely({ dialect })

    _vault = await buildProxyForRuntime(db, effectivePool, isEdge, options)
    ;(_vault as any)._kysely = db

    ctx.services.register('vault', vaultRuntime)
  }

  return {
    name: 'vault',
    dependsOn: [],

    register(ctx: TowerContext) {
      _vault = buildProxyUnconfigured()
      ctx.services.register('vault', vaultRuntime)
    },

    initialize,
    // legacy alias for hermetic tests using old `init` name
    init: initialize as any,
  } as TowerModule
}

/**
 * Vault module - callable for config, property face for runtime API.
 *
 * Usage:
 * ```ts
 * // In tower.config.ts - config factory
 * import { vault } from '@towerjs/vault'
 * export default defineTower({ modules: [vault({ connectionString: process.env.DATABASE_URL })] })
 * ```
 *
 * ```ts
 * // In application code - runtime API
 * import { vault } from '@towerjs/vault'
 * const users = await vault.selectFrom('users').selectAll().execute()
 * ```
 */
export const vault = new Proxy(createVaultModuleDefinition, {
  get(_target, prop) {
    // The call face returns the module definition
    if (prop === 'apply' || prop === 'name' || prop === 'length') {
      return (_target as any)[prop]
    }
    // Hermetic tests set _vault directly via mod.init; use it if available
    if (_vault) return (_vault as any)[prop]
    // If not yet initialized, throw for direct property access (matches vault.test expectations)
    // Lazy runtime will handle async `getTowerApp` path in production, but for sync access we throw
    if (
      prop === 'then' ||
      typeof prop === 'symbol' ||
      prop === 'toString' ||
      prop === 'valueOf' ||
      prop === 'toJSON' ||
      prop === 'inspect'
    )
      return undefined
    throw new Error('Vault not initialized')
  },
  apply(_target, _thisArg, args) {
    return _target(...args)
  },
}) as ((options?: VaultConfig) => TowerModule) & VaultModule

// Legacy aliases for hermetic tests — internal, not part of public contract
export const createVaultModule = createVaultModuleDefinition
export const defineVault = createVaultModuleDefinition
