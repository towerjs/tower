import type { GatehouseUser } from './types.js'

/**
 * Persistence port for Gatehouse's social identity lifecycle (#83).
 *
 * The invariant that matters lives here: **(provider, providerAccountId) is
 * globally unique**, enforced by the database — never by application-level
 * checks alone. Two concurrent OAuth callbacks must not produce two
 * identities for one external account; the unique constraint wins and the
 * loser surfaces as an explicit error.
 *
 * The default implementation stores identities in the application database
 * (Tower-owned `tower_social_identities` table) and resolves users through
 * the standard `user` table shared by all auth methods.
 */
export interface SocialIdentityRecord {
  id: string
  userId: string
  provider: string
  providerAccountId: string
  email: string | null
  emailVerified: boolean | null
  /** Stored only when configured; sensitive. */
  accessToken: string | null
  refreshToken: string | null
  expiresAt: Date | null
}

export interface NewSocialIdentityInput {
  userId: string
  provider: string
  providerAccountId: string
  email?: string | null
  emailVerified?: boolean | null
  accessToken?: string | null
  refreshToken?: string | null
  expiresAt?: Date | null
}

/** Error thrown when a unique (provider, providerAccountId) insertion loses a race or hits an existing link. */
export class SocialIdentityConflictError extends Error {
  readonly provider: string
  readonly providerAccountId: string

  constructor(provider: string, providerAccountId: string) {
    super(`Social identity (${provider}, ${providerAccountId}) is already linked`)
    this.name = 'SocialIdentityConflictError'
    this.provider = provider
    this.providerAccountId = providerAccountId
  }
}

export interface CreateUserInput {
  name?: string | null
  email?: string | null
  emailVerified?: boolean
  image?: string | null
}

export interface SocialIdentityStore {
  findIdentity(provider: string, providerAccountId: string): Promise<SocialIdentityRecord | null>
  /** Must fail with SocialIdentityConflictError when uniqueness would be violated. */
  createIdentity(input: NewSocialIdentityInput): Promise<SocialIdentityRecord>
  listIdentitiesForUser(userId: string): Promise<SocialIdentityRecord[]>
  findUserById(id: string): Promise<GatehouseUser | null>
  findUserByEmail(email: string): Promise<GatehouseUser | null>
  createUser(input: CreateUserInput): Promise<GatehouseUser>
  /**
   * Runs fn atomically; concurrent conflicting writes must serialize here.
   * Implementations pass a transaction-scoped store to fn — all reads and
   * writes inside the lifecycle callback go through it.
   */
  transaction<T>(fn: (store: SocialIdentityStore) => Promise<T>): Promise<T>
}
