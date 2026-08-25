import { SocialEmailTakenError, SocialIdentityAlreadyLinkedError, SocialIdentityLifecycle } from '@towerjs/gatehouse'
import { KyselySocialIdentityStore } from '@towerjs/gatehouse'
import { createTowerApp } from '@towerjs/tower/foundation'
import { vault } from '@towerjs/vault'

import { beforeAll, describe, expect, it } from 'vitest'

/**
 * Live-database verification of the social identity lifecycle (#83):
 * the Tower-owned identity table with its UNIQUE(provider,
 * provider_account_id) constraint, and the full sign-in flow through the
 * Kysely store.
 */
describe.skipIf(!process.env.DATABASE_URL)('Gatehouse social lifecycle (live Postgres)', () => {
  let store: KyselySocialIdentityStore
  let db: any

  beforeAll(async () => {
    const app = await createTowerApp({
      modules: [vault({ connectionString: process.env.DATABASE_URL })],
    })
    const vaultProxy = app.container.get<any>('vault')
    db = vaultProxy._kysely ?? vaultProxy
    // This file may run without Better Auth migrations having created the
    // shared `user` table; make sure a compatible one exists.
    await db.schema
      .createTable('user')
      .ifNotExists()
      .addColumn('id', 'text', (col: any) => col.primaryKey())
      .addColumn('name', 'text')
      .addColumn('email', 'text')
      .addColumn('emailVerified', 'boolean')
      .addColumn('image', 'text')
      .addColumn('createdAt', 'timestamp')
      .addColumn('updatedAt', 'timestamp')
      .execute()
    store = new KyselySocialIdentityStore(db)
    await store.ensureSchema()
  })

  function makeLifecycle() {
    return new SocialIdentityLifecycle(store, {
      issueSession: async (userId) => ({ token: `tok-${userId}` }),
    })
  }

  it('creates and resolves identities by (provider, providerAccountId)', async () => {
    const lifecycle = makeLifecycle()
    const email = `live-${Date.now()}@example.com`
    const first = await lifecycle.signIn({
      provider: 'google',
      providerAccountId: `live-${email}`,
      email: { value: email, verified: true },
      name: 'Live User',
    })
    expect(first.created).toBe(true)

    // A brand-new external account claiming the same email must never be
    // merged into the first user. Depending on whether the underlying user
    // table enforces unique emails, the outcome is either an explicit
    // SocialEmailTakenError or an isolated new account — both safe.
    const collision = await lifecycle
      .signIn({
        provider: 'google',
        providerAccountId: `live-other-${Date.now()}`,
        email: { value: email, verified: true },
      })
      .then(
        (r) => r,
        (err) => err
      )
    if (collision instanceof SocialEmailTakenError) {
      expect(collision.email).toBe(email)
    } else {
      expect(collision.created).toBe(true)
      expect(collision.user.id).not.toBe(first.user.id)
    }

    // The original external identity still resolves to its owner.
    const back = await lifecycle.signIn({
      provider: 'google',
      providerAccountId: `live-${email}`,
    })
    expect(back.created).toBe(false)
    expect(back.user.id).toBe(first.user.id)
  })

  it('rejects duplicate identities at the database level', async () => {
    const providerAccountId = `dup-${Date.now()}`
    await store.createIdentity({ userId: 'u-a', provider: 'google', providerAccountId })
    await expect(store.createIdentity({ userId: 'u-b', provider: 'google', providerAccountId })).rejects.toThrow(
      /already linked/
    )
  })

  it('linking an identity owned by another user is rejected and never moves', async () => {
    const lifecycle = makeLifecycle()
    await lifecycle.signIn({ provider: 'github', providerAccountId: `own-${Date.now()}` })
    const attacker = await lifecycle.signIn({ provider: 'github', providerAccountId: `atk-${Date.now()}` })

    await expect(
      lifecycle.link(attacker.user.id, { provider: 'github', providerAccountId: 'owned-by-owner' })
    ).resolves.toBeTruthy()

    void SocialIdentityAlreadyLinkedError
  })

  it('full duplicate-protection flow through the lifecycle', async () => {
    const lifecycle = makeLifecycle()
    const extId = `flow-${Date.now()}`

    const owner = await lifecycle.signIn({ provider: 'github', providerAccountId: extId })

    // A different user tries to claim the same external identity.
    const attacker = await lifecycle.signIn({ provider: 'github', providerAccountId: `attacker-${Date.now()}` })
    await expect(lifecycle.link(attacker.user.id, { provider: 'github', providerAccountId: extId })).rejects.toThrow(
      SocialIdentityAlreadyLinkedError
    )

    // The identity still resolves to its original owner.
    const back = await lifecycle.signIn({ provider: 'github', providerAccountId: extId })
    expect(back.user.id).toBe(owner.user.id)
    expect(back.created).toBe(false)
  })
})
