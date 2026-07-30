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
 * Use `.db` to access the database handle directly, `.transaction` for transactions,
 * `.migrate` / `.seed` for database management, and `.close` to release the pool.
 */
export interface VaultModule<TSchema = unknown> extends Omit<Kysely<TSchema>, 'transaction'> {
  readonly db: Vault<TSchema>
  transaction<T>(fn: (trx: Vault<TSchema>) => Promise<T>): Promise<T>
  migrate(): Promise<void>
  seed(name?: string): Promise<void>
  close(): Promise<void>
  migrator: Migrator
}
