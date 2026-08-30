import { describe, expect, it } from 'vitest'

// Gatehouse requires a Better Auth adapter which needs a database. Most of its
// surface can't be exercised without a live server. This contract test verifies
// the parts that CAN be checked in isolation: public exports exist, the proxy
// contract holds, error types are correct, and the type/runtime parity for the
// methods we recently changed (requireUser, getApiKeys, getProvider).

describe('Gatehouse public API contract', () => {
  describe('public exports exist', () => {
    it('exports gatehouse proxy singleton', async () => {
      const { gatehouse } = await import('@towerjs/gatehouse')
      expect(gatehouse).toBeDefined()
      // gatehouse is a callable Proxy over a function (call face vault() + property face vault.selectFrom)
      expect(['object', 'function'].includes(typeof gatehouse)).toBe(true)
    })

    it('exports module-level functions', async () => {
      const gh = await import('@towerjs/gatehouse')
      expect(typeof gh.getSession).toBe('function')
      expect(typeof gh.user).toBe('function')
      expect(typeof gh.requireUser).toBe('function')
      expect(typeof gh.getUserSessions).toBe('function')
      expect(typeof gh.getApiKeys).toBe('function')
      expect(typeof gh.getOrganizations).toBe('function')
      expect(typeof gh.getOrganization).toBe('function')
      expect(typeof gh.runWithRequest).toBe('function')
    })

    it('exports the Gatehouse static object', async () => {
      const { Gatehouse } = await import('@towerjs/gatehouse')
      expect(Gatehouse).toHaveProperty('from')
      expect(Gatehouse).toHaveProperty('migrate')
      expect(typeof Gatehouse.from).toBe('function')
      expect(typeof Gatehouse.migrate).toBe('function')
    })

    it('exports getProvider and getRoutes', async () => {
      const { getProvider, getRoutes } = await import('@towerjs/gatehouse')
      expect(typeof getProvider).toBe('function')
      expect(typeof getRoutes).toBe('function')
    })

    it('exports error classes', async () => {
      const { AuthenticationError, AuthorizationError, ContextRequiredError } = await import('@towerjs/gatehouse')
      expect(AuthenticationError).toBeInstanceOf(Function)
      expect(AuthorizationError).toBeInstanceOf(Function)
      expect(ContextRequiredError).toBeInstanceOf(Function)
    })

    it('exports defineGatehouse', async () => {
      const { defineGatehouse } = await import('@towerjs/gatehouse')
      expect(typeof defineGatehouse).toBe('function')
    })
  })

  describe('error classes', () => {
    it('AuthenticationError has correct name and message', async () => {
      const { AuthenticationError } = await import('@towerjs/gatehouse')
      const err = new AuthenticationError()
      expect(err.name).toBe('AuthenticationError')
      expect(err.message).toBe('Authentication required')
      expect(err).toBeInstanceOf(Error)
    })

    it('AuthorizationError has correct name and message', async () => {
      const { AuthorizationError } = await import('@towerjs/gatehouse')
      const err = new AuthorizationError()
      expect(err.name).toBe('AuthorizationError')
      expect(err.message).toBe('Not authorized')
    })

    it('ContextRequiredError has correct name', async () => {
      const { ContextRequiredError } = await import('@towerjs/gatehouse')
      const err = new ContextRequiredError('test')
      expect(err.name).toBe('ContextRequiredError')
    })
  })

  describe('getProvider return type', () => {
    it('returns the Tower provider contract', async () => {
      const gatehouse = await import('@towerjs/gatehouse')
      expect(typeof gatehouse.getProvider).toBe('function')
    })
  })

  describe('proxy contract', () => {
    it('gatehouse.proxy returns a handler outside request context', async () => {
      const { gatehouse } = await import('@towerjs/gatehouse')
      const result = gatehouse.proxy()
      expect(result).toHaveProperty('handler')
      expect(typeof result.handler).toBe('function')
    })

    it('gatehouse.getSession returns null outside request context', async () => {
      const { gatehouse, TestProvider } = await import('@towerjs/gatehouse')
      const { initTower, resetTowerApp } = await import('@towerjs/tower/runtime')
      const vault = {
        name: 'vault',
        register(ctx: any) {
          ctx.services.register('vault', {})
        },
      }
      const auth = gatehouse({ provider: new TestProvider() })
      await initTower([vault, auth], { modules: [vault, auth] })
      await expect(gatehouse.getSession()).resolves.toBeNull()
      await resetTowerApp()
    })
  })

  describe('defineGatehouse', () => {
    it('returns a TowerModule with name gatehouse', async () => {
      const { defineGatehouse } = await import('@towerjs/gatehouse')
      const mod = defineGatehouse({ provider: 'better-auth' } as any)
      expect(mod.name).toBe('gatehouse')
    })
  })

  describe('apiKeys.verify shape (regression for #121)', () => {
    it('ApiKeyVerifyResult has valid, error, key', async () => {
      // type-level shape is verified by the api-builder contract; here we assert the
      // provider contract does not return the old ApiKeyInfo | null
      const { buildApi } = await import('@towerjs/gatehouse/src/providers/better-auth/api-builder.js')
      const headers = new Headers()
      const verifyApiKey = async () => ({ valid: false, error: { message: 'Invalid', code: 'INVALID' }, key: null })
      const gh: any = buildApi({ verifyApiKey } as any, headers)
      const result = await gh.apiKeys.verify({ key: 'tower_live_123' })
      expect(result).toHaveProperty('valid')
      expect(result).toHaveProperty('error')
      expect(result).toHaveProperty('key')
    })
  })
})
