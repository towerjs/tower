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
