import type { TowerBlueprint, TowerModule, TowerInitContext } from "@towerjs/blueprint";
import { ServiceContainer } from "./container";
import { detectRuntime } from "./runtime";

export interface TowerApp {
  config: TowerBlueprint;
  container: ServiceContainer;
  runtime: ReturnType<typeof detectRuntime>;
  shutdown(): Promise<void>;
}

export async function createTowerApp(
  config: TowerBlueprint,
): Promise<TowerApp> {
  const runtime = detectRuntime();
  const container = new ServiceContainer();

  container.register("tower.config", config);
  container.register("tower.runtime", runtime);

  const moduleList: TowerModule[] = [];

  for (const mod of config.modules) {
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
