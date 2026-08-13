import type { TowerConfig } from '@towerjs/foundation'
import {
  registerModule,
  getModuleFactory,
  getModuleDependencies,
  getRegisteredModules,
  getModuleDeclarations,
} from './internal.js'

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
 * export default defineTower({
 *   modules: {
 *     vault: { connectionString: process.env.DATABASE_URL },
 *     gatehouse: { provider: "better-auth", credentials: true },
 *     courier: { email: { provider: "console" } },
 *   },
 * })
 * ```
 */
export function defineTower(config: TowerConfig): TowerConfig {
  return config
}

export { registerModule, getModuleFactory, getModuleDependencies, getRegisteredModules, getModuleDeclarations }

export { towerContext } from '@towerjs/foundation'
export { env } from './env.js'

export type {
  TowerConfig,
  TowerModule,
  TowerContext,
  TowerInitContext,
  TowerContextProvider,
  ServiceRegistry,
  ModuleDeclaration,
} from '@towerjs/foundation'
export type { TowerApp } from '@towerjs/foundation'
