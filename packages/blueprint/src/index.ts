import { AsyncLocalStorage } from "async_hooks"

export interface TowerContextProvider {
  run<T>(data: Record<string, unknown>, handler: () => Promise<T>): Promise<T>
  get<T = unknown>(key: string): T | undefined
}

class NodeTowerContextProvider implements TowerContextProvider {
  private storage = new AsyncLocalStorage<Record<string, unknown>>()

  run<T>(data: Record<string, unknown>, handler: () => Promise<T>): Promise<T> {
    return this.storage.run(data, handler)
  }

  get<T = unknown>(key: string): T | undefined {
    return this.storage.getStore()?.[key] as T | undefined
  }
}

export const towerContext: TowerContextProvider = new NodeTowerContextProvider()

export interface ServiceRegistry {
  register<T>(name: string, instance: T): void;
  registerFactory<T>(name: string, factory: () => T): void;
  get<T>(name: string): T;
  has(name: string): boolean;
}

export interface TowerInitContext {
  container: ServiceRegistry;
  config: TowerBlueprint;
  runtime: { name: string; isServerless: boolean };
}

export interface TowerModule {
  name: string;
  init?(ctx: TowerInitContext): Promise<void>;
  shutdown?(): Promise<void>;
}

export type ModuleFactory = (config: Record<string, unknown>) => TowerModule;

export type TowerBlueprint = {
  modules: Record<string, Record<string, unknown>>;
};

export function defineTower(config: TowerBlueprint): TowerBlueprint {
  return config;
}

const moduleFactories = new Map<string, ModuleFactory>();

export function registerModule(name: string, factory: ModuleFactory): void {
  moduleFactories.set(name, factory);
}

export function getModuleFactory(name: string): ModuleFactory | undefined {
  return moduleFactories.get(name);
}
