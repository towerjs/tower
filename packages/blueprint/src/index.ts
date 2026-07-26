/**
 * Provides per-request scoped storage via AsyncLocalStorage.
 *
 * Implementations manage the lifecycle of context data across
 * asynchronous boundaries within a single request.
 */
export interface TowerContextProvider {
  run<T>(data: Record<string, unknown>, handler: () => Promise<T>): Promise<T>
  get<T = unknown>(key: string): T | undefined
}

/** Global context provider that holds request-scoped data (e.g. the current gatehouse instance). */
export const towerContext: TowerContextProvider = await (async (): Promise<TowerContextProvider> => {
  try {
    const { AsyncLocalStorage } = await import('node:async_hooks')
    const storage = new AsyncLocalStorage<Record<string, unknown>>()
    return {
      run<T>(data: Record<string, unknown>, handler: () => Promise<T>) {
        return storage.run(data, handler)
      },
      get<T = unknown>(key: string): T | undefined {
        return storage.getStore()?.[key] as T | undefined
      },
    }
  } catch {
    return {
      run<T>(_data: Record<string, unknown>, handler: () => Promise<T>) {
        return handler()
      },
      get() {
        return undefined
      },
    }
  }
})()

/**
 * Registry for named services.
 *
 * Modules register themselves and their dependencies during init
 * so they can be discovered by other modules at runtime.
 */
export interface ServiceRegistry {
  register<T>(name: string, instance: T): void
  registerFactory<T>(name: string, factory: () => T): void
  get<T>(name: string): T
  has(name: string): boolean
}

/** Context passed to each module's `init()` hook during application startup. */
export interface TowerInitContext {
  container: ServiceRegistry
  config: TowerBlueprint
  runtime: { name: string; isServerless: boolean }
}

/**
 * Contract that every Tower module must satisfy.
 *
 * Modules implement `init` to wire into the application lifecycle
 * and `shutdown` to release resources on graceful termination.
 */
export interface TowerModule {
  name: string
  init?(ctx: TowerInitContext): Promise<void>
  shutdown?(): Promise<void>
}

export type ModuleFactory = (config: Record<string, unknown>) => TowerModule

/** Application blueprint that declares which modules to load and their configuration. */
export type TowerBlueprint = {
  modules: Record<string, Record<string, unknown>>
}

/**
 * Defines the application configuration.
 *
 * Blueprint is the source of truth for enabled modules and their options.
 * Pass the result to `createTowerApp` or export as default from `tower.config.ts`.
 *
 * @example
 * ```ts
 * export default defineTower({
 *   modules: { vault: {}, gatehouse: { provider: "better-auth" } },
 * })
 * ```
 */
export function defineTower(config: TowerBlueprint): TowerBlueprint {
  return config
}

const moduleFactories = new Map<string, ModuleFactory>()

/** Registers a module factory so it can be instantiated by name from the config. */
export function registerModule(name: string, factory: ModuleFactory): void {
  moduleFactories.set(name, factory)
}

export function getModuleFactory(name: string): ModuleFactory | undefined {
  return moduleFactories.get(name)
}

/** @internal Clears all registered module factories. Used only in tests. */
export function resetModuleFactories(): void {
  moduleFactories.clear()
}
