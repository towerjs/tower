import { createTowerApp, type TowerRuntime } from "@towerjs/foundation";
import type { VaultModule } from "@towerjs/vault";
import type { GatehouseModule } from "@towerjs/gatehouse";
import config from "../tower.config";

const app = await createTowerApp(config);

export type TowerApp = {
  vault: VaultModule;
  gatehouse: GatehouseModule;
  runtime: TowerRuntime;
};

export const tower: TowerApp = {
  vault: app.container.get("vault"),
  gatehouse: app.container.get("gatehouse"),
  runtime: app.runtime,
};
