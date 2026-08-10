export { createTowerApp, createTower } from './app.js'
export type { TowerApp } from './app.js'
export { ServiceContainer } from './container.js'
export { towerContext, setRequestContextResolver, getRequestContextResolver } from './context/index.js'
export type { TowerContextProvider, RequestContext } from './context/index.js'
export { detectRuntime } from './runtime.js'
// resolveConfig and registerConfigProvider are deliberately inline (not re-exported from resolve-config.js)
// to prevent Next.js/Turbopack from tracing the resolve-config module's dynamic import() at bundle time.
export { resolveDependencyOrder } from './dependency-graph.js'

/**
 * Register a module-level service so it can be accessed via `getService()`.
 * Called during tower app initialization. Not typically needed in user code.
 */
export { registerService } from './registry.js'
/**
 * Retrieve a registered service by name.
 *
 * @example
 * ```ts
 * import { getService } from 'towerjs/foundation'
 * const vault = getService('vault')
 * ```
 */
export { getService } from './registry.js'
export type {
  RuntimeName,
  TowerRuntime,
  TowerConfig,
  TowerModule,
  TowerContext,
  TowerInitContext,
  ModuleFactory,
  ModuleDeclaration,
  ServiceRegistry,
} from './types.js'
export type { DependencyValidationResult, DependencyError } from './dependency-graph.js'
import type { TowerConfig } from './types.js'

/** @internal Lazily-loads resolve-config to avoid bundler tracing of dynamic import(). */
export async function resolveConfig(): Promise<TowerConfig> {
  const mod = await import('./resolve-config.js')
  return mod.resolveConfig()
}

/** @internal Lazily-loads registerConfigProvider to avoid bundler tracing of dynamic import(). */
export async function registerConfigProvider(
  provider: (config?: TowerConfig) => Promise<TowerConfig | undefined>
): Promise<void> {
  const mod = await import('./resolve-config.js')
  mod.registerConfigProvider(provider)
}
