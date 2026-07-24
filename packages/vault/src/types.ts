import type { Kysely } from "kysely"
import type { Migrator } from "kysely/migration"

export type VaultDb<T = any> = Kysely<T>

export type VaultProvider = "neon" | "pg"

export type VaultPoolConfig = {
  max?: number
  idleTimeoutMillis?: number
  connectionTimeoutMillis?: number
  ssl?: boolean | { rejectUnauthorized?: boolean }
}

export type VaultMigrationConfig = {
  folder: string
}

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

export interface VaultModule<TSchema = any> extends Omit<Kysely<TSchema>, "transaction"> {
  readonly db: VaultDb<TSchema>
  transaction<T>(fn: (trx: VaultDb<TSchema>) => Promise<T>): Promise<T>
  migrate(): Promise<void>
  seed(name?: string): Promise<void>
  close(): Promise<void>
  migrator: Migrator
}
