import type { TowerContext, TowerModule } from '@towerjs/blueprint'
import { registerModule } from '@towerjs/blueprint'

import type { Migrator } from 'kysely/migration'

import { parseVaultConfig } from './schemas.js'
import type { Vault, VaultConfig, VaultMigrationConfig, VaultModule, VaultSeedConfig } from './types.js'

export type { VaultConfig, Vault, VaultModule, VaultSeedConfig, VaultMigrationConfig } from './types.js'

export async function createMigrator(db: Vault, config: VaultMigrationConfig): Promise<Migrator> {
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

let _vault: VaultModule | undefined
let _pool: { end(): Promise<void> } | undefined

const NOOP_POOL: { end(): Promise<void> } = { end: async () => {} }

function resolveConnectionString(config?: VaultConfig): string {
  return config?.connectionString ?? (typeof process !== 'undefined' ? process.env.DATABASE_URL : undefined) ?? ''
}

function resolveProvider(config?: VaultConfig): 'neon' | 'pg' {
  const url = resolveConnectionString(config)
  if (config?.provider) return config.provider
  if (url.includes('.neon.tech')) return 'neon'
  return 'pg'
}

function resolveSsl(
  poolConfig: VaultConfig['pool'],
  connectionString: string
): boolean | { rejectUnauthorized?: boolean } | undefined {
  if (poolConfig?.ssl !== undefined) return poolConfig.ssl
  const sslmode = /[?&]sslmode=([^&]+)/.exec(connectionString)?.[1]
  if (sslmode) {
    if (sslmode === 'disable' || sslmode === 'prefer') return false
    if (sslmode === 'no-verify') return { rejectUnauthorized: false }
    return true
  }
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return true
  return undefined
}

async function loadKysely(): Promise<{
  Kysely: new (config: { dialect: import('kysely').Dialect }) => import('kysely').Kysely<any>
  PostgresDialect: new (config: { pool: any }) => import('kysely').PostgresDialect
}> {
  return import('kysely')
}

async function createPool(
  connectionString: string,
  poolConfig?: VaultConfig['pool'],
  runtime?: { name: string; isServerless: boolean }
): Promise<any> {
  const config: Record<string, unknown> = {
    connectionString,
  }
  if (poolConfig?.max) config.max = poolConfig.max
  if (poolConfig?.idleTimeoutMillis) config.idleTimeoutMillis = poolConfig.idleTimeoutMillis
  if (poolConfig?.connectionTimeoutMillis) config.connectionTimeoutMillis = poolConfig.connectionTimeoutMillis

  const isEdge = runtime?.name === 'edge'
  const ssl = resolveSsl(poolConfig, connectionString)

  if (isEdge) {
    throw new Error(
      'The pg provider requires a TCP connection which is not available on Edge Runtime. ' +
        'Use the neon provider instead (e.g., { provider: "neon" }).'
    )
  }

  const { Pool: PgPool } = await import('pg')
  const pool = new PgPool(ssl !== undefined ? { ...config, ssl } : config)

  pool.on('error', () => {
    /* pg pool errors are handled by query timeouts */
  })

  return pool
}

async function validateConnection(pool: any): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('SELECT 1')
  } finally {
    client.release()
  }
}

/**
 * Proxy singleton that dispatches to the initialized vault module.
 *
 * Throws if accessed before Tower has started. Use `vault.selectFrom()`,
 * `vault.insertInto()`, etc. for queries. All Kysely methods (fn, schema,
 * raw, dynamic, etc.) are forwarded directly — no vault.db needed.
 */
export const vault: VaultModule = new Proxy({} as VaultModule, {
  get(_, prop) {
    if (!_vault) throw new Error('Vault not initialized. Tower must be started first.')
    const value = (_vault as any)[prop]
    return typeof value === 'function' ? (...args: any[]) => (value as Function)(...args) : value
  },
})

function buildProxyUnconfigured(): VaultModule {
  return new Proxy({} as VaultModule, {
    get(_, prop) {
      if (prop === 'migrate' || prop === 'migrator') {
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
  _migrator: Migrator
): VaultModule {
  return new Proxy(db as unknown as VaultModule, {
    get(target, prop) {
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
 * Creates a Tower module that registers the vault database service.
 *
 * @example
 * ```ts
 * defineTower({
 *   modules: {
 *     vault: { connectionString: process.env.DATABASE_URL },
 *   },
 * })
 * ```
 */
export function createVaultModule(options?: VaultConfig): TowerModule & { init: (ctx: TowerContext) => Promise<void> } {
  parseVaultConfig(options)

  return {
    name: 'vault',

    register(ctx: TowerContext) {
      _vault = buildProxyUnconfigured()
      ctx.services.register('vault', _vault)
    },

    async initialize(ctx: TowerContext) {
      const connectionString = resolveConnectionString(options)

      if (!connectionString) {
        _vault = buildProxyUnconfigured()
        ctx.services.register('vault', _vault)
        return
      }

      const provider = resolveProvider(options)
      const isEdge = ctx.runtime.name === 'edge'
      await _pool?.end().catch(() => {})

      // Neon: use the HTTP dialect directly, bypassing any connection pool.
      if (provider === 'neon') {
        const { Kysely } = await loadKysely()
        const [{ NeonDialect }, { neon }] = await Promise.all([
          import('kysely-neon'),
          import('@neondatabase/serverless'),
        ])
        const db: Vault = new Kysely({
          dialect: new NeonDialect({ neon: neon(connectionString) }),
        })
        _pool = NOOP_POOL
        _vault = await buildProxyForRuntime(db, NOOP_POOL, isEdge, options)
        ;(_vault as any)._kysely = db
        ctx.services.register('vault', _vault)
        return
      }

      const pool = await createPool(connectionString, options?.pool, ctx.runtime)
      _pool = pool

      if (!isEdge) {
        try {
          await validateConnection(pool)
        } catch (err) {
          await pool.end().catch(() => {})
          throw new Error(
            `Could not connect to database at ${connectionString.replace(/\/\/.*@/, '//***@')}: ${(err as Error).message}`
          )
        }
      }

      const { Kysely, PostgresDialect } = await loadKysely()
      const db: Vault = new Kysely({ dialect: new PostgresDialect({ pool }) })

      _vault = await buildProxyForRuntime(db, pool, isEdge, options)
      ;(_vault as any)._kysely = db

      ctx.services.register('vault', _vault)
    },

    init(ctx: TowerContext) {
      return this.initialize!(ctx)
    },
  }
}

registerModule({
  name: 'vault',
  dependsOn: [],
  factory: (config) => createVaultModule(config as VaultConfig),
})
