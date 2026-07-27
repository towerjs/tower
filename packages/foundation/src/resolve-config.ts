import type { TowerConfig } from './types.js'

type ConfigProvider = () => Promise<TowerConfig | undefined>

const configProviders: ConfigProvider[] = []

export function registerConfigProvider(provider: ConfigProvider): void {
  configProviders.push(provider)
}

const CONFIG_NAMES = ['tower.config.ts', 'tower.config.js', 'tower.config.mjs', 'tower.config.mts']

export async function resolveConfig(): Promise<TowerConfig> {
  for (const provider of configProviders) {
    try {
      const config = await provider()
      if (config) return config
    } catch {}
  }

  if (process.env.TOWER_CONFIG_PATH) {
    try {
      const url = process.env.TOWER_CONFIG_PATH
      const mod = (await Function('return import("' + url + '")')()) as { default: TowerConfig }
      if (mod?.default) return mod.default
    } catch {}
  }

  return discoverConfig()
}

async function discoverConfig(): Promise<TowerConfig> {
  let existsSync: (path: string) => boolean
  let join: (...paths: string[]) => string
  let dirname: (path: string) => string
  try {
    ;[{ existsSync }, { join, dirname }] = await Promise.all([
      import('node:fs').then((m) => ({
        existsSync: m.existsSync,
      })),
      import('node:path').then((m) => ({
        join: m.join,
        dirname: m.dirname,
      })),
    ])
  } catch {
    throw new Error(
      'Could not find tower.config.\n' +
        'On Edge Runtime, pass an explicit config to initTower(config), ' +
        'or use create-tower to set up automatic config discovery.'
    )
  }
  let dir = process.cwd()
  for (let i = 0; i < 20; i++) {
    for (const name of CONFIG_NAMES) {
      const fullPath = join(dir, name)
      if (existsSync(fullPath)) {
        const load = Function('f', 'return import(f)') as (f: string) => Promise<{ default: TowerConfig }>
        const mod = await load(fullPath)
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
