export type RuntimeName = 'vercel-serverless' | 'node-server' | 'edge' | 'unknown'

export interface TowerRuntime {
  name: RuntimeName
  isServerless: boolean
}

export interface TowerConfig {
  modules: TowerModule[]
}

export interface TowerContext {
  services: ServiceRegistry
  config: Record<string, unknown>
  appConfig: TowerConfig
  runtime: TowerRuntime
}

export interface TowerModule {
  name: string
  dependsOn?: string[]
  register?(ctx: TowerContext): void | Promise<void>
  initialize?(ctx: TowerContext): Promise<void>
  shutdown?(ctx: TowerContext): Promise<void>
}

export interface TowerInitContext {
  container: ServiceRegistry
  config: TowerConfig
  runtime: TowerRuntime
}

export interface ServiceRegistry {
  register<T>(name: string, instance: T): void
  registerFactory<T>(name: string, factory: () => T): void
  get<T>(name: string): T
  has(name: string): boolean
}
