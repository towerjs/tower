import type { Kysely } from 'kysely'
import type { Migrator } from 'kysely/migration'

/**
 * The Vault database handle.
 *
 * Vault is Tower's typed database API. It is powered by Kysely under the hood
 * and exposes the full Kysely query builder surface (selectFrom, insertInto,
 * updateTable, deleteFrom, schema, fn, etc.) plus Tower lifecycle helpers.
 * Application code talks to `Vault`; the provider (Neon HTTP or standard pg)
 * is a configuration decision, not an API difference.
 */
export type Vault<T = unknown> = Kysely<T>

export type VaultProviderName = 'neon' | 'pg'

/**
 * Provider abstraction for Vault.
 *
 * A provider owns the Kysely dialect construction for a given connection
 * string. Built-ins are `'neon'` (HTTP via kysely-neon) and `'pg'` (TCP via
 * pg). The interface is the extension point for curated Postgres hosts —
 * application code swaps `provider: 'neon'` vs `provider: 'pg'` without
 * changing queries, migrations, or seeds.
 *
 * For most apps, use the string form in `tower.config.ts`:
 * `{ provider: 'neon', connectionString: env.string('DATABASE_URL') }`.
 * The object form is for custom dialects.
 */
export interface VaultProviderDef {
  readonly name: VaultProviderName
  createDialect(options: {
    connectionString: string
    poolConfig?: VaultPoolConfig
    runtime?: { name: string; isServerless: boolean }
  }): Promise<import('kysely').Dialect> | import('kysely').Dialect
}

/** Accepted provider value in `VaultConfig` — the curated names. */
export type VaultProvider = VaultProviderName

/** Tower-owned alias for Kysely's Migrator — avoids leaking `kysely/migration` in public signatures. */
export type VaultMigrator = Migrator

/** Connection pool tuning for the database adapter. */
export type VaultPoolConfig = {
  max?: number
  idleTimeoutMillis?: number
  connectionTimeoutMillis?: number
  ssl?: boolean | { rejectUnauthorized?: boolean }
}

export type VaultMigrationConfig = {
  folder: string
}

/** Top-level configuration for the vault module. */
export type VaultConfig = {
  provider?: VaultProvider
  connectionString?: string
  pool?: VaultPoolConfig
  migrations?: VaultMigrationConfig
  seeds?: VaultSeedConfig
}

export type VaultSeedConfig = {
  folder: string
}

/**
 * The vault module interface, combining database query methods with Tower lifecycle.
 *
 * Use `vault.selectFrom()`, `vault.insertInto()`, etc. for queries,
 * `vault.transaction()` for transactions,
 * `vault.migrate()` / `vault.seed()` for database management, and
 * `vault.close()` to release the pool.
 *
 * All Kysely methods (selectFrom, insertInto, fn, schema, raw, dynamic, etc.)
 * are forwarded directly — no need for vault.db.
 *
 * @example
 * ```ts
 * type Database = {
 *   users: {
 *     id: Generated<string>
 *     name: string
 *     created_at: Generated<Date>
 *   }
 * }
 *
 * const vault = vault<Database>({ connectionString: process.env.DATABASE_URL })
 * ```
 */
export interface VaultModule<TSchema = unknown> extends Omit<Kysely<TSchema>, 'transaction'> {
  transaction<T>(fn: (trx: Vault<TSchema>) => Promise<T>): Promise<T>
  migrate(): Promise<void>
  seed(name?: string): Promise<{ applied: string[] }>
  close(): Promise<void>
  migrator: VaultMigrator
  /** Escape hatch — raw Kysely instance (vault itself). Preserved for advanced queries. */
  db: Vault<TSchema>
}
