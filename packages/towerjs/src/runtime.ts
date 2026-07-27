import type { TowerApp, TowerModule, TowerContext, TowerConfig } from '@towerjs/foundation'
import type { TowerBlueprint } from '@towerjs/blueprint'
import { registerService } from '@towerjs/foundation'

type ModuleFactoryFn = (options: Record<string, unknown>) => TowerModule

const MODULE_DEFS: Record<string, { pkg: string; dependsOn: string[]; factoryFn: string }> = {
  vault: { pkg: '@towerjs/vault', dependsOn: [], factoryFn: 'createVaultModule' },
  gatehouse: { pkg: '@towerjs/gatehouse', dependsOn: ['vault'], factoryFn: 'defineGatehouse' },
  courier: { pkg: '@towerjs/courier', dependsOn: [], factoryFn: 'defineCourier' },
}

const importModule = Function('f', 'return import(f)') as (f: string) => Promise<any>

function createModuleFactory(name: string): ModuleFactoryFn {
  const def = MODULE_DEFS[name]
  if (!def) return undefined as unknown as ModuleFactoryFn
  return (options: Record<string, unknown>): TowerModule => ({
    name,
    dependsOn: def.dependsOn,
    async initialize(ctx: TowerContext) {
      const mod = await importModule(def.pkg)
      const factory = mod[def.factoryFn]
      const real = factory(options)
      if (typeof real.register === 'function') real.register(ctx)
      if (typeof real.initialize === 'function') await real.initialize(ctx)
    },
  })
}

function getModuleFactory(name: string) {
  return createModuleFactory(name)
}

let _appPromise: Promise<TowerApp> | undefined

async function getFoundation() {
  return import('@towerjs/foundation')
}

async function registerModuleServices(app: TowerApp) {
  const config = app.container.get('tower.config') as { modules: Record<string, unknown> }
  for (const modName of Object.keys(config.modules)) {
    if (app.container.has(modName)) {
      registerService(modName, app.container.get(modName))
    }
  }
}

export function getTowerApp(): Promise<TowerApp> {
  if (!_appPromise) {
    _appPromise = getFoundation().then(async ({ resolveConfig, createTowerApp }) => {
      const config = await resolveConfig()
      const app = await createTowerApp(config as TowerConfig, getModuleFactory)
      await registerModuleServices(app)
      return app
    })
  }
  return _appPromise
}

export function initTower(config?: TowerBlueprint): Promise<TowerApp> {
  if (!_appPromise) {
    _appPromise = getFoundation().then(async ({ createTowerApp, resolveConfig }) => {
      let app: TowerApp
      if (config) {
        app = await createTowerApp(config as unknown as TowerConfig, getModuleFactory)
      } else {
        const cfg = await resolveConfig()
        app = await createTowerApp(cfg as TowerConfig, getModuleFactory)
      }
      await registerModuleServices(app)
      return app
    })
  }
  return _appPromise
}
