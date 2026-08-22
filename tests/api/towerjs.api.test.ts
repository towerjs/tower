import { registerConfigProvider } from '@towerjs/tower'

import { describe, expect, it } from 'vitest'

// Register a config provider BEFORE any @towerjs/tower access to avoid the
// tower.config.ts discovery that fails in the test environment.
registerConfigProvider(async () => ({ modules: [] as any }))

describe('Towerjs meta-package public API contract', () => {
  describe('main entry exports', () => {
    it('exports getTowerApp and initTower', async () => {
      const { getTowerApp, initTower } = await import('@towerjs/tower/runtime')
      expect(typeof getTowerApp).toBe('function')
      expect(typeof initTower).toBe('function')
    })

    it('exports createTower and createTowerApp from foundation', async () => {
      const { createTower, createTowerApp } = await import('@towerjs/tower/foundation')
      expect(typeof createTower).toBe('function')
      expect(typeof createTowerApp).toBe('function')
    })

    it('exports defineTower from blueprint', async () => {
      const { defineTower } = await import('@towerjs/tower/blueprint')
      expect(typeof defineTower).toBe('function')
    })
  })

  describe('getTowerApp contract', () => {
    it('returns a promise', async () => {
      const { getTowerApp } = await import('@towerjs/tower/runtime')
      const result = getTowerApp()
      expect(result).toBeInstanceOf(Promise)
      await result
    })

    it('returns the same promise on repeated calls (singleton)', async () => {
      const { getTowerApp } = await import('@towerjs/tower/runtime')
      const a = getTowerApp()
      const b = getTowerApp()
      expect(a).toBe(b)
      await a
    })

    it('returns a TowerApp with config, container, runtime, shutdown', async () => {
      const { getTowerApp } = await import('@towerjs/tower/runtime')
      const app = await getTowerApp()
      expect(app).toHaveProperty('config')
      expect(app).toHaveProperty('container')
      expect(app).toHaveProperty('runtime')
      expect(app).toHaveProperty('shutdown')
    })
  })
})
