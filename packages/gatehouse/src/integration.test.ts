import { describe, it, expect } from 'vitest'
import { getModuleFactory } from '@towerjs/blueprint'
import { createTowerApp } from '@towerjs/foundation'
import type { Vault } from '@towerjs/vault'
// Register modules so getModuleFactory resolves them
import '@towerjs/vault'
import '@towerjs/gatehouse'
import '@towerjs/courier'

describe('Gatehouse live integration (database boundary)', () => {
  it('creates a user through the full stack and verifies persistence', async ({ skip }) => {
    if (!process.env.DATABASE_URL) skip()

    const app = await createTowerApp(
      {
        modules: {
          vault: { connectionString: process.env.DATABASE_URL },
          gatehouse: {
            provider: 'better-auth',
            appName: 'Tower Integration Test',
            baseURL: 'http://localhost:3000',
            secret:
              process.env.GATEHOUSE_SECRET ??
              process.env.BETTER_AUTH_SECRET ??
              'dev-secret-do-not-use-in-production-at-least-32-chars',
            credentials: { enabled: true },
          },
        },
      },
      getModuleFactory
    )

    // Run auth migrations (proves the database setup works)
    const { gatehouse } = await import('@towerjs/gatehouse')
    await gatehouse.migrate()

    // Sign up a user via the module-level proxy. Note: per-request instances
    // (gatehouse.from) require full HTTP auth headers (CSRF, session tokens)
    // that raw test requests can't provide. The module-level proxy uses ALS
    // context. The signUp operation exercises the POST + body contract and
    // proves the full Gatehouse → Better Auth → Database stack works.
    const uniqueEmail = `test-${Date.now()}@example.com`
    const header = new Headers()
    const signUpResult = await gatehouse.from({ headers: header }).then((gh) =>
      gh.signUp.email({
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
    const vault = app.container.get<Vault>('vault')
    const persisted = await (vault as any)
      .db.selectFrom('user')
      .where('id', '=', userId)
      .selectAll()
      .executeTakeFirst()
    expect(persisted).toBeDefined()
    expect(persisted.id).toBe(userId)
    expect(persisted.email).toBe(uniqueEmail)

    await app.shutdown()
  })
})
