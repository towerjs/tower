import type { TowerBlueprint } from '@towerjs/blueprint'

// Register a config provider for environments (Edge Runtime, etc.) where
// filesystem discovery is unavailable. The provider defers to the bundled
// alias set up by withTowerEdge().
//
// Foundation is imported dynamically to avoid pulling its top-level await
// (from towerContext) into the next.config.ts CJS-compatible evaluation.
Promise.resolve().then(async () => {
  const { registerConfigProvider } = await import('@towerjs/foundation')
  registerConfigProvider(async () => {
    try {
      const load = Function('return import("@towerjs/edge/config")') as () => Promise<{
        default: TowerBlueprint
      }>
      const mod = await load()
      return mod?.default as TowerBlueprint | undefined
    } catch {
      return undefined
    }
  })
})

export { withTowerEdge } from './next.js'
