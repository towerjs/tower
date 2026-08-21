import type { TowerBlueprint } from '@towerjs/tower/blueprint'
import { registerConfigProvider } from '@towerjs/tower/foundation'

let _registered = false

/**
 * Self-registers the edge config provider when this module is imported.
 * This replaces the old pattern where tower runtime force-registered edge.
 */
export async function registerEdgeConfigProvider(): Promise<void> {
  if (_registered) return
  _registered = true

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

// Self-register on import (lazy, no top-level await)
let _initPromise: Promise<void> | null = null
export function ensureEdgeRegistered(): Promise<void> {
  if (!_initPromise) {
    _initPromise = registerEdgeConfigProvider()
  }
  return _initPromise
}

// Kick off registration without awaiting
ensureEdgeRegistered()
