import { betterAuthProvider, defineGatehouseProviderContract } from '@towerjs/gatehouse'
import type { GatehouseProvider } from '@towerjs/gatehouse'
import { createTowerApp } from '@towerjs/tower/foundation'
import { vault } from '@towerjs/vault'

import { describe, expect, it } from 'vitest'

/**
 * Runs the shared Gatehouse provider contract suite against the real
 * Better Auth adapter on a live Postgres database.
 *
 * Authenticated request-scoped specs are disabled here: Better Auth's
 * session cookies are set through framework response machinery that raw
 * test headers can't reproduce. Those flows are covered by E2E tests
 * driving a real browser.
 */
describe.skipIf(!process.env.DATABASE_URL)('Better Auth adapter', () => {
  let booted = false

  defineGatehouseProviderContract({
    label: 'BetterAuthAdapter (live Postgres)',
    supportsAuthenticatedSpecs: false,

    async createProvider(): Promise<GatehouseProvider> {
      const app = await createTowerApp({
        modules: [vault({ connectionString: process.env.DATABASE_URL })],
      })
      const vaultProxy = app.container.get<any>('vault')
      const db = vaultProxy._kysely ?? vaultProxy

      const adapter = await betterAuthProvider(
        {
          provider: 'better-auth',
          appName: 'Tower Contract Test',
          baseURL: 'http://localhost:3000',
          secret: 'dev-secret-do-not-use-in-production-at-least-32-chars',
          credentials: { enabled: true },
        },
        db
      )

      // The suite's first spec calls init() — do the full boot (including
      // migrations) once and make that call idempotent.
      if (!booted) {
        await adapter.init()
        try {
          await adapter.migrate()
        } catch (err) {
          // Integration files may run migrations concurrently; duplicate-table
          // races mean another file already set the schema up.
          if (!/duplicate key|already exists/i.test(String(err))) throw err
        }
        booted = true
      }

      return {
        get name() {
          return adapter.name
        },
        get capabilities() {
          return adapter.capabilities
        },
        init: async () => {},
        migrate: () => adapter.migrate(),
        getSession: (r) => adapter.getSession(r),
        requireAuth: (r) => adapter.requireAuth(r),
        from: (r) => adapter.from(r),
      }
    },

    authHeaders(_token: string) {
      return new Headers()
    },
  })

  it('declares itself Node-only', async () => {
    const provider = await betterAuthProvider({ provider: 'better-auth' }, {})
    expect(provider.capabilities.runtime.node).toBe(true)
    expect(provider.capabilities.runtime.edge).toBe(false)
  })
})
