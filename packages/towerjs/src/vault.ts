import type { VaultModule } from '@towerjs/vault'
import { createLazyModule } from './lazy-module.js'

/**
 * Lazy vault proxy.
 *
 * First access triggers tower initialization. Delegates to the
 * initialized `@towerjs/vault` module. Use `vault.db` for direct
 * database access, `vault.migrate()` / `vault.seed()` for database
 * management.
 */
export const vault = createLazyModule<VaultModule>('vault')
export type { VaultModule, Vault } from '@towerjs/vault'
