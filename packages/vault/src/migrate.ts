import * as nodeFs from 'node:fs'
import * as nodePath from 'node:path'

import { FileMigrationProvider, Migrator } from 'kysely/migration'

import type { Vault, VaultMigrationConfig } from './types.js'

const vaultFs = {
  readdir: (p: string) => nodeFs.promises.readdir(p),
}

export function createMigrator(db: Vault, config: VaultMigrationConfig): Migrator {
  const resolvedFolder = nodePath.resolve(config.folder)
  return new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs: vaultFs,
      path: nodePath,
      migrationFolder: resolvedFolder,
    }),
  })
}

/** Runs all pending migrations. Throws on error, returns results on success. */
export async function migrateToLatest(db: Vault, config: VaultMigrationConfig): Promise<void> {
  const migrator = createMigrator(db, config)
  const { error, results } = await migrator.migrateToLatest()

  if (error) {
    throw error
  }

  if (results) {
    for (const result of results) {
      if (result.status === 'Error') {
        throw new Error(`Migration "${result.migrationName}" failed`)
      }
    }
  }
}
