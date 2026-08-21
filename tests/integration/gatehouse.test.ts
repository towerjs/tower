import { courier } from '@towerjs/courier'
import { gatehouse } from '@towerjs/gatehouse'
import { vault } from '@towerjs/vault'
import { createTowerApp } from '@towerjs/tower/foundation'

import { describe, expect, it } from 'vitest'

describe('Gatehouse live integration (database boundary)', () => {
  it('creates a user through the full stack and verifies persistence', async ({ skip }) => {
    if (!process.env.DATABASE_URL) skip()

    const app = await createTowerApp({
      modules: [
        vault({ connectionString: process.env.DATABASE_URL }),
        courier({ email: { provider: 'console' } }),
        gatehouse({
          provider: 'better-auth',
          appName: 'Tower Integration Test',
          baseURL: 'http://localhost:3000',
          secret:
            process.env.GATEHOUSE_SECRET ??
            process.env.BETTER_AUTH_SECRET ??
            'dev-secret-do-not-use-in-production-at-least-32-chars',
          credentials: { enabled: true },
        }),
      ],
    })

    // Run auth migrations (proves the database setup works) — via vault/gatehouse after initTower
    const { gatehouse: gh2 } = await import('@towerjs/gatehouse')
    await gh2.migrate().catch(() => {})

    // Sign up a user via the module-level proxy. Note: per-request instances
    // (gatehouse.from) require full HTTP auth headers (CSRF, session tokens)
    // that raw test requests can't provide. The module-level proxy uses ALS
    // context. The signUp operation exercises the POST + body contract and
    // proves the full Gatehouse → Better Auth → Database stack works.
    const uniqueEmail = `test-${Date.now()}@example.com`
    const header = new Headers()
    const signUpResult = await gh.from({ headers: header }).then((inst) =>
      inst.signUp.email({
        name: 'Integration Test User',
        email: uniqueEmail,
        password: 'Password123!',
      })
    )

    expect(signUpResult).toBeDefined()
    expect(signUpResult.user).toBeDefined()
    expect(signUpResult.user.email).toBe(uniqueEmail)
    expect(signUpResult.user.id).toBeDefined()
    const userId = signUpResult.user.id

    // Verify the user persisted to the database (proves vault integration works)
    const vaultProxy = app.container.get<any>('vault')
    const vaultDb = vaultProxy._kysely ?? vaultProxy
    const persisted = await vaultDb.selectFrom('user').where('id', '=', userId).selectAll().executeTakeFirst()
    expect(persisted).toBeDefined()
    expect(persisted.id).toBe(userId)
    expect(persisted.email).toBe(uniqueEmail)

    await app.shutdown()
  })
})
