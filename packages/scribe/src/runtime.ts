import type { TowerModule, TowerContext } from '@towerjs/foundation'

type ModuleFactoryFn = (options: Record<string, unknown>) => TowerModule

const MODULE_DEFS: Record<string, { pkg: string; dependsOn: string[]; factoryFn: string }> = {
  vault: { pkg: '@towerjs/vault', dependsOn: [], factoryFn: 'createVaultModule' },
  gatehouse: { pkg: '@towerjs/gatehouse', dependsOn: ['vault', 'courier'], factoryFn: 'defineGatehouse' },
  courier: { pkg: '@towerjs/courier', dependsOn: [], factoryFn: 'defineCourier' },
}

// Function-based import to keep the CLI from eagerly loading
// server-only transitive deps (pg, nodemailer, etc.).
export const importModule = Function('f', 'return import(f)') as (f: string) => Promise<any>

function createModuleFactory(name: string, enabled?: ReadonlySet<string>): ModuleFactoryFn {
  const def = MODULE_DEFS[name]
  if (!def) return undefined as unknown as ModuleFactoryFn
  return (options: Record<string, unknown>): TowerModule => ({
    name,
    dependsOn: def.dependsOn.filter((dependency) => !enabled || enabled.has(dependency)),
    async initialize(ctx: TowerContext) {
      const mod = await importModule(def.pkg)
      const factory = mod[def.factoryFn]
      const real = factory(options)
      if (typeof real.register === 'function') real.register(ctx)
      if (typeof real.initialize === 'function') await real.initialize(ctx)
    },
  })
}

export function getModuleFactory(name: string, enabled?: ReadonlySet<string>) {
  return createModuleFactory(name, enabled)
}
