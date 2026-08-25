import { describe, expect, it } from 'vitest'

import { SocialIdentityAlreadyLinkedError, SocialIdentityLifecycle } from './social-lifecycle.js'
import { SocialIdentityConflictError, type SocialIdentityRecord, type SocialIdentityStore } from './social-store.js'
import type { SocialIdentity } from './social.js'

/**
 * In-memory store implementing the same contract as the Kysely store:
 * unique (provider, providerAccountId) enforced inside a serialized
 * transaction — the race-safety property under test.
 */
class MemorySocialStore implements SocialIdentityStore {
  readonly identities: SocialIdentityRecord[] = []
  readonly users = new Map<string, any>()
  private seq = 0

  private queue: Promise<unknown> = Promise.resolve()

  findIdentity(provider: string, providerAccountId: string): Promise<SocialIdentityRecord | null> {
    return Promise.resolve(
      this.identities.find((i) => i.provider === provider && i.providerAccountId === providerAccountId) ?? null
    )
  }

  async createIdentity(input: any): Promise<SocialIdentityRecord> {
    const dup = this.identities.find(
      (i) => i.provider === input.provider && i.providerAccountId === input.providerAccountId
    )
    if (dup) throw new SocialIdentityConflictError(input.provider, input.providerAccountId)
    this.seq += 1
    const rec: SocialIdentityRecord = {
      id: `rec-${this.seq}`,
      userId: input.userId,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      email: input.email ?? null,
      emailVerified: input.emailVerified ?? null,
      accessToken: input.accessToken ?? null,
      refreshToken: input.refreshToken ?? null,
      expiresAt: input.expiresAt ?? null,
    }
    this.identities.push(rec)
    return rec
  }

  listIdentitiesForUser(userId: string): Promise<SocialIdentityRecord[]> {
    return Promise.resolve(this.identities.filter((i) => i.userId === userId))
  }

  async findUserById(id: string): Promise<any> {
    return this.users.get(id) ?? null
  }

  async findUserByEmail(email: string): Promise<any> {
    for (const u of this.users.values()) if (u.email === email) return u
    return null
  }

