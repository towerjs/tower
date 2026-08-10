export { defineTower } from '@towerjs/blueprint'
export type { TowerBlueprint } from '@towerjs/blueprint'

export { createTower, createTowerApp } from '@towerjs/foundation'
export type { TowerApp } from '@towerjs/foundation'

export { initTower, getTowerApp } from './runtime'

import type { TowerApp } from '@towerjs/foundation'
import { getTowerApp } from './runtime'

let _tower: TowerApp | undefined

getTowerApp().then((app) => {
  _tower = app
})

export const tower: TowerApp = new Proxy({} as TowerApp, {
  get(_, prop) {
    if (prop === 'then') return undefined
    if (!_tower)
      throw new Error('Tower app is still initializing. Use getTowerApp() from towerjs/runtime for async access.')
    const value = (_tower as any)[prop]
    return typeof value === 'function' ? value.bind(_tower) : value
  },
})
