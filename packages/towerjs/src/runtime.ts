import type { TowerApp } from '@towerjs/foundation'
import type { TowerBlueprint } from '@towerjs/blueprint'
import { getModuleFactory } from '@towerjs/blueprint'
import { registerService } from '@towerjs/foundation'

let _appPromise: Promise<TowerApp> | undefined

async function getFoundation() {
  return import('@towerjs/foundation')
}

async function registerModuleServices(app: TowerApp) {
  const config = app.container.get('tower.config') as { modules: Record<string, unknown> }
  for (const name of Object.keys(config.modules)) {
    if (app.container.has(name)) {
      registerService(name, app.container.get(name))
    }
  }
}

export function getTowerApp(): Promise<TowerApp> {
  if (!_appPromise) {
    _appPromise = getFoundation().then(async ({ resolveConfig, createTowerApp }) => {
      const config = await resolveConfig()
      const app = await createTowerApp(config, getModuleFactory)
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
        app = await createTowerApp(config, getModuleFactory)
      } else {
        const cfg = await resolveConfig()
        app = await createTowerApp(cfg, getModuleFactory)
      }
      await registerModuleServices(app)
      return app
    })
  }
  return _appPromise
}
