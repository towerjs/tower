import "@towerjs/vault";
import "@towerjs/gatehouse";
import "@towerjs/courier";
import { createTower } from "@towerjs/foundation";
import type { TowerInstance } from "@towerjs/foundation";

/**
 * Default Tower application instance.
 *
 * Auto-discovers `tower.config.ts` from the working directory.
 * Import this in your app entry point to get a fully initialized Tower.
 */
export const tower: TowerInstance = await createTower();

export { createTower } from "@towerjs/foundation";
export type { TowerInstance } from "@towerjs/foundation";

export { defineTower } from "@towerjs/blueprint";
export type { TowerBlueprint } from "@towerjs/blueprint";
