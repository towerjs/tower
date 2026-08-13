import type { Kysely } from 'kysely'
import type { Migrator } from 'kysely/migration'

export type Vault<T = unknown> = Kysely<T>

export type VaultProvider = 'neon' | 'pg'

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
 */
export interface VaultModule<TSchema = unknown> extends Omit<Kysely<TSchema>, 'transaction'> {
  transaction<T>(fn: (trx: Vault<TSchema>) => Promise<T>): Promise<T>
  migrate(): Promise<void>
  seed(name?: string): Promise<{ applied: string[] }>
  close(): Promise<void>
  migrator: Migrator
}
