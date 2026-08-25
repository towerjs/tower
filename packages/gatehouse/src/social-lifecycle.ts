import { SocialIdentityConflictError, type SocialIdentityRecord, type SocialIdentityStore } from './social-store.js'
import type { SocialIdentity } from './social.js'
import type { SignInResult } from './types.js'
import { AuthenticationError } from './types.js'

/**
 * Thrown when linking a social identity that already belongs to a
 * *different* Tower user. The identity is NEVER moved and accounts are
 * NEVER merged — matching emails are not ownership.
 */
export class SocialIdentityAlreadyLinkedError extends Error {
  readonly provider: string
  readonly providerAccountId: string

  constructor(provider: string, providerAccountId: string) {
    super(
      `This ${provider} account is already linked to another user. ` +
        `Sign in with it first, or remove the existing link.`
    )
    this.name = 'SocialIdentityAlreadyLinkedError'
    this.provider = provider
    this.providerAccountId = providerAccountId
  }
}

export interface SocialSignInResult extends SignInResult {
  /** True when this sign-in created the Tower user (first sign-in). */
  created: boolean
}

export interface LinkResult {
  status: 'linked' | 'already-linked'
  identity: SocialIdentityRecord
}

/** Sensitive tokens are persisted only when explicitly requested. */
export interface PersistTokensOption {
  persistTokens?: boolean
}

/**
 * Gatehouse-owned social identity lifecycle (#83).
 *
 *   social provider -> normalized SocialIdentity
 *     -> find external identity by (provider, providerAccountId)
 *       -> resolve or create Tower user
 *         -> create identity link
 *           -> session issuance (provider-independent port)
 *
 * Rules enforced here:
 * - The external account id is authoritative. Email is metadata.
 * - Sign-in never merges accounts. A matching email alone never links.
 * - Linking an identity owned by another user is rejected with
 *   SocialIdentityAlreadyLinkedError; identities are never moved.
 * - Identity uniqueness is enforced by the store's transactional unique
 *   constraint, making concurrent callbacks race-safe.
 */
export class SocialIdentityLifecycle {
  constructor(
    private readonly store: SocialIdentityStore,
    private readonly options: {
      /** Issues a Tower session for a resolved user (same session model as every other auth method). */
      issueSession(userId: string): Promise<{ token: string }>
      persistTokens?: boolean
      /**
       * When true, a verified social email may resolve to an existing user
       * during FIRST sign-in (explicit policy — off by default). Unverified
       * emails never resolve; matching alone is never ownership.
       */
      resolveByEmail?: boolean
    }
  ) {}

  /**
   * Social sign-in: resolves an existing link or creates a new user + link,
   * then issues a session. Returns the same SignInResult shape as password
   * sign-in — social authentication is not a second session model.
   */
  async signIn(identity: SocialIdentity): Promise<SocialSignInResult> {
    let created = false
    const user = await this.store.transaction(async (tx) => {
      const existing = await tx.findIdentity(identity.provider, identity.providerAccountId)
      if (existing) return tx.findUserById(existing.userId)

      // No external identity yet. Resolve the user WITHOUT email-based
      // merging: unless the email exists AND is verified by its provider,
      // we create a fresh user. Verified-email resolution is explicit and
      // opt-in via `resolveByEmail`, never silent magic.
      if (this.options.resolveByEmail && identity.email?.verified && identity.email.value) {
        const byEmail = await tx.findUserByEmail(identity.email.value)
        if (byEmail) {
          await this.createLinkIn(tx, byEmail.id, identity)
          return byEmail
        }
      }

      const user = await this.store.createUser({
        name: identity.name ?? null,
        email: identity.email?.value ?? null,
        emailVerified: identity.email?.verified ?? false,
        image: identity.avatarUrl ?? null,
      })
      await this.createLinkIn(tx, user.id, identity)
      created = true
      return user
    })

    if (!user) throw new AuthenticationError('Social sign-in could not resolve a user')
    const { token } = await this.options.issueSession(user.id)
    return { user, token, redirect: false, created }
  }

  /**
   * Links an authenticated user to a social identity.
   *
   * - Unowned identity -> linked to the current user.
   * - Already owned by the same user -> deterministic `already-linked`.
   * - Owned by another user -> SocialIdentityAlreadyLinkedError. Never moved.
   */
  async link(userId: string, identity: SocialIdentity): Promise<LinkResult> {
    return this.store.transaction(async (tx) => {
      const existing = await tx.findIdentity(identity.provider, identity.providerAccountId)
      if (existing) {
        if (existing.userId === userId) {
          return { status: 'already-linked' as const, identity: existing }
        }
        throw new SocialIdentityAlreadyLinkedError(identity.provider, identity.providerAccountId)
      }
      return { status: 'linked' as const, identity: await this.createLinkIn(tx, userId, identity) }
    })
  }

  /** Lists a user's linked identities — groundwork for future unlink. */
  async listForUser(userId: string): Promise<SocialIdentityRecord[]> {
    return this.store.listIdentitiesForUser(userId)
  }

  private async createLinkIn(
    store: SocialIdentityStore,
    userId: string,
    identity: SocialIdentity
  ): Promise<SocialIdentityRecord> {
    const persistTokens = this.options.persistTokens === true
    try {
      return await store.createIdentity({
        userId,
        provider: identity.provider,
        providerAccountId: identity.providerAccountId,
        email: identity.email?.value ?? null,
        emailVerified: identity.email ? identity.email.verified : null,
        accessToken: persistTokens ? (identity.tokens?.accessToken ?? null) : null,
        refreshToken: persistTokens ? (identity.tokens?.refreshToken ?? null) : null,
        expiresAt: persistTokens ? (identity.tokens?.expiresAt ?? null) : null,
      })
    } catch (err) {
      if (err instanceof SocialIdentityConflictError) throw err
      // Stores may surface raw unique violations; normalize them.
      if (/duplicate key|unique constraint/i.test(String(err))) {
        throw new SocialIdentityConflictError(identity.provider, identity.providerAccountId)
      }
      throw err
    }
  }
}
