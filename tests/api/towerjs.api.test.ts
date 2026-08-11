import { describe, it, expect } from 'vitest'
import { registerConfigProvider } from '@towerjs/foundation'

// Register a config provider BEFORE the towerjs module auto-initializes on import.
// This avoids the tower.config.ts discovery that fails in the test environment.
registerConfigProvider(async () => ({ modules: {} }))

describe('Towerjs meta-package public API contract', () => {
  describe('main entry exports', () => {
    it('exports tower lazy proxy', async () => {
      const { tower } = await import('towerjs')
      expect(tower).toBeDefined()
      expect(typeof tower).toBe('object')
    })

    it('exports getTowerApp and initTower', async () => {
      const { getTowerApp, initTower } = await import('towerjs')
      expect(typeof getTowerApp).toBe('function')
      expect(typeof initTower).toBe('function')
    })

    it('exports createTower and createTowerApp from foundation', async () => {
      const { createTower, createTowerApp } = await import('towerjs')
      expect(typeof createTower).toBe('function')
      expect(typeof createTowerApp).toBe('function')
    })

    it('exports defineTower from blueprint', async () => {
      const { defineTower } = await import('towerjs')
      expect(typeof defineTower).toBe('function')
    })
  })

  describe('tower proxy contract', () => {
    it('exposes config, container, runtime, shutdown after init', async () => {
      const { tower, getTowerApp } = await import('towerjs')
      const app = await getTowerApp()
      // The proxy delegates to the resolved app once init completes
      expect(tower.config).toBe(app.config)
      expect(tower.container).toBe(app.container)
      expect(tower.runtime).toBe(app.runtime)
      expect(typeof tower.shutdown).toBe('function')
    })

    it('resolves module services as top-level properties', async () => {
      const { tower, getTowerApp } = await import('towerjs')
      await getTowerApp()
      expect(tower.runtime).toHaveProperty('name')
    })
  })

  describe('getTowerApp contract', () => {
    it('returns a promise', async () => {
      const { getTowerApp } = await import('towerjs')
      const result = getTowerApp()
      expect(result).toBeInstanceOf(Promise)
      await result
    })

    it('returns the same promise on repeated calls (singleton)', async () => {
      const { getTowerApp } = await import('towerjs')
      const a = getTowerApp()
      const b = getTowerApp()
      expect(a).toBe(b)
      await a
    })

    it('returns a TowerApp with config, container, runtime, shutdown', async () => {
      const { getTowerApp } = await import('towerjs')
      const app = await getTowerApp()
      expect(app).toHaveProperty('config')
      expect(app).toHaveProperty('container')
      expect(app).toHaveProperty('runtime')
      expect(app).toHaveProperty('shutdown')
    })
  })
})
