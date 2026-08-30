import type { TowerModule } from '@towerjs/tower/foundation'

/**
 * Validates the explicit module definitions loaded from tower.config.ts.
 *
 * Scribe consumes the same application blueprint as the runtime. It does not
 * maintain a module-name registry or translate legacy configuration shapes.
 */
export function createModuleDefinitions(modules: unknown): TowerModule[] {
  if (!Array.isArray(modules)) {
    throw new Error(
      'tower.config.ts must define modules as an array, for example modules: [vault(), gatehouse({ ... })].'
    )
  }

  for (const moduleDefinition of modules) {
    if (
      !moduleDefinition ||
      typeof moduleDefinition !== 'object' ||
      typeof (moduleDefinition as { name?: unknown }).name !== 'string'
    ) {
      throw new Error('tower.config.ts contains an invalid module definition. Use the callable module exports.')
    }
  }

  return modules as TowerModule[]
}
