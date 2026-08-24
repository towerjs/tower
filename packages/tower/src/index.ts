import type { TowerConfig } from './foundation/types.js'

export { defineTower } from './blueprint/index.js'
export type { TowerBlueprint } from './blueprint/index.js'

export { createTower, createTowerApp } from './foundation/app.js'
export type { TowerApp } from './foundation/app.js'

export { ServiceContainer } from './foundation/container.js'
export { towerContext, setRequestContextResolver, getRequestContextResolver } from './foundation/context/index.js'
export type { TowerContextProvider, RequestContext } from './foundation/context/index.js'
export { detectRuntime } from './foundation/runtime.js'
export { resolveDependencyOrder } from './foundation/dependency-graph.js'

export { registerService } from './foundation/registry.js'
export { getService } from './foundation/registry.js'

export type {
  RuntimeName,
  TowerRuntime,
  TowerConfig,
  TowerModule,
  TowerContext,
  TowerInitContext,
  ServiceRegistry,
} from './foundation/types.js'
export type { DependencyValidationResult, DependencyError } from './foundation/dependency-graph.js'

export { env } from './blueprint/env.js'

/** @internal Lazily-loads resolve-config to avoid bundler tracing of dynamic import(). */
export async function resolveConfig(): Promise<TowerConfig> {
  const mod = await import('./foundation/resolve-config.js')
  return mod.resolveConfig()
}

/** @internal Lazily-loads registerConfigProvider to avoid bundler tracing of dynamic import(). */
export async function registerConfigProvider(provider: () => Promise<TowerConfig | undefined>): Promise<void> {
  const mod = await import('./foundation/resolve-config.js')
  mod.registerConfigProvider(provider)
}
