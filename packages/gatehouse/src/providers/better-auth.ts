import type { Kysely } from 'kysely'
import type {
  GatehouseConfig,
  GatehouseInstance,
  GatehouseUser,
  Session,
  ProxyOptions,
  ProxyResult,
} from '../types.js'
import type { EmailOTPOptions } from 'better-auth/plugins'
import { AuthenticationError } from '../types.js'
import { buildApi } from '../api-builder.js'
import { mapUser, mapSession } from '../map-user.js'

/** Adapter wrapping better-auth behind the Gatehouse interface. */
export class BetterAuthAdapter {
  private auth: any
  private api: any
  private db: Kysely<unknown>
  private config: GatehouseConfig

  constructor(config: GatehouseConfig, db: Kysely<unknown>) {
    this.db = db
    this.config = config
  }

  /**
   * Async factory — initializes better-auth with all plugins.
   * Must be called before any method is used.
   */
  async init(): Promise<void> {
    const config = this.config
    const db = this.db

    const [
      { betterAuth },
      { magicLink, emailOTP, twoFactor, organization, admin, phoneNumber },
      { passkey },
      { apiKey: apiKeyPlugin },
      { toNextJsHandler, nextCookies },
    ] = await Promise.all([
      import('better-auth'),
      import('better-auth/plugins'),
      import('@better-auth/passkey'),
      import('@better-auth/api-key'),
      import('better-auth/next-js'),
    ])

    const baseURL =
      config.baseURL ||
      process.env.GATEHOUSE_URL ||
      process.env.BETTER_AUTH_URL ||
      (process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : undefined)

    const emailVerification =
      config.emailVerification === true
        ? { enabled: true }
        : config.emailVerification
          ? { enabled: true, ...config.emailVerification }
          : undefined
    const emailVerificationEnabled = !!emailVerification

    const creds =
      config.credentials === true
        ? { enabled: true }
        : config.credentials
          ? { enabled: true, ...config.credentials }
          : undefined

    if (emailVerification?.required !== undefined && creds) {
      creds.requireEmailVerification = emailVerification.required
    }

    const allPlugins = [...(config.plugins || [])]

    if (config.magicLinks) {
      const sendMagicLink =
        typeof config.magicLinks === 'object' && config.magicLinks.sendMagicLink
          ? config.magicLinks.sendMagicLink
          : async (_params: { email: string; url: string }) => {
              throw new Error(
                `sendMagicLink not implemented — provide a sendMagicLink callback in the magicLinks config`
              )
            }
      allPlugins.push(magicLink({ sendMagicLink }))
    }
    if (emailVerificationEnabled && emailVerification.method === 'otp') {
      const sendVerificationOTP =
        emailVerification.sendVerificationOTP ??
        (async (_params: { email: string; otp: string; type: string }) => {
          throw new Error(
            `sendVerificationOTP not implemented — provide a sendVerificationOTP callback in the emailVerification config`
          )
        })
      allPlugins.push(
        emailOTP({
          sendVerificationOTP: sendVerificationOTP as EmailOTPOptions['sendVerificationOTP'],
          sendVerificationOnSignUp: emailVerification.sendOnSignUp,
          overrideDefaultEmailVerification: true,
          // Only forward expiresIn when explicitly set — otherwise omit it so
          // better-auth's default (300s) applies instead of new Date(NaN).
          ...(emailVerification.expiresIn !== undefined ? { expiresIn: emailVerification.expiresIn } : {}),
        })
      )
    }
    if (config.phoneNumber) {
      const sendOTP =
        typeof config.phoneNumber === 'object' && config.phoneNumber.sendOTP
          ? config.phoneNumber.sendOTP
          : async (_params: { phoneNumber: string; code: string }) => {
              throw new Error(`sendOTP not implemented — provide a sendOTP callback in the phoneNumber config`)
            }
      allPlugins.push(phoneNumber({ sendOTP }))
    }
    if (config.passkeys) {
      allPlugins.push(passkey(typeof config.passkeys === 'object' ? config.passkeys : undefined))
    }
    if (config.apiKey) {
      allPlugins.push(apiKeyPlugin(typeof config.apiKey === 'object' ? config.apiKey : undefined))
    }
    if (config.admin) {
      allPlugins.push(admin())
    }
    if (config.twoFactor) {
      allPlugins.push(twoFactor())
    }
    if (config.organization) {
      allPlugins.push(organization())
    }

    allPlugins.push(nextCookies())

    const social = expandSocial(config.social)

    const rateLimit = config.rateLimit ? { storage: 'database', ...config.rateLimit } : undefined

    const baOptions: Record<string, unknown> = {
      database: { db, type: 'postgres' },
      secret:
        config.passThrough?.secret ||
        process.env.GATEHOUSE_SECRET ||
        process.env.BETTER_AUTH_SECRET ||
        (process.env.NODE_ENV !== 'production' ? 'dev-secret-do-not-use-in-production-at-least-32-chars' : undefined),
      baseURL,
      basePath: config.passThrough?.basePath,
      appName: config.appName,
      emailAndPassword: creds,
      emailVerification:
        emailVerificationEnabled && emailVerification.method !== 'otp'
          ? {
              sendOnSignUp: emailVerification.sendOnSignUp,
              autoSignInAfterVerification: emailVerification.autoSignInAfterVerification,
              expiresIn: emailVerification.expiresIn,
              sendVerificationEmail: emailVerification.sendVerificationEmail,
              requireEmailVerification: emailVerification.required ?? creds?.requireEmailVerification,
            }
          : undefined,
      socialProviders: social,
      user: config.user,
      session: config.session,
      account: config.account,
      trustedOrigins: config.trustedOrigins,
      rateLimit,
      advanced: config.advanced,
      plugins: allPlugins,
    }
    if (config.passThrough) {
      for (const [k, v] of Object.entries(config.passThrough)) {
        baOptions[k] = v
      }
    }

    this.auth = betterAuth(baOptions as any)
    this.api = this.auth.api
    this._routes = toNextJsHandler(this.auth) as any
  }

