import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { TowerBlueprint, TowerModule, TowerInitContext } from "@towerjs/blueprint";
import { getModuleFactory } from "@towerjs/blueprint";
import type { VaultModule } from "@towerjs/vault";
import type { GatehouseModule } from "@towerjs/gatehouse";
import { ServiceContainer } from "./container";
import { detectRuntime } from "./runtime";
import type { TowerRuntime } from "./types";

export interface TowerApp {
  config: TowerBlueprint;
  container: ServiceContainer;
  runtime: TowerRuntime;
  shutdown(): Promise<void>;
}

/**
 * Module type registry — each known module is listed here.
 * Module packages previously used `declare module "@towerjs/foundation"`
 * to augment this interface; now types are imported directly.
 */
export interface TowerModules {
  vault: VaultModule;
  gatehouse: GatehouseModule;
}

export type TowerInstance = {
  [K in keyof TowerModules]: TowerModules[K]
} & {
  runtime: TowerRuntime
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

/**
 * Create a fully typed Tower instance.
 *
 * When called without arguments, automatically discovers `tower.config.ts`
 * by searching up from the working directory.
 *
 * @example
 * ```ts
 * // auto-discover config
 * import { createTower } from "@towerjs/foundation"
 * export const tower = await createTower()
 *
 * // Tests / scripts — explicit config
 * const testTower = await createTower({ modules: { vault: ... } })
 * ```
 */
export async function createTower(config?: TowerBlueprint): Promise<TowerInstance> {
  if (!config) {
    config = await discoverConfig()
  }

  const app = await createTowerApp(config)

  const modules: Record<string, unknown> = {}
  for (const [name] of Object.entries(config.modules)) {
    modules[name] = app.container.has(name)
      ? app.container.get(name)
      : app.container.get(`module.${name}`)
  }

  return {
    ...modules,
    runtime: app.runtime,
  } as unknown as TowerInstance
}

async function discoverConfig(): Promise<TowerBlueprint> {
  let dir = process.cwd()
  for (let i = 0; i < 20; i++) {
    for (const name of ["tower.config.ts", "tower.config.js", "tower.config.mjs"]) {
      const fullPath = path.join(dir, name)
      if (fs.existsSync(fullPath)) {
        const mod = await import(pathToFileURL(fullPath).href)
        return mod.default ?? mod
      }
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(
    "Could not find tower.config.ts.\n" +
    "Ensure the file exists in your project root, " +
    "or pass an explicit config to createTower(config)."
  )
}
