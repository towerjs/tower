import type { Kysely } from "kysely"
import type { Migrator } from "kysely/migration"

export type VaultDb<T = any> = Kysely<T>

export type VaultProvider = "neon" | "pg"

export type VaultPoolConfig = {
  max?: number
  idleTimeoutMillis?: number
  connectionTimeoutMillis?: number
}

export type VaultMigrationConfig = {
  folder: string
}

export type VaultConfig = {
  provider?: VaultProvider
  connectionString?: string
  pool?: VaultPoolConfig
  migrations?: VaultMigrationConfig
}

export interface VaultModule {
  db: VaultDb
  transaction<T>(fn: (trx: VaultDb) => Promise<T>): Promise<T>
  migrate(): Promise<void>
  migrator: Migrator
}
