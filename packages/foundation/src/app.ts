import type { TowerConfig, TowerModule, TowerContext, ModuleFactory, TowerRuntime } from './types.js'
import { ServiceContainer } from './container.js'
import { detectRuntime } from './runtime.js'
import { resolveConfig } from './resolve-config.js'
import { resolveDependencyOrder } from './dependency-graph.js'

export interface TowerApp {
  config: TowerConfig
  container: ServiceContainer
  runtime: TowerRuntime
  shutdown(): Promise<void>
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

  if (getModuleFactory) {
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

    for (const mod of moduleList) {
      const deps = mod.dependsOn ?? []
      for (const dep of deps) {
        if (!getModuleFactory(dep)) {
          throw new Error(
            `Module "${mod.name}" depends on "${dep}" which is not installed. ` +
              `Add the @towerjs/${dep} package to your dependencies or remove the dependency.`
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

    const nameToOptions = new Map<string, Record<string, unknown>>()
    for (const [name, options] of Object.entries(config.modules)) {
      nameToOptions.set(name, options ?? {})
    }

    const orderedModules: TowerModule[] = []
    for (const name of resolved.order) {
      const mod = nameToModule.get(name)
      if (mod) orderedModules.push(mod)
    }

    for (const mod of orderedModules) {
      if (typeof mod.register === 'function') {
        const modConfig = nameToOptions.get(mod.name) ?? {}
        const ctx: TowerContext = { services: container, config: modConfig, appConfig: config, runtime }
        mod.register(ctx)
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
    config = await resolveConfig()
  }

  const app = await createTowerApp(config, getModuleFactory)

  const modules: Record<string, unknown> = {}
  for (const [name] of Object.entries(config.modules)) {
    modules[name] = app.container.has(name) ? app.container.get(name) : app.container.get(`module.${name}`)
  }

  return { ...modules, runtime: app.runtime } as TowerApp & Record<string, unknown>
}
