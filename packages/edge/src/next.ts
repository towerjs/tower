import { existsSync } from 'node:fs'
import { relative, resolve } from 'node:path'

import type { NextConfig } from 'next'

const CONFIG_NAMES = ['tower.config.ts', 'tower.config.js', 'tower.config.mjs', 'tower.config.mts']

function findConfig(cwd: string): string | undefined {
  for (const name of CONFIG_NAMES) {
    const full = resolve(cwd, name)
    if (existsSync(full)) return full
  }
  return undefined
}

export interface TowerEdgeOptions {
  root?: string
}

/**
 * Next.js config wrapper for Edge Runtime support.
 *
 * Bundles the tower config file so that Tower can discover it
 * in environments without filesystem access (Edge Runtime, etc.).
 *
 * @example
 * ```ts
 * // next.config.ts
 * import { withTowerEdge } from "@towerjs/edge"
 *
 * export default withTowerEdge({})
 * ```
 */
export function withTowerEdge(nextConfig: NextConfig = {}, options: TowerEdgeOptions = {}): NextConfig {
  const root = options.root ?? process.cwd()
  const configPath = findConfig(root)

  if (!configPath) {
    console.warn('[tower] Could not find tower.config in', root, '— Edge config resolution will not be available.')
    return nextConfig
  }

  const relativePath = relative(root, configPath)

  return {
    ...nextConfig,
    webpack(config, context) {
      if (context.isServer) {
        config.resolve = config.resolve ?? {}
        config.resolve.alias = config.resolve.alias ?? {}
        config.resolve.alias['@towerjs/edge/config'] = configPath
      }

      if (typeof nextConfig.webpack === 'function') {
        return nextConfig.webpack(config, context)
      }

      return config
    },
    turbopack: {
      ...(nextConfig as any).turbopack,
      resolveAlias: {
        ...((nextConfig as any).turbopack as any)?.resolveAlias,
        '@towerjs/edge/config': './' + relativePath,
      },
    },
  }
}
