import type { Kysely } from "kysely"
import type { Migrator } from "kysely/migration"

export type VaultDb<T = any> = Kysely<T>

export type VaultProvider = "neon" | "pg"

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
 * The vault module interface, combining Kysely query builder methods with Tower lifecycle.
 *
 * Use `.db` to access the raw Kysely instance, `.transaction` for transactions,
 * `.migrate` / `.seed` for database management, and `.close` to release the pool.
 */
export interface VaultModule<TSchema = any> extends Omit<Kysely<TSchema>, "transaction"> {
  readonly db: VaultDb<TSchema>
  transaction<T>(fn: (trx: VaultDb<TSchema>) => Promise<T>): Promise<T>
  migrate(): Promise<void>
  seed(name?: string): Promise<void>
  close(): Promise<void>
  migrator: Migrator
}
