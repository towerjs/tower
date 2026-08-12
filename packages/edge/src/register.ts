import type { TowerBlueprint } from '@towerjs/blueprint'

export async function registerEdgeConfigProvider(): Promise<void> {
  let registerConfigProvider: ((provider: () => Promise<TowerBlueprint | undefined>) => void) | undefined
  try {
    const loadFoundation = Function('return import("@towerjs/foundation")') as () => Promise<{
      registerConfigProvider?: (provider: () => Promise<TowerBlueprint | undefined>) => void
    }>
    const foundation = await loadFoundation()
    registerConfigProvider = foundation.registerConfigProvider
  } catch {
    return
  }
  if (!registerConfigProvider) return
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
}
