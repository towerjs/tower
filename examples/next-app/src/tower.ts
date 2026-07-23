import { createTowerApp } from "towerjs";
import type { VaultModule, GatehouseModule } from "towerjs";
import config from "../tower.config";

const app = await createTowerApp(config);

export const tower = {
  vault: app.container.get<VaultModule>("vault"),
  gatehouse: app.container.get<GatehouseModule>("gatehouse"),
};
