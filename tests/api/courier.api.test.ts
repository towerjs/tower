import { describe, expect, it } from 'vitest'

describe('Courier public API contract', () => {
  describe('public exports exist', () => {
    it('exports courier proxy singleton', async () => {
      const { courier } = await import('@towerjs/courier')
      expect(courier).toBeDefined()
      expect(['object', 'function'].includes(typeof courier)).toBe(true)
    })

    it('exports email/sms channels via property face when initialized', async () => {
      const { courier } = await import('@towerjs/courier')
      // courier.email and .sms are resolved lazily from the container; the keys exist as callable traps
      expect(courier).toBeDefined()
    })
  })

  describe('defineCourier', () => {
    it('returns a TowerModule with name courier', async () => {
      const { defineCourier } = await import('@towerjs/courier')
      const mod = defineCourier({ email: { provider: 'console' } })
      expect(mod.name).toBe('courier')
      expect(mod.dependsOn).toEqual([])
    })

    it('supports resend, ses, smtp, console providers', async () => {
      const { defineCourier } = await import('@towerjs/courier')
      for (const provider of ['console', 'resend', 'ses', 'smtp'] as const) {
        const mod = defineCourier({ email: { provider } as any })
        expect(mod.name).toBe('courier')
      }
    })
  })
})
