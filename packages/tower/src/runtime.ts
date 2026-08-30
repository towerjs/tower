import type { TowerBlueprint } from './blueprint/index.js'
import type { TowerApp } from './foundation/app.js'
import { createTowerApp } from './foundation/app.js'
import type { TowerConfig, TowerModule } from './foundation/types.js'
import { createLazyModule } from './lazy-module.js'

const APPLICATION_STATE_KEY = '___tower_default_application___'

interface DefaultApplicationState {
  app?: TowerApp
  promise?: Promise<TowerApp>
  explicit?: boolean
  configProvider?: () => Promise<TowerConfig>
}

function applicationState(): DefaultApplicationState {
  const globals = globalThis as typeof globalThis & {
    [APPLICATION_STATE_KEY]?: DefaultApplicationState
  }
  return (globals[APPLICATION_STATE_KEY] ??= {})
}

function clearFailedApplication(promise: Promise<TowerApp>): void {
  const state = applicationState()
  if (state.promise === promise) {
    state.promise = undefined
    state.explicit = undefined
  }
  state.app = undefined
}

async function resolveRuntimeConfig(): Promise<TowerConfig> {
  const provider = applicationState().configProvider
  if (provider) return provider()
  throw new Error(
    'Tower has no application blueprint. Pass the imported tower.config.ts to initTower(), ' +
      'or install a runtime adapter that provides configuration discovery.'
  )
}

/** @internal Installs configuration discovery for a concrete runtime adapter. */
export function registerTowerConfigProvider(provider: () => Promise<TowerConfig>): void {
  applicationState().configProvider = provider
}

export function getTowerApp(): Promise<TowerApp> {
  const state = applicationState()
  const existing = state.promise
  if (existing) return existing

  const promise = resolveRuntimeConfig()
    .then((config) => createTowerApp(config))
    .then((app) => {
      if (applicationState().promise === promise) applicationState().app = app
      return app
    })
    .catch((err) => {
      clearFailedApplication(promise)
      throw err
    })

  state.promise = promise
  return promise
}

export function initTower(modules: TowerModule[] = [], config?: TowerBlueprint): Promise<TowerApp> {
  const state = applicationState()
  const existing = state.promise
  // An explicit module list must win over an app implicitly started by a
  // framework adapter during module import (for example Gatehouse's Next.js
  // dynamic-rendering hook).
  if (existing && (modules.length === 0 || state.explicit)) return existing

  const promise = (async () => {
    const cfg = config ? (config as unknown as TowerConfig) : await resolveRuntimeConfig()
    // `initTower` receives concrete module definitions; make them the
    // composition root even when a discovered config also exists.
    return createTowerApp({ ...(cfg as TowerConfig), ...(modules.length > 0 ? { modules } : {}) })
  })()
    .then((app) => {
      if (applicationState().promise === promise) applicationState().app = app
      return app
    })
    .catch((err) => {
      clearFailedApplication(promise)
      throw err
    })

  state.promise = promise
  state.explicit = modules.length > 0
  return promise
}

/** Returns a service from the initialized default application. */
export function getTowerService<T>(name: string): T {
  const app = applicationState().app
  if (!app) {
    throw new Error(`Tower has not initialized. Await getTowerApp() before accessing the "${name}" service.`)
  }
  return app.container.get<T>(name)
}

/** Resolves a service after initializing the default application when necessary. */
export async function resolveTowerService<T>(name: string): Promise<T> {
  const app = applicationState().app ?? (await getTowerApp())
  return app.container.get<T>(name)
}

/** @internal Test and development hook for disposing the cached default application. */
export async function resetTowerApp(): Promise<void> {
  const state = applicationState()
  const app = state.app ?? (state.promise ? await state.promise.catch(() => undefined) : undefined)
  state.app = undefined
  state.promise = undefined
  state.explicit = undefined
  if (app) await app.shutdown()
}

export { createLazyModule }
