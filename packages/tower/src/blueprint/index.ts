import type { TowerConfig } from '../foundation/types.js'

export type TowerBlueprint = TowerConfig

/**
 * Type-safe config helper for Tower applications.
 *
 * Wraps your module config in the correct type so editors provide
 * autocomplete. At runtime it's a no-op — it just returns the config
 * as-is.
 *
 * @example
 * ```ts
 * // tower.config.ts
 * import { vault } from '@towerjs/vault'
 * import { gatehouse } from '@towerjs/gatehouse'
 *
 * export default defineTower({
 *   modules: [
 *     vault({ connectionString: process.env.DATABASE_URL }),
 *     gatehouse({ provider: 'better-auth', credentials: true }),
 *   ],
 * })
 * ```
 */
export function defineTower(config: TowerConfig): TowerConfig {
  return config
}

export { towerContext, setTowerContextProvider } from '../foundation/context/index.js'
export { env } from './env.js'

export type { TowerConfig, TowerModule, TowerContext, TowerInitContext, ServiceRegistry } from '../foundation/types.js'
export type { TowerContextProvider, RequestContext } from '../foundation/context/index.js'
export type { TowerApp } from '../foundation/app.js'
