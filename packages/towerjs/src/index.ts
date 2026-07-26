export { defineTower } from '@towerjs/blueprint'
export type { TowerBlueprint } from '@towerjs/blueprint'

export { createTower } from '@towerjs/foundation'

export { initTower, getTowerApp } from './runtime'

import { createTower as _createTower } from '@towerjs/foundation'
import type { TowerInstance } from '@towerjs/foundation'

export const tower: TowerInstance = await _createTower()
