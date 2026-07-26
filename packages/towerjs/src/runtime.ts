import { createTowerApp, resolveConfig } from '@towerjs/foundation'
import type { TowerApp } from '@towerjs/foundation'
import type { TowerBlueprint } from '@towerjs/blueprint'

let _appPromise: Promise<TowerApp> | undefined

export function getTowerApp(): Promise<TowerApp> {
  if (!_appPromise) {
    _appPromise = resolveConfig().then(createTowerApp)
  }
  return _appPromise
}

export async function initTower(config?: TowerBlueprint): Promise<TowerApp> {
  if (!_appPromise) {
    _appPromise = config ? createTowerApp(config) : resolveConfig().then(createTowerApp)
  }
  return _appPromise
}
