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

async function buildApp(config: TowerConfig): Promise<TowerApp> {
  const app = await createTowerApp(config)
  await registerModuleServices(app)
  return app
}

function registerModuleServices(app: TowerApp) {
  for (const mod of app.config.modules) {
    if (app.container.has(mod.name)) {
      registerService(mod.name, app.container.get(mod.name))
    }
  }
}

export function getTowerApp(): Promise<TowerApp> {
  const existing = getAppPromise()
  if (existing) return existing

  const promise = resolveConfig()
    .then((config) => buildApp(config))
    .catch((err) => {
      setAppPromise(undefined)
      throw err
    })

  setAppPromise(promise)
  return promise
}

export function initTower(modules: TowerModule[] = [], config?: TowerBlueprint): Promise<TowerApp> {
  const existing = getAppPromise()
  // An explicit module list must win over an app implicitly started by a
  // framework adapter during module import (for example Gatehouse's Next.js
  // dynamic-rendering hook).
  if (existing && modules.length === 0) return existing

  const promise = (async () => {
    const cfg = config ? (config as unknown as TowerConfig) : await resolveConfig()
    // `initTower` receives concrete module definitions; make them the
    // composition root even when a discovered config also exists.
    return buildApp({ ...(cfg as TowerConfig), ...(modules.length > 0 ? { modules } : {}) })
  })().catch((err) => {
    setAppPromise(undefined)
    throw err
  })

  setAppPromise(promise)
  return promise
}

export { createLazyModule }
