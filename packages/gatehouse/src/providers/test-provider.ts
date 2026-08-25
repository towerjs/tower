import type {
  AuthContext,
  GatehouseProvider,
  GatehouseProviderCapabilities,
  GatehouseProviderInitOptions,
} from '../provider.js'
import { AuthenticationError } from '../types.js'
import type { GatehouseInstance, GatehouseSession, GatehouseUser, Session, SignInResult } from '../types.js'

const SESSION_COOKIE = 'gh_test_session'

interface StoredUser extends GatehouseUser {
  password: string
}

/**
 * In-memory reference implementation of the Gatehouse provider contract.
 *
 * Two uses:
 * 1. Runs the provider contract suite hermetically (no database).
 * 2. Proves the contract itself is Edge-compatible — it uses only
 *    web-standard APIs and declares `runtime.edge: true`.
 *
 * Also usable directly in application tests:
 *
 * ```ts
 * gatehouse({ provider: new TestProvider({ seedUsers: [...] }) })
 * ```
 */
export class TestProvider implements GatehouseProvider {
  readonly name = 'test'
  readonly capabilities: GatehouseProviderCapabilities = {
    runtime: { node: true, edge: true },
    authentication: {
      password: true,
      social: false,
      magicLink: false,
      emailVerification: false,
      passkeys: false,
      twoFactor: false,
      organizations: false,
      apiKeys: false,
      admin: false,
    },
    sessions: { database: true },
  }

  private users = new Map<string, StoredUser>()
  private tokens = new Map<string, string>()
  private counter = 0

  constructor(seed?: { users?: Array<{ name: string; email: string; password: string }> }) {
    for (const u of seed?.users ?? []) this.createUser(u.name, u.email, u.password)
  }

  async init(_options?: GatehouseProviderInitOptions): Promise<void> {}

  async migrate(): Promise<void> {}

  get raw(): unknown {
    return this
  }

  /** Alias kept for parity with the module-level `provider` escape hatch. */
  get provider(): unknown {
    return this
  }

  // ─── Internals ────────────────────────────────────────────────────

  private createUser(name: string, email: string, password: string): StoredUser {
    this.counter += 1
    const now = new Date()
    const user: StoredUser = {
      id: `test-user-${this.counter}`,
      name,
      email,
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
      password,
    }
    this.users.set(email, user)
    return user
  }

  private issueToken(userId: string): string {
    this.counter += 1
    const token = `test-token-${this.counter}`
    this.tokens.set(token, userId)
    return token
  }

  private resolveToken(headers: Headers): { user: StoredUser; session: GatehouseSession } | null {
    const cookie = headers.get('cookie') ?? ''
    const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))
    const bearer = headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    const token = match?.[1] ?? bearer
    if (!token) return null
    const userId = this.tokens.get(token)
    if (!userId) return null
    const user = Array.from(this.users.values()).find((u) => u.id === userId)
    if (!user) return null
    return {
      user,
      session: {
        id: `test-session-${token}`,
        userId,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        token,
        ipAddress: null,
        userAgent: headers.get('user-agent'),
      },
    }
  }

  private strip(user: StoredUser): GatehouseUser {
    const { password: _password, ...rest } = user
    return rest
  }

  // ─── GatehouseProvider ────────────────────────────────────────────

  async getSession(request: AuthContext): Promise<Session | null> {
    const resolved = this.resolveToken(request.headers)
    if (!resolved) return null
    const { user, session } = resolved
    void user
    return { user: this.strip(resolved.user), session }
  }

  async requireAuth(request: AuthContext): Promise<Session> {
    const session = await this.getSession(request)
    if (!session) throw new AuthenticationError()
    return session
  }

  async from(request: Request | { headers: Headers }): Promise<GatehouseInstance> {
    const headers = request instanceof Request ? request.headers : request.headers
    const resolved = this.resolveToken(headers)

    const signInResult = (user: StoredUser): SignInResult => {
      const token = this.issueToken(user.id)
      return { user: this.strip(user), token, redirect: false }
    }

    return {
      session: async () => (resolved ? { user: this.strip(resolved.user), session: resolved.session } : null),
      user: async () => (resolved ? this.strip(resolved.user) : null),
      headers,
      provider: this,
      requireUser: async () => {
        if (!resolved) throw new AuthenticationError()
        return this.strip(resolved.user)
      },

      signOut: async () => {
        if (resolved) this.tokens.delete(resolved.session.token)
      },

      signUp: {
        email: async ({ name, email, password }: { name: string; email: string; password: string }) => {
          if (this.users.has(email)) throw new Error('User already exists')
          const user = this.createUser(name, email, password)
          return signInResult(user)
        },
      },

      signIn: {
        email: async ({ email, password }: { email: string; password: string }) => {
          const user = this.users.get(email)
          if (!user || user.password !== password) throw new AuthenticationError('Invalid email or password')
          return signInResult(user)
        },
      },

      users: {
        get: async (id: string) => {
          const user = Array.from(this.users.values()).find((u) => u.id === id)
          return user ? this.strip(user) : null
        },
        findByEmail: async (email: string) => {
          const user = this.users.get(email)
          return user ? this.strip(user) : null
        },
      },
    } as unknown as GatehouseInstance
  }
}
