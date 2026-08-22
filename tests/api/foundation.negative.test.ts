import { createTowerApp, resolveDependencyOrder } from '@towerjs/tower/foundation'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const OLD_ENV = process.env

beforeEach(() => {
  process.env = { ...OLD_ENV }
  delete process.env.VERCEL
  delete process.env.VERCEL_ENV
  delete process.env.AWS_LAMBDA_FUNCTION_NAME
  delete process.env.AWS_EXECUTION_ENV
  delete process.env.NETLIFY
  delete process.env.CLOUDFLARE_WORKER
})

afterEach(() => {
  process.env = OLD_ENV
})

describe('Foundation negative / edge cases', () => {
  describe('createTowerApp with invalid input', () => {
    it('handles empty modules config', async () => {
      const app = await createTowerApp({ modules: {} })
      expect(app).toHaveProperty('config')
      expect(app.container).toBeDefined()
    })

    it('throws when factory returns a module without a name', async () => {
      const factory = (_name: string) => ((_config: Record<string, unknown>) => ({})) as any
      await expect(createTowerApp({ modules: { foo: {} } }, factory)).rejects.toThrow(
        'returned a module without a name'
      )
    })

    it('detects missing dependencies', async () => {
      const factory = (name: string) => {
        if (name === 'gatehouse') {
          return ((_config: Record<string, unknown>) => ({
            name: 'gatehouse',
            dependsOn: ['vault', 'nonexistent'],
          })) as any
        }
        // vault has a factory, nonexistent does not
        if (name === 'vault') {
          return ((_config: Record<string, unknown>) => ({ name: 'vault' })) as any
        }
        return undefined as any
      }
      await expect(createTowerApp({ modules: { gatehouse: {} } }, factory)).rejects.toThrow('not in the modules array')
    })

    it('propagates init errors', async () => {
      const factory = (_name: string) =>
        ((_config: Record<string, unknown>) => ({
          name: 'exploder',
          async initialize() {
            throw new Error('init failed')
          },
        })) as any
      await expect(createTowerApp({ modules: { exploder: {} } }, factory)).rejects.toThrow('init failed')
    })
  })

  describe('resolveDependencyOrder', () => {
    it('returns valid for independent modules', () => {
      const result = resolveDependencyOrder([
        { name: 'a', dependsOn: [] },
        { name: 'b', dependsOn: [] },
      ])
      expect(result.valid).toBe(true)
      expect(result.order).toContain('a')
      expect(result.order).toContain('b')
    })

    it('detects circular dependencies', () => {
      const result = resolveDependencyOrder([
        { name: 'a', dependsOn: ['b'] },
        { name: 'b', dependsOn: ['a'] },
      ])
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('detects duplicate module names', () => {
      const result = resolveDependencyOrder([{ name: 'a' }, { name: 'a' }])
      expect(result.valid).toBe(false)
    })

    it('orders dependencies before dependents', () => {
      const result = resolveDependencyOrder([
        { name: 'gatehouse', dependsOn: ['vault'] },
        { name: 'vault', dependsOn: [] },
      ])
      expect(result.valid).toBe(true)
      const gatehouseIdx = result.order.indexOf('gatehouse')
      const vaultIdx = result.order.indexOf('vault')
      expect(vaultIdx).toBeLessThan(gatehouseIdx)
    })
  })

  describe('config resolution', () => {
    it('resolveConfig throws with a helpful message when no config found', async () => {
      // Ensure no config providers and no TOWER_CONFIG_PATH
      delete process.env.TOWER_CONFIG_PATH
      const { resolveConfig } = await import('@towerjs/tower/foundation')
      await expect(resolveConfig()).rejects.toThrow('Could not find tower.config.ts')
    })
  })
})
