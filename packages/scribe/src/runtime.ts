import type { CourierConfig } from '@towerjs/courier'
import type { GatehouseConfig } from '@towerjs/gatehouse'
import type { TowerModule } from '@towerjs/tower/foundation'
import type { VaultConfig } from '@towerjs/vault'

/**
 * Scribe uses the new callable module exports to create module definitions.
 * Each module package exports a callable that returns a ModuleDefinition when called with config.
 */

type ModuleConfigInput = Record<string, Record<string, unknown>> | TowerModule[]

function isModuleArray(modules: ModuleConfigInput): modules is TowerModule[] {
  return Array.isArray(modules)
}

function moduleArrayToObject(modules: TowerModule[]): Record<string, Record<string, unknown>> {
  const obj: Record<string, Record<string, unknown>> = {}
  for (const mod of modules) {
    // For module definitions created by callable exports, we don't have the original config
    // So we use an empty object - the module definition already has its config baked in
    obj[mod.name] = {}
  }
  return obj
}

export async function createModuleDefinitions(modules: ModuleConfigInput): Promise<TowerModule[]> {
  if (isModuleArray(modules)) {
    // New array form — check if already TowerModule definitions (have initialize) or plain configs from jiti mock
    const first = (modules as unknown as any[])[0]
    if (first && typeof first.name === 'string' && typeof first.initialize === 'function') {
      return modules as TowerModule[]
    }
    // Plain array from jiti mock (e.g. [{ name: 'vault' }, { name: 'gatehouse', provider: 'better-auth' }])
    // Convert via the same switch as object form
    const defs: TowerModule[] = []
    for (const mod of modules as unknown as Array<Record<string, unknown>>) {
      const { name, ...opts } = mod as any
      let modDef: TowerModule | undefined
      switch (name) {
        case 'vault': {
          const { vault } = await import('@towerjs/vault')
          modDef = vault(opts as unknown as VaultConfig)
          break
        }
        case 'gatehouse': {
          const { gatehouse } = await import('@towerjs/gatehouse')
          modDef = gatehouse(opts as unknown as GatehouseConfig)
          break
        }
        case 'courier': {
          const { courier } = await import('@towerjs/courier')
          modDef = courier(opts as unknown as CourierConfig)
          break
        }
        default:
          throw new Error(`Unknown module "${name}". Available: vault, gatehouse, courier`)
      }
      if (modDef) defs.push(modDef)
    }
    return defs
  }

  const moduleObj = modules as Record<string, Record<string, unknown>>

  const defs: TowerModule[] = []

  for (const [name, options] of Object.entries(moduleObj)) {
    let modDef: TowerModule | undefined

    switch (name) {
      case 'vault': {
        const { vault } = await import('@towerjs/vault')
        modDef = vault(options as unknown as VaultConfig)
        break
      }
      case 'gatehouse': {
        const { gatehouse } = await import('@towerjs/gatehouse')
        modDef = gatehouse(options as unknown as GatehouseConfig)
        break
      }
      case 'courier': {
        const { courier } = await import('@towerjs/courier')
        modDef = courier(options as unknown as CourierConfig)
        break
      }
      default:
        throw new Error(`Unknown module "${name}". Available: vault, gatehouse, courier`)
    }

    if (!modDef) {
      throw new Error(`Module "${name}" did not return a valid definition`)
    }

    defs.push(modDef)
  }

  return defs
}