  /** Runs better-auth database migrations. Called only from the Tower CLI, never during page rendering. */
  async migrate(): Promise<void> {
    const mod = (await import('better-auth/db/migration')) as {
      getMigrations: (o: any) => Promise<{ runMigrations: () => Promise<void> }>
    }
    const { runMigrations } = await mod.getMigrations(this.auth.options)
    await runMigrations()
  }

  /** Eagerly pre-loaded routes from better-auth/next-js. */
  private _routes: { GET: (req: Request) => Promise<Response>; POST: (req: Request) => Promise<Response> } | null = null

  /** Raw better-auth provider instance. */
  get provider(): any {
    return this.auth
  }

  /** Next.js route handlers (GET/POST) for the auth API. */
  get routes() {
    if (!this._routes) throw new Error('Routes not available. Gatehouse must be initialized first.')
    return this._routes
  }

  // ─── From ─────────────────────────────────────────────────────────

  /** Creates a per-request GatehouseInstance from a request or headers. */
  async from(request: Request | { headers: Headers }): Promise<GatehouseInstance> {
    const headers = request instanceof Request ? request.headers : request.headers
    const session = await this.getSession({ headers })
    const api = buildApi(this.api, headers)

    return {
      session: async () => session,
      user: async () => session?.user ?? null,
      headers,
      provider: this.auth,
      requireUser: () => this.requireAuth({ headers }),
      can: (params) => this.checkPermission(params),
      ...api,
      // Manual service blocks override the generic api surface where present,
      // so framework-level abstractions (users.findByEmail) are never clobbered
      // by the generic better-auth passthrough.
      users: {
        get: (id) => this.findUser(id, headers),
        findByEmail: (email) => this.findUserByEmail(email, headers),
      },
      roles: {
        assign: (userId, role) => this.setRole(userId, role, headers),
        remove: (userId) => this.removeRole(userId, headers),
      },
    } as GatehouseInstance
  }

  // ─── Proxy ────────────────────────────────────────────────────────

  /** Creates a middleware proxy that redirects unauthenticated requests. */
  createProxy(options?: ProxyOptions): ProxyResult {
    const publicPaths = options?.public ?? []
    const authPaths = options?.redirectIfAuthenticated ?? []
    const redirectTo = options?.redirectTo ?? '/sign-in'
    const redirectAfterSignIn = options?.redirectAfterSignIn ?? '/'

    const allPaths = [...publicPaths, ...authPaths].filter((p) => p !== '/')
    const matcher = allPaths.length > 0 ? allPaths : ['/((?!_next/static|favicon.ico).*)']

    const handler = async (request: Request): Promise<Response | undefined> => {
      const url = new URL(request.url)
      const path = url.pathname

      try {
        const auth = await this.from(request)
        if (await auth.user()) {
          if (authPaths.some((p) => matchPath(path, p))) {
            return Response.redirect(new URL(redirectAfterSignIn, url))
          }
          return
        }
      } catch {
        // Treat session failure as unauthenticated
      }

      if (publicPaths.some((p) => matchPath(path, p))) return

      return Response.redirect(new URL(redirectTo, url))
    }

    return { handler, config: { matcher } }
  }

