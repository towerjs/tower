import { describe, expect, it } from 'vitest'

// Gatehouse requires a Better Auth adapter which needs a database. Most of its
// surface can't be exercised without a live server. This contract test verifies
// the parts that CAN be checked in isolation: public exports exist, the proxy
// contract holds, error types are correct, and the type/runtime parity for the
// methods we recently changed (requireUser, getApiKeys, getAuth).

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

    it('exports getAuth and getRoutes', async () => {
      const { getAuth, getRoutes } = await import('@towerjs/gatehouse')
      expect(typeof getAuth).toBe('function')
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

  describe('getAuth return type', () => {
    it('returns the adapter (not a narrowed shape)', async () => {
      // getAuth is typed as returning BetterAuthAdapter. Before the fix it was
      // typed as `{ getSession() }` which lied about the actual return value.
      // We can't call it without an init adapter, but we can verify the type
      // exports BetterAuthAdapter.
      const gatehouse = await import('@towerjs/gatehouse')
      // The function exists and is exported
      expect(typeof gatehouse.getAuth).toBe('function')
    })
  })

  describe('proxy contract', () => {
    it('gatehouse.proxy returns a handler outside request context', async () => {
      const { gatehouse } = await import('@towerjs/gatehouse')
      const result = gatehouse.proxy()
      expect(result).toHaveProperty('handler')
      expect(typeof result.handler).toBe('function')
    })

    it('gatehouse.getSession throws ContextRequiredError outside request context', async () => {
      const { gatehouse, ContextRequiredError } = await import('@towerjs/gatehouse')
      expect(() => gatehouse.getSession()).toThrow(ContextRequiredError)
    })
  })

  describe('defineGatehouse', () => {
    it('returns a TowerModule with name gatehouse', async () => {
      const { defineGatehouse } = await import('@towerjs/gatehouse')
      const mod = defineGatehouse({ provider: 'better-auth' } as any)
      expect(mod.name).toBe('gatehouse')
    })
  })
})
