import { describe, expect, it } from 'vitest'

describe('Edge public API contract', () => {
  describe('public exports exist', () => {
    it('exports withTowerEdge helper', async () => {
      const { withTowerEdge } = await import('@towerjs/edge')
      expect(typeof withTowerEdge).toBe('function')
    })

    it('withTowerEdge wraps a next config', async () => {
      const { withTowerEdge } = await import('@towerjs/edge')
      const cfg: any = { experimental: {} }
      const wrapped = withTowerEdge(cfg)
      expect(wrapped).toBeDefined()
    })
  })
})
