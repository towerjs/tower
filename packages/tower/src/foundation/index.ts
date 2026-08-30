export { createTowerApp, createTower } from './app.js'
export type { TowerApp } from './app.js'
export { ServiceContainer } from './container.js'
export {
  towerContext,
  setTowerContextProvider,
  setRequestContextResolver,
  getRequestContextResolver,
} from './context/index.js'
export type { TowerContextProvider, RequestContext } from './context/index.js'
export { detectRuntime } from './runtime.js'
// resolveConfig and registerConfigProvider are deliberately inline (not re-exported from resolve-config.js)
// to prevent Next.js/Turbopack from tracing the resolve-config module's dynamic import() at bundle time.
export { resolveDependencyOrder } from './dependency-graph.js'

export type {
  RuntimeName,
  TowerRuntime,
  TowerConfig,
  TowerModule,
  TowerContext,
  TowerInitContext,
  ServiceRegistry,
} from './types.js'
export type { DependencyValidationResult, DependencyError } from './dependency-graph.js'
