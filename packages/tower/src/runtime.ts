import type { TowerBlueprint } from './blueprint/index.js'
import type { TowerApp } from './foundation/app.js'
import { createTowerApp } from './foundation/app.js'
import { registerService } from './foundation/registry.js'
import { resolveConfig } from './foundation/resolve-config.js'
import type { TowerConfig, TowerModule } from './foundation/types.js'
import { createLazyModule } from './lazy-module.js'

const APP_PROMISE_KEY = '___tower_app_promise___'

function setAppPromise(promise: Promise<TowerApp> | undefined) {
  ;(globalThis as any)[APP_PROMISE_KEY] = promise
}

function getAppPromise(): Promise<TowerApp> | undefined {
  return (globalThis as any)[APP_PROMISE_KEY]
}

async function buildApp(config: TowerConfig, modules: TowerModule[]): Promise<TowerApp> {
  const app = await createTowerApp(config, (name: string) => {
    const mod = modules.find((m) => m.name === name)
    return mod ? (_options: Record<string, unknown>) => mod : undefined
  })
  await registerModuleServices(app, modules)
  return app
}

async function registerModuleServices(app: TowerApp, modules: TowerModule[]) {
  for (const mod of modules) {
    if (app.container.has(mod.name)) {
      registerService(mod.name, app.container.get(mod.name))
    }
  }
}

export function getTowerApp(): Promise<TowerApp> {
  const existing = getAppPromise()
  if (existing) return existing

  const promise = resolveConfig()
    .then((config) => buildApp(config, []))
    .catch((err) => {
      setAppPromise(undefined)
      throw err
    })

  setAppPromise(promise)
  return promise
}

export function initTower(modules: TowerModule[], config?: TowerBlueprint): Promise<TowerApp> {
  const existing = getAppPromise()
  if (existing) return existing

  const promise = (async () => {
    const cfg = config ? (config as unknown as TowerConfig) : await resolveConfig()
    return buildApp(cfg as TowerConfig, modules)
  })().catch((err) => {
    setAppPromise(undefined)
    throw err
  })

  setAppPromise(promise)
  return promise
}

export { createLazyModule }
