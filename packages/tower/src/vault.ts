import type { VaultModule } from '@towerjs/vault'

import { createLazyModule } from './lazy-module.js'

/**
 * Lazy vault proxy.
 *
 * First access triggers tower initialization. Delegates to the
 * initialized `@towerjs/vault` module. Use `vault.selectFrom()`,
 * `vault.insertInto()`, etc. for queries. All Kysely methods (fn, schema,
 * raw, dynamic, etc.) are forwarded directly — no vault.db needed.
 */
export const vault = createLazyModule<VaultModule>('vault')
export type { VaultModule, Vault } from '@towerjs/vault'
