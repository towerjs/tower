export interface ServiceRegistry {
  register<T>(name: string, instance: T): void;
  registerFactory<T>(name: string, factory: () => T): void;
  get<T>(name: string): T;
  has(name: string): boolean;
}

export interface TowerInitContext {
  container: ServiceRegistry;
  config: { framework: string };
  runtime: { name: string; isServerless: boolean };
}

export interface TowerModule {
  name: string;
  init?(ctx: TowerInitContext): Promise<void>;
  shutdown?(): Promise<void>;
}

export type TowerBlueprint = {
  framework: string;
  modules: TowerModule[];
};

export function defineTower(config: TowerBlueprint): TowerBlueprint {
  return config;
}
