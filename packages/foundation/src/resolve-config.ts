import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { TowerBlueprint } from '@towerjs/blueprint'

export async function resolveConfig(): Promise<TowerBlueprint> {
  // 1. Generated Scribe bridge or package.json imports
  try {
    const load = Function('return import("#tower-config")') as () => Promise<{ default: TowerBlueprint }>
    const mod = await load()
    if (mod?.default) return mod.default
  } catch {}

  // 2. Environment variable
  if (process.env.TOWER_CONFIG_PATH) {
    try {
      const load = Function('return import("' + process.env.TOWER_CONFIG_PATH + '")') as () => Promise<{
        default: TowerBlueprint
      }>
      const mod = await load()
      if (mod?.default) return mod.default
    } catch {}
  }

  // 3. Filesystem discovery (Node.js fallback)
  return discoverConfig()
}

async function discoverConfig(): Promise<TowerBlueprint> {
  let dir = process.cwd()
  for (let i = 0; i < 20; i++) {
    for (const name of ['tower.config.ts', 'tower.config.js', 'tower.config.mjs']) {
      const fullPath = join(dir, name)
      if (existsSync(fullPath)) {
        const mod = await import(pathToFileURL(fullPath).href)
        return mod.default ?? mod
      }
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(
    'Could not find tower.config.ts.\n' +
      'Ensure the file exists in your project root, ' +
      'or pass an explicit config to initTower(config).'
  )
}
