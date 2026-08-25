import { sql } from 'kysely'

import {
  type CreateUserInput,
  type NewSocialIdentityInput,
  SocialIdentityConflictError,
  type SocialIdentityRecord,
  type SocialIdentityStore,
} from './social-store.js'
import type { GatehouseUser } from './types.js'

/** Thrown when creating a user whose email already exists (never silently merged). */
export class SocialEmailTakenError extends Error {
  readonly email: string

  constructor(email: string) {
    super(
      `An account with email "${email}" already exists. Sign in first and link this social account ` +
        `from your account settings instead.`
    )
    this.name = 'SocialEmailTakenError'
    this.email = email
  }
}

/**
 * Default SocialIdentityStore over the application's Postgres database
 * (Kysely). Tower owns the `tower_social_identities` table — deliberately
 * separate from any provider's own tables — with the security invariant
 * enforced at the database level:
 *
 *   UNIQUE (provider, provider_account_id)
 *
 * Concurrent OAuth callbacks serialize on that constraint: exactly one wins,
 * the loser surfaces as SocialIdentityConflictError. The schema is created
 * idempotently so no migration ordering is required.
 */
export class KyselySocialIdentityStore implements SocialIdentityStore {
  constructor(private readonly db: any) {}

  /** Idempotently creates the identity table + uniqueness constraint. */
  async ensureSchema(): Promise<void> {
    await this.db.schema
      .createTable('tower_social_identities')
      .ifNotExists()
      .addColumn('id', 'text', (col: any) => col.primaryKey())
      .addColumn('user_id', 'text', (col: any) => col.notNull())
      .addColumn('provider', 'text', (col: any) => col.notNull())
      .addColumn('provider_account_id', 'text', (col: any) => col.notNull())
      .addColumn('email', 'text')
      .addColumn('email_verified', 'boolean')
      .addColumn('access_token', 'text')
      .addColumn('refresh_token', 'text')
      .addColumn('expires_at', 'timestamp')
      .addColumn('created_at', 'text', (col: any) => col.notNull().defaultTo(sql`now()`))
      .execute()

    await this.db.schema
      .createIndex('tower_social_identities_provider_account_unique')
      .unique()
      .ifNotExists()
      .on('tower_social_identities')
      .columns(['provider', 'provider_account_id'])
      .execute()
  }

  async findIdentity(provider: string, providerAccountId: string): Promise<SocialIdentityRecord | null> {
    const row = await this.db
      .selectFrom('tower_social_identities')
      .selectAll()
      .where('provider', '=', provider)
      .where('provider_account_id', '=', providerAccountId)
      .executeTakeFirst()
    return row ? mapRow(row) : null
  }

  async createIdentity(input: NewSocialIdentityInput): Promise<SocialIdentityRecord> {
    try {
      const row = await this.db
        .insertInto('tower_social_identities')
        .values({
          id: randomId(),
          user_id: input.userId,
          provider: input.provider,
          provider_account_id: input.providerAccountId,
          email: input.email ?? null,
          email_verified: input.emailVerified ?? null,
          access_token: input.accessToken ?? null,
          refresh_token: input.refreshToken ?? null,
          expires_at: input.expiresAt ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow()
      return mapRow(row)
    } catch (err) {
      if (/duplicate key|unique constraint/i.test(String(err))) {
        throw new SocialIdentityConflictError(input.provider, input.providerAccountId)
      }
      throw err
    }
  }

  async listIdentitiesForUser(userId: string): Promise<SocialIdentityRecord[]> {
    const rows = await this.db.selectFrom('tower_social_identities').selectAll().where('user_id', '=', userId).execute()
    return rows.map(mapRow)
  }

  async findUserById(id: string): Promise<GatehouseUser | null> {
    const row = await this.db.selectFrom('user').selectAll().where('id', '=', id).executeTakeFirst()
    if (!row) return null
    return mapUserRow(row)
  }

  async findUserByEmail(email: string): Promise<GatehouseUser | null> {
    const row = await this.db.selectFrom('user').selectAll().where('email', '=', email).executeTakeFirst()
    if (!row) return null
    return mapUserRow(row)
  }

  async createUser(input: CreateUserInput): Promise<GatehouseUser> {
    const now = new Date()
    try {
      const row = await this.db
        .insertInto('user')
        .values({
          id: randomId(),
          // Better Auth's user.name and user.email are NOT NULL and email is
          // typically UNIQUE. Users without an email get a synthetic,
          // undeliverable address in the reserved .invalid domain.
          name: input.name ?? '',
          email: input.email ?? `${randomId()}@tower.invalid`,
          emailVerified: input.emailVerified ?? false,
          image: input.image ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow()
      return mapUserRow(row)
    } catch (err) {
      // Unique email across users is a database-level guarantee in Tower
      // schemas; surface it explicitly instead of leaking SQL errors or,
      // worse, silently merging accounts.
      if (input.email && /duplicate key|unique constraint/i.test(String(err))) {
        throw new SocialEmailTakenError(input.email)
      }
      throw err
    }
  }

  transaction<T>(fn: (store: SocialIdentityStore) => Promise<T>): Promise<T> {
    return this.db.transaction().execute((trx: any) => fn(new KyselySocialIdentityStore(trx)))
  }
}

function mapRow(row: Record<string, any>): SocialIdentityRecord {
  return {
    id: row.id,
    userId: row.user_id ?? row.userId,
    provider: row.provider,
    providerAccountId: row.provider_account_id ?? row.providerAccountId,
    email: row.email ?? null,
    emailVerified: row.email_verified ?? row.emailVerified ?? null,
    accessToken: row.access_token ?? row.accessToken ?? null,
    refreshToken: row.refresh_token ?? row.refreshToken ?? null,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
  }
}

/** Maps a `user` table row (Better Auth schema or equivalent) to GatehouseUser. */
export function mapUserRow(row: Record<string, any>): GatehouseUser {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    email: String(row.email ?? ''),
    emailVerified: row.emailVerified === true || row.email_verified === true,
    image: row.image ?? null,
    createdAt: new Date(row.createdAt ?? row.created_at ?? Date.now()),
    updatedAt: new Date(row.updatedAt ?? row.updated_at ?? Date.now()),
  }
}

let seq = 0
function randomId(): string {
  seq += 1
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `sid_${rand}${seq.toString(36)}`
}
