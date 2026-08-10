import type { TowerApp, TowerModule, TowerContext, TowerConfig } from '@towerjs/foundation'
import type { TowerBlueprint } from '@towerjs/blueprint'
import { registerService } from '@towerjs/foundation'

type ModuleFactoryFn = (options: Record<string, unknown>) => TowerModule

const MODULE_DEFS: Record<string, { pkg: string; dependsOn: string[]; factoryFn: string }> = {
  vault: { pkg: '@towerjs/vault', dependsOn: [], factoryFn: 'createVaultModule' },
  gatehouse: { pkg: '@towerjs/gatehouse', dependsOn: ['vault', 'courier'], factoryFn: 'defineGatehouse' },
  courier: { pkg: '@towerjs/courier', dependsOn: [], factoryFn: 'defineCourier' },
}

// Function-based import to prevent Next.js/Turbopack from tracing
// server-only transitive deps (pg, nodemailer, etc.) into client bundles.
export const importModule = Function('f', 'return import(f)') as (f: string) => Promise<any>

function createModuleFactory(name: string, enabled?: ReadonlySet<string>): ModuleFactoryFn {
  const def = MODULE_DEFS[name]
  if (!def) return undefined as unknown as ModuleFactoryFn
  const dependsOn = def.dependsOn.filter((d) => !enabled || enabled.has(d))
  return (options: Record<string, unknown>): TowerModule => {
    let real: TowerModule | undefined
    let pending: Promise<TowerModule | undefined> | undefined
    const loadReal = async (_ctx: TowerContext): Promise<TowerModule | undefined> => {
      if (real) return real
      if (!pending) {
        pending = importModule(def.pkg).then((mod) => {
          real = mod[def.factoryFn](options)
          return real
        })
      }
      await pending
      return real
    }
    return {
      name,
      dependsOn,
      async register(ctx: TowerContext) {
        const mod = await loadReal(ctx)
        if (mod && typeof mod.register === 'function') await mod.register(ctx)
      },
      async initialize(ctx: TowerContext) {
        const mod = await loadReal(ctx)
        if (mod && typeof mod.initialize === 'function') await mod.initialize(ctx)
      },
    }
  }
}

export function getModuleFactory(name: string) {
  return createModuleFactory(name)
}

export function getModuleFactoryForConfig(config: TowerConfig): (name: string) => ModuleFactoryFn | undefined {
  const enabled = new Set(Object.keys(config.modules))
  return (name: string) => createModuleFactory(name, enabled)
}

const APP_PROMISE_KEY = '___tower_app_promise___'

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

function setAppPromise(promise: Promise<TowerApp>) {
  (globalThis as any)[APP_PROMISE_KEY] = promise
}

function getAppPromise(): Promise<TowerApp> | undefined {
  return (globalThis as any)[APP_PROMISE_KEY]
}

export function getTowerApp(): Promise<TowerApp> {
  const existing = getAppPromise()
  if (existing) return existing

  const promise = getFoundation().then(async ({ resolveConfig, createTowerApp }) => {
    const config = await resolveConfig()
    const app = await createTowerApp(config as TowerConfig, getModuleFactoryForConfig(config as TowerConfig))
    await registerModuleServices(app)
    return app
  })

  setAppPromise(promise)
  return promise
}

export function initTower(config?: TowerBlueprint): Promise<TowerApp> {
  const existing = getAppPromise()
  if (existing) return existing

  const promise = getFoundation().then(async ({ createTowerApp, resolveConfig }) => {
    let app: TowerApp
    if (config) {
      app = await createTowerApp(config as unknown as TowerConfig, getModuleFactoryForConfig(config as unknown as TowerConfig))
    } else {
      const cfg = await resolveConfig()
      app = await createTowerApp(cfg as TowerConfig, getModuleFactoryForConfig(cfg as TowerConfig))
    }
    await registerModuleServices(app)
    return app
  })

  setAppPromise(promise)
  return promise
}