  // ─── Sessions ─────────────────────────────────────────────────────

  async getSession(request: { headers: Headers }): Promise<Session | null> {
    const result = await this.api.getSession({
      headers: request.headers,
    })
    if (!result) return null
    return {
      user: mapUser(result.user),
      session: mapSession(result.session),
    }
  }

  async requireAuth(request: { headers: Headers }): Promise<Session> {
    const session = await this.getSession(request)
    if (!session) throw new AuthenticationError()
    return session
  }

  // ─── Users ────────────────────────────────────────────────────────

  async findUser(id: string, headers: Headers): Promise<GatehouseUser | null> {
    try {
      const result = (await this.api.getUser({ headers, body: { userId: id } })) as Record<string, unknown> | null
      if (!result) return null
      return mapUser(result)
    } catch {
      return null
    }
  }

  async findUserByEmail(email: string, _headers: Headers): Promise<GatehouseUser | null> {
    const user = await (this.db as any).selectFrom('user').where('email', '=', email).selectAll().executeTakeFirst()
    if (!user) return null
    return mapUser(user)
  }

  // ─── Role management (via better-auth admin API) ─────────────────

  async setRole(userId: string, role: string, headers: Headers): Promise<void> {
    await this.api.setRole({ headers, body: { userId, role } })
  }

  async removeRole(userId: string, headers: Headers): Promise<void> {
    await this.api.setRole({ headers, body: { userId, role: '' } })
  }

  // ─── Authorization ───────────────────────────────────────────────
  async checkPermission(params: {
    user: GatehouseUser
    permission: string | string[]
    organizationId?: string
  }): Promise<boolean> {
    try {
      if (params.organizationId && this.api.hasPermission) {
        const result = await this.api.hasPermission({
          body: {
            userId: params.user.id,
            organizationId: params.organizationId,
            permission: Array.isArray(params.permission) ? params.permission : [params.permission],
          },
        })
        return result.hasPermission === true
      }
      return false
    } catch {
      return false
    }
  }
}

function env(key: string): string | undefined {
  return (
    process.env[key] ||
    process.env[`GATEHOUSE_${key}`] ||
    process.env[`AUTH_${key}`] ||
    process.env[`BETTER_AUTH_${key}`]
  )
}

function expandSocial(
  config: string[] | Record<string, Record<string, unknown> | true> | undefined
): Record<string, Record<string, unknown>> | undefined {
  if (!config) return config
  const entries: [string, Record<string, unknown>][] = Array.isArray(config)
    ? config.map((p) => [p, {}])
    : Object.entries(config).map(([p, v]) => [p, v === true ? {} : v])
  const expanded: Record<string, Record<string, unknown>> = {}
  for (const [provider, opts] of entries) {
    const key = provider.toUpperCase().replace(/-/g, '_')
    const clientId = opts.clientId ?? env(`${key}_CLIENT_ID`)
    const clientSecret = opts.clientSecret ?? env(`${key}_CLIENT_SECRET`)
    if (!clientId || !clientSecret) {
      throw new Error(
        `Missing credentials for "${provider}" social provider. ` +
          `Set ${key}_CLIENT_ID and ${key}_CLIENT_SECRET in your environment, ` +
          `or pass clientId/clientSecret explicitly in tower.config.ts.`
      )
    }
    expanded[provider] = { ...opts, clientId, clientSecret }
  }
  return expanded
}

function matchPath(pathname: string, pattern: string): boolean {
  let regex = ''
  let i = 0
  while (i < pattern.length) {
    const c = pattern[i]
    if (c === ':') {
      i++
      while (i < pattern.length && /[a-zA-Z0-9_]/.test(pattern[i])) i++
      if (pattern[i] === '*') {
        regex += '[^/]+'
        i++
      } else {
        regex += '[^/]+'
      }
    } else if (c === '*') {
      if (pattern[i + 1] === '*') {
        regex += '.*'
        i += 2
      } else {
        regex += '[^/]+'
        i++
      }
    } else {
      regex += c === '/' ? '\\/' : c
      i++
    }
  }
  return new RegExp('^' + regex + '$').test(pathname)
}
