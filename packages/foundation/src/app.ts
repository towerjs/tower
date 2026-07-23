import type { TowerBlueprint, TowerModule, TowerInitContext } from "@towerjs/blueprint";
import { getModuleFactory } from "@towerjs/blueprint";
import { ServiceContainer } from "./container";
import { detectRuntime } from "./runtime";

import "@towerjs/vault";
import "@towerjs/gatehouse";

export interface TowerApp {
  config: TowerBlueprint;
  container: ServiceContainer;
  runtime: ReturnType<typeof detectRuntime>;
  shutdown(): Promise<void>;
}

export async function createTowerApp(config: TowerBlueprint): Promise<TowerApp> {
  const runtime = detectRuntime();
  const container = new ServiceContainer();

  container.register("tower.config", config);
  container.register("tower.runtime", runtime);

  const moduleList: TowerModule[] = [];

  for (const [name, options] of Object.entries(config.modules)) {
    const factory = getModuleFactory(name);

    if (!factory) {
      throw new Error(
        `Unknown module "${name}". Is the corresponding @towerjs/${name} package installed?`,
      );
    }

    const mod = factory(options ?? {});
    const ctx: TowerInitContext = { container, config, runtime };
    if (mod.init) await mod.init(ctx);
    moduleList.push(mod);
    container.register(`module.${mod.name}`, mod);
  }

  return {
    config,
    container,
    runtime,
    async shutdown() {
      for (const mod of moduleList.reverse()) {
        if (mod.shutdown) await mod.shutdown();
      }
    },
  };
}
