import { createTower } from "@towerjs/foundation";
import type { TowerInstance } from "@towerjs/foundation";

export const tower: TowerInstance = await createTower();

export { createTower } from "@towerjs/foundation";
export type { TowerInstance } from "@towerjs/foundation";

export { defineTower } from "@towerjs/blueprint";
export type { TowerBlueprint } from "@towerjs/blueprint";