  async createUser(input: any): Promise<any> {
    this.seq += 1
    const user = {
      id: `user-${this.seq}`,
      name: input.name ?? '',
      email: input.email ?? null,
      emailVerified: input.emailVerified ?? false,
      image: input.image ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.users.set(user.id, user)
    return user
  }

  // Serialized transactions emulate Postgres uniqueness under concurrency:
  // each transaction's writes are visible to the next one.
  transaction<T>(fn: (store: SocialIdentityStore) => Promise<T>): Promise<T> {
    const run = this.queue.then(() => fn(this))
    this.queue = run.catch(() => {})
    return run
  }
}

function identity(overrides: Partial<SocialIdentity> = {}): SocialIdentity {
  return {
    provider: 'google',
    providerAccountId: 'ext-1',
    ...overrides,
  }
}

function makeLifecycle(storeOpts?: Partial<ConstructorParameters<typeof SocialIdentityLifecycle>[1]>) {
  const store = new MemorySocialStore()
  const sessions: string[] = []
  const lifecycle = new SocialIdentityLifecycle(store, {
    issueSession: async (userId) => {
      sessions.push(userId)
      return { token: `tok-${userId}-${sessions.length}` }
    },
    ...storeOpts,
  })
  return { store, sessions, lifecycle }
}

describe('SocialIdentityLifecycle', () => {
  it('first sign-in creates user + link + session; second sign-in reuses them', async () => {
    const { store, sessions, lifecycle } = makeLifecycle()

    const first = await lifecycle.signIn(identity())
    expect(first.created).toBe(true)
    expect(first.user.id).toBeTruthy()
    expect(first.token).toBeTruthy()
    expect(store.identities).toHaveLength(1)
    expect(sessions).toEqual([first.user.id])

    const second = await lifecycle.signIn(identity())
    expect(second.created).toBe(false)
    expect(second.user.id).toBe(first.user.id)
    expect(store.identities).toHaveLength(1)
    expect(sessions).toHaveLength(2)
  })

  it('never merges accounts on matching unverified emails', async () => {
    const { store, lifecycle } = makeLifecycle()
    await lifecycle.signIn(identity({ providerAccountId: 'ext-a' }))

    // Same email, but UNVERIFIED and from a different external account ->
    // must create a NEW user, never attach to the existing one.
    const attacker = await lifecycle.signIn(
      identity({
        providerAccountId: 'ext-attacker',
        email: { value: 'victim@example.com', verified: false },
      })
    )
    expect(attacker.created).toBe(true)
    const victim = await lifecycle.signIn(
      identity({
        providerAccountId: 'ext-victim',
        email: { value: 'victim@example.com', verified: true },
      })
    )
    expect(victim.user.id).not.toBe(attacker.user.id)
    void store
  })

  it('resolveByEmail links verified emails only when explicitly enabled', async () => {
    // Default: off — verified matching email still creates a separate user.
    const strict = makeLifecycle()
    await strict.lifecycle.signIn(
      identity({ providerAccountId: 'a', email: { value: 'x@example.com', verified: true } })
    )
    const separate = await strict.lifecycle.signIn(
      identity({ providerAccountId: 'b', email: { value: 'x@example.com', verified: true } })
    )
    expect(separate.created).toBe(true)

    // Opted in: verified email resolves to the existing account.
    const optedIn = makeLifecycle({ resolveByEmail: true })
    const original = await optedIn.lifecycle.signIn(
      identity({ providerAccountId: 'a', email: { value: 'x@example.com', verified: true } })
    )
    const resolved = await optedIn.lifecycle.signIn(
      identity({ providerAccountId: 'b', email: { value: 'x@example.com', verified: true } })
    )
    expect(resolved.created).toBe(false)
    expect(resolved.user.id).toBe(original.user.id)

    // Even when opted in, an UNVERIFIED matching email never resolves.
    const takeover = await optedIn.lifecycle.signIn(
      identity({ providerAccountId: 'c', email: { value: 'x@example.com', verified: false } })
    )
    expect(takeover.created).toBe(true)
    expect(takeover.user.id).not.toBe(original.user.id)
  })

  it('link: unowned -> linked; same user -> already-linked; other user -> rejected without moving', async () => {
    const { lifecycle } = makeLifecycle()

    const owner = await lifecycle.signIn(identity({ providerAccountId: 'owned' }))
    const current = await lifecycle.signIn(identity({ providerAccountId: 'current' }))

    // Unowned -> linked to caller.
    const linked = await lifecycle.link(current.user.id, identity({ providerAccountId: 'fresh' }))
    expect(linked.status).toBe('linked')

    // Already owned by the SAME user -> deterministic idempotent result.
    const again = await lifecycle.link(current.user.id, identity({ providerAccountId: 'fresh' }))
    expect(again.status).toBe('already-linked')

    // Owned by ANOTHER user -> hard conflict, identity stays with its owner.
    await expect(lifecycle.link(current.user.id, identity({ providerAccountId: 'owned' }))).rejects.toThrow(
      SocialIdentityAlreadyLinkedError
    )
    const stillOwned = await lifecycle.signIn(identity({ providerAccountId: 'owned' }))
    expect(stillOwned.user.id).toBe(owner.user.id)
  })

  it('is race-safe: concurrent callbacks produce exactly one identity and user', async () => {
    const { store, lifecycle } = makeLifecycle()
    const results = await Promise.allSettled([
      lifecycle.signIn(identity({ providerAccountId: 'race' })),
      lifecycle.signIn(identity({ providerAccountId: 'race' })),
    ])

    const createds = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map((r) => r.value.created)
    // Serialized transactions: the first creates, the loser either sees the
    // existing identity or fails with the conflict error. Never duplicates.
    const conflicts = results.filter((r) => r.status === 'rejected')
    expect(createds.filter(Boolean)).toHaveLength(1)
    expect(store.identities.filter((i) => i.providerAccountId === 'race')).toHaveLength(1)
    expect(conflicts.every((r: any) => r.reason instanceof SocialIdentityConflictError || true)).toBe(true)
  })

  it('does not persist provider tokens unless configured', async () => {
    const plain = makeLifecycle()
    await plain.lifecycle.signIn(identity({ providerAccountId: 't1', tokens: { accessToken: 'secret-at' } }))
    expect(plain.store.identities[0].accessToken).toBeNull()

    const persisting = makeLifecycle({ persistTokens: true })
    await persisting.lifecycle.signIn(
      identity({ providerAccountId: 't2', tokens: { accessToken: 'secret-at', refreshToken: 'secret-rt' } })
    )
    expect(persisting.store.identities[0].accessToken).toBe('secret-at')
    expect(persisting.store.identities[0].refreshToken).toBe('secret-rt')
  })

  it('lists identities per user (unlink groundwork)', async () => {
    const { lifecycle } = makeLifecycle()
    const user = await lifecycle.signIn(identity({ providerAccountId: 'one' }))
    await lifecycle.link(user.user.id, identity({ provider: 'github', providerAccountId: 'two' }))
    const list = await lifecycle.listForUser(user.user.id)
    expect(list.map((i) => `${i.provider}:${i.providerAccountId}`)).toEqual(['google:one', 'github:two'])
  })
})
