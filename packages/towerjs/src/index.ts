export { defineTower } from '@towerjs/blueprint'
export type { TowerBlueprint } from '@towerjs/blueprint'

export { createTower, createTowerApp } from '@towerjs/foundation'
export type { TowerApp } from '@towerjs/foundation'

export { initTower, getTowerApp } from './runtime'

import { getModuleFactory } from '@towerjs/blueprint'
import { createTower as _createTower } from '@towerjs/foundation'
import type { TowerApp } from '@towerjs/foundation'

export const tower: TowerApp = await _createTower(undefined, getModuleFactory)
