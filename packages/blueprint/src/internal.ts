import type { ModuleFactory, ModuleDeclaration } from '@towerjs/foundation'

interface StoredModule {
  factory: ModuleFactory
  dependsOn: string[]
}

const moduleRegistry = new Map<string, StoredModule>()

export function registerModule(name: string, factory: ModuleFactory): void
export function registerModule(declaration: ModuleDeclaration): void
export function registerModule(nameOrDecl: string | ModuleDeclaration, factory?: ModuleFactory): void {
  if (typeof nameOrDecl === 'string') {
    const name = nameOrDecl
    moduleRegistry.set(name, { factory: factory!, dependsOn: [] })
  } else {
    const decl = nameOrDecl as ModuleDeclaration
    moduleRegistry.set(decl.name, { factory: decl.factory, dependsOn: decl.dependsOn ?? [] })
  }
}

export function getModuleFactory(name: string): ModuleFactory | undefined {
  return moduleRegistry.get(name)?.factory
}

export function getModuleDependencies(name: string): string[] | undefined {
  return moduleRegistry.get(name)?.dependsOn
}

export function getRegisteredModules(): string[] {
  return Array.from(moduleRegistry.keys())
}

export function getModuleDeclarations(): ModuleDeclaration[] {
  return Array.from(moduleRegistry.entries()).map(([name, stored]) => ({
    name,
    dependsOn: stored.dependsOn,
    factory: stored.factory,
  }))
}

export function resetModuleFactories(): void {
  moduleRegistry.clear()
}
