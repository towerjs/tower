import type { TowerConfig } from '@towerjs/foundation'
import {
  registerModule,
  getModuleFactory,
  getModuleDependencies,
  getRegisteredModules,
  getModuleDeclarations,
} from './internal.js'

export type TowerBlueprint = TowerConfig

export function defineTower(config: TowerConfig): TowerConfig {
  return config
}

export { registerModule, getModuleFactory, getModuleDependencies, getRegisteredModules, getModuleDeclarations }

export type {
  TowerConfig,
  TowerModule,
  TowerContext,
  TowerInitContext,
  TowerContextProvider,
  ServiceRegistry,
  ModuleDeclaration,
} from '@towerjs/foundation'
export type { TowerApp } from '@towerjs/foundation'
