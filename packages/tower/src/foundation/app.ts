import { ServiceContainer } from './container.js'
import { resolveDependencyOrder } from './dependency-graph.js'
import { detectRuntime } from './runtime.js'
import type { TowerConfig, TowerContext, TowerModule, TowerRuntime } from './types.js'

export interface TowerApp {
  config: TowerConfig
  container: ServiceContainer
  runtime: TowerRuntime
  shutdown(): Promise<void>
}

export async function createTowerApp(config: TowerConfig): Promise<TowerApp> {
  const runtime = detectRuntime()
  const container = new ServiceContainer()

  container.register('tower.config', config)
  container.register('tower.runtime', runtime)

  if (!Array.isArray(config.modules)) {
    throw new Error(
      'tower.config modules must be an array of module definitions. ' +
        'Use callable module exports, e.g. modules: [vault(), gatehouse()].'
    )
  }

  const moduleList: TowerModule[] = []
  for (const mod of config.modules) {
    if (!mod.name) {
      throw new Error(`Module definition missing name`)
    }
    moduleList.push(mod)
    container.register(`module.${mod.name}`, mod)
  }

  // Validate dependencies for all modules
  for (const mod of moduleList) {
    const deps = mod.dependsOn ?? []
    for (const dep of deps) {
      const hasDep = moduleList.some((m) => m.name === dep)
      if (!hasDep) {
        throw new Error(
          `Module "${mod.name}" depends on "${dep}" which is not in the modules array. ` +
            `Add ${dep}() to your modules array.`
        )
      }
    }
  }

  const resolved = resolveDependencyOrder(moduleList)
  if (!resolved.valid) {
    const messages = resolved.errors.map((e) => `  - ${e.message}`).join('\n')
    throw new Error(`Module dependency validation failed:\n${messages}`)
  }

  const nameToModule = new Map<string, TowerModule>()
  for (const mod of moduleList) {
    nameToModule.set(mod.name, mod)
  }

  const orderedModules: TowerModule[] = []
  for (const name of resolved.order) {
    const mod = nameToModule.get(name)
    if (mod) orderedModules.push(mod)
  }

  // Register every module before initializing any, so modules can resolve
  // their dependencies' services during initialize().
  for (const mod of orderedModules) {
    if (typeof mod.register === 'function') {
      const ctx: TowerContext = { services: container, config: {}, appConfig: config, runtime }
      await mod.register(ctx)
    }
  }

  for (const mod of orderedModules) {
    const ctx: TowerContext = { services: container, config: {}, appConfig: config, runtime }
    if (mod.initialize) {
      await mod.initialize(ctx)
    }
  }

  return {
    config,
    container,
    runtime,
    async shutdown() {
      const reverse = moduleList.slice().reverse()
      for (const mod of reverse) {
        const ctx: TowerContext = { services: container, config: {}, appConfig: config, runtime }
        if (mod.shutdown) await mod.shutdown(ctx)
      }
    },
  }
}

export async function createTower(config?: TowerConfig): Promise<TowerApp & Record<string, unknown>> {
  if (!config) {
    const { resolveConfig: _resolveConfig } = await import('./resolve-config.js')
    config = await _resolveConfig()
  }

  const app = await createTowerApp(config)

  const tower: TowerApp & Record<string, unknown> = {
    config: app.config,
    container: app.container,
    runtime: app.runtime,
    shutdown: app.shutdown,
  }

  // Expose module services by name
  for (const mod of config.modules) {
    if (app.container.has(mod.name)) {
      tower[mod.name] = app.container.get(mod.name)
    } else if (app.container.has(`module.${mod.name}`)) {
      tower[mod.name] = app.container.get(`module.${mod.name}`)
    }
  }

  return tower
}
