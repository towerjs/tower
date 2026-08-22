import { ServiceContainer } from './container.js'
import { resolveDependencyOrder } from './dependency-graph.js'
import { detectRuntime } from './runtime.js'
import type { ModuleFactory, TowerConfig, TowerContext, TowerModule, TowerRuntime } from './types.js'

export interface TowerApp {
  config: TowerConfig
  container: ServiceContainer
  runtime: TowerRuntime
  shutdown(): Promise<void>
}

function isModuleArray(modules: TowerConfig['modules']): modules is TowerModule[] {
  return Array.isArray(modules)
}

export async function createTowerApp(
  config: TowerConfig,
  getModuleFactory?: (name: string) => ModuleFactory | undefined
): Promise<TowerApp> {
  const runtime = detectRuntime()
  const container = new ServiceContainer()

  container.register('tower.config', config)
  container.register('tower.runtime', runtime)

  const moduleList: TowerModule[] = []

  if (isModuleArray(config.modules)) {
    // New format: modules is an array of pre-created module definitions.
    // This remains valid when a factory is also supplied for legacy configs.
    for (const mod of config.modules) {
      if (!mod.name) {
        throw new Error(`Module definition missing name`)
      }
      moduleList.push(mod)
      container.register(`module.${mod.name}`, mod)
    }
  } else if (getModuleFactory) {
    // Old format: modules is an object with module names as keys.
    for (const [name, options] of Object.entries(config.modules)) {
      const factory = getModuleFactory(name)
      if (!factory) {
        throw new Error(`Unknown module "${name}". Is the corresponding @towerjs/${name} package installed?`)
      }
      const mod = factory(options ?? {})
      if (!mod.name) {
        throw new Error(`Module factory for "${name}" returned a module without a name.`)
      }
      moduleList.push(mod)
      container.register(`module.${mod.name}`, mod)
    }
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

  // For old format, we need to map module names to their options
  const nameToOptions = new Map<string, Record<string, unknown>>()
  if (!isModuleArray(config.modules)) {
    for (const [name, options] of Object.entries(config.modules)) {
      nameToOptions.set(name, options ?? {})
    }
  }

  for (const mod of orderedModules) {
    if (typeof mod.register === 'function') {
      const modConfig = nameToOptions.get(mod.name) ?? {}
      const ctx: TowerContext = { services: container, config: modConfig, appConfig: config, runtime }
      await mod.register(ctx)
    }
  }

  for (const mod of orderedModules) {
    const modConfig = nameToOptions.get(mod.name) ?? {}
    const ctx: TowerContext = { services: container, config: modConfig, appConfig: config, runtime }
    if (mod.initialize) {
      await mod.initialize(ctx)
    } else if ('init' in mod && typeof (mod as any).init === 'function') {
      const oldCtx = { container, config, runtime }
      await (mod as any).init(oldCtx)
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

export async function createTower(
  config?: TowerConfig,
  getModuleFactory?: (name: string) => ModuleFactory | undefined
): Promise<TowerApp & Record<string, unknown>> {
  if (!config) {
    const { resolveConfig: _resolveConfig } = await import('./resolve-config.js')
    config = await _resolveConfig()
  }

  const app = await createTowerApp(config, getModuleFactory)

  const tower: TowerApp & Record<string, unknown> = {
    config: app.config,
    container: app.container,
    runtime: app.runtime,
    shutdown: app.shutdown,
  }

  // For backwards compatibility, expose modules by name
  const modulesIterable = isModuleArray(config.modules)
    ? config.modules
    : Object.entries(config.modules).map(([name]) => ({ name }) as TowerModule)

  for (const mod of modulesIterable) {
    if (app.container.has(mod.name)) {
      tower[mod.name] = app.container.get(mod.name)
    } else if (app.container.has(`module.${mod.name}`)) {
      tower[mod.name] = app.container.get(`module.${mod.name}`)
    }
  }

  return tower
}
