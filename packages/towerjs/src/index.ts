export { defineTower } from '@towerjs/blueprint'
export type { TowerBlueprint } from '@towerjs/blueprint'

export { createTower, createTowerApp } from '@towerjs/foundation'
export type { TowerApp } from '@towerjs/foundation'

export { initTower, getTowerApp } from './runtime.js'

import type { TowerApp } from '@towerjs/foundation'
import { getTowerApp } from './runtime.js'

let _tower: TowerApp | undefined

getTowerApp().then((app) => {
  _tower = app
}).catch(() => {
  // Initialization failed — _tower stays undefined and the proxy will
  // throw a helpful error on access. The rejection is handled here so
  // it doesn't surface as an unhandled rejection at module scope.
})

export const tower: TowerApp = new Proxy({} as TowerApp, {
  get(_, prop) {
    if (prop === 'then') return undefined
    if (!_tower)
      throw new Error('Tower app is still initializing. Use getTowerApp() from towerjs/runtime for async access.')
    // Resolve module services (vault, gatehouse, courier) from the container.
    if (typeof prop === 'string' && _tower.container.has(prop)) {
      const service = _tower.container.get(prop)
      return typeof service === 'function' ? service.bind(_tower) : service
    }
    const value = (_tower as any)[prop]
    return typeof value === 'function' ? value.bind(_tower) : value
  },
})
