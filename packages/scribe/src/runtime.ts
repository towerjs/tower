import type { TowerModule } from '@towerjs/tower/foundation'
import type { VaultConfig } from '@towerjs/vault'
import type { GatehouseConfig } from '@towerjs/gatehouse'
import type { CourierConfig } from '@towerjs/courier'

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

export async function createModuleDefinitions(
  modules: ModuleConfigInput
): Promise<TowerModule[]> {
  // Convert array format to object format for backwards compatibility
  const moduleObj = isModuleArray(modules) ? moduleArrayToObject(modules) : modules
  
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