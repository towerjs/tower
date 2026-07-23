import type { TowerApplicationConfig } from "@towerjs/blueprint";
import { createGatehouse, type GatehouseModule } from "@towerjs/gatehouse";
import { createVault, type VaultModule } from "@towerjs/vault";

export type TowerApplication<Config extends TowerApplicationConfig = TowerApplicationConfig> = {
  config: Config;
  gatehouse: GatehouseModule;
  vault: VaultModule;
};

/**
 * Creates the Tower application kernel from a Blueprint configuration.
 *
 * The kernel currently wires placeholder module instances only. Provider
 * resolution, runtime management, HTTP, and routing are intentionally left out.
 */
export async function createApplication<const Config extends TowerApplicationConfig>(
  config: Config,
): Promise<TowerApplication<Config>> {
  return {
    config,
    gatehouse: createGatehouse(),
    vault: createVault(),
  };
}
