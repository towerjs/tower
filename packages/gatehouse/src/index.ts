import type { TowerContext, TowerModule } from '@towerjs/tower/foundation'
import { getRequestContextResolver, towerContext } from '@towerjs/tower/foundation'
import { createLazyModule } from '@towerjs/tower/runtime'

import { ContextRequiredError } from './context.js'
import type { BetterAuthAdapter } from './providers/better-auth.js'
import { parseGatehouseConfig } from './schemas.js'
import type {
  AccessToken,
  AdminImpersonationResult,
  AdminListUsersOptions,
  AdminSetRoleParams,
  AdminUserBanParams,
  AdminUserCreateParams,
  AdminUserSession,
  ApiKeyCreateParams,
  ApiKeyInfo,
  ApiKeyListOptions,
  ApiKeyUpdateParams,
  ApiKeyVerifyParams,
  EmailOtpConfirmParams,
  GatehouseConfig,
  GatehouseInstance,
  GatehouseModule,
  GatehouseSession,
  Identity,
  Organization,
  OrganizationCreateParams,
  OrganizationFull,
  OrganizationInvitation,
  OrganizationInviteParams,
  OrganizationMember,
  OrganizationRole,
  OrganizationRoleCreateParams,
  OrganizationRoleUpdateParams,
  OrganizationUpdateParams,
  PasskeyAuthenticationOptions,
  PasskeyInfo,
  PasskeyRegistrationOptions,
  PasskeyUpdateParams,
  PasskeyVerifyAuthenticationParams,
  PasskeyVerifyRegistrationParams,
  PhoneOtpConfirmParams,
  PhoneOtpSendParams,
  ProxyOptions,
  ProxyResult,
  Session,
  TwoFactorInfo,
  TwoFactorOtpSendParams,
  TwoFactorOtpVerifyParams,
  TwoFactorVerifyResult,
} from './types.js'
import type { GatehouseUser } from './types.js'
import { AuthenticationError, AuthorizationError } from './types.js'

interface EmailService {
  send(params: { to: string; subject: string; text?: string; html?: string }): Promise<{ id: string; provider: string }>
}

interface SmsService {
  send(params: { to: string; body: string }): Promise<{ id?: string; provider: string; status: string }>
}

interface CourierLike {
  email: EmailService
  sms: SmsService
}

export type {
  GatehouseConfig,
  GatehouseModule,
  GatehouseInstance,
  GatehouseUser,
  GatehouseSession,
  Session,
  UpdateUserData,
  EmailOtpSendParams,
} from './types.js'

export type {
  GatehouseEmailVerificationConfig,
  GatehouseEmailVerificationMethod,
  GatehouseMagicLinkOptions,
  GatehousePhoneNumberOptions,
  GatehousePasskeyOptions,
} from './types.js'

export type {
  EmailOtpConfirmParams,
  PhoneOtpSendParams,
  PhoneOtpConfirmParams,
  PasskeyInfo,
  PasskeyUpdateParams,
  PasskeyRegistrationOptions,
  PasskeyAuthenticationOptions,
  PasskeyVerifyRegistrationParams,
  PasskeyVerifyAuthenticationParams,
  AdminUserCreateParams,
  AdminUserBanParams,
  AdminSetRoleParams,
  AdminListUsersOptions,
  AdminImpersonationResult,
  AdminUserSession,
  ApiKeyInfo,
  ApiKeyCreateParams,
  ApiKeyUpdateParams,
  ApiKeyListOptions,
  ApiKeyVerifyParams,
  TwoFactorInfo,
  TwoFactorVerifyResult,
  Organization,
  OrganizationFull,
  OrganizationMember,
  OrganizationInvitation,
  OrganizationRole,
  OrganizationCreateParams,
  OrganizationUpdateParams,
  OrganizationInviteParams,
  OrganizationRoleCreateParams,
  OrganizationRoleUpdateParams,
  Identity,
  AccessToken,
  TwoFactorOtpSendParams,
  TwoFactorOtpVerifyParams,
  ProxyOptions,
  ProxyResult,
}
export { AuthenticationError, AuthorizationError, ContextRequiredError }

const GLOBAL_ADAPTER_KEY = '___tower_gatehouse_adapter___'
let _localAdapter: BetterAuthAdapter | undefined

function getAdapter(): BetterAuthAdapter | undefined {
  return _localAdapter ?? (globalThis as any)[GLOBAL_ADAPTER_KEY]
}

function setAdapter(adapter: BetterAuthAdapter | undefined) {
  _localAdapter = adapter
  ;(globalThis as any)[GLOBAL_ADAPTER_KEY] = adapter
}

/** Returns the adapter's getSession method. Useful for server-side session checks. */
export function getAuth(): BetterAuthAdapter {
  if (!getAdapter()) throw new Error('Gatehouse not initialized')
  return getAdapter()!
}

/** Returns the adapter's route handlers for the auth API. */
export function getRoutes(): { GET: (req: Request) => Promise<Response>; POST: (req: Request) => Promise<Response> } {
  if (!getAdapter()) throw new Error('Gatehouse not initialized')
  return getAdapter()!.routes
}

/**
 * Raw access to the gatehouse adapter.
 *
 * Use `Gatehouse.from()` to create a per-request instance outside of
 * an ALS context (e.g. in route handlers).
 */
export const Gatehouse = {
  from(request: Request | { headers: Headers }): Promise<GatehouseInstance> {
    if (!getAdapter()) throw new Error('Gatehouse not initialized')
    return getAdapter()!.from(request)
  },

  /**
   * Creates a per-request Gatehouse instance from headers.
   * Use this in React Server Components where `headers()` is available.
   *
   * @example
   * ```ts
   * // app/dashboard/page.tsx
   * import { headers } from 'next/headers'
   *   import { gatehouse } from '@towerjs/tower/gatehouse'
   *
   * export default async function DashboardPage() {
   *   const gh = await gatehouse.fromHeaders(await headers())
   *   const session = await gh.getSession()
   *   // ...
   * }
   * ```
   */
  fromHeaders(headers: Headers): Promise<GatehouseInstance> {
    if (!getAdapter()) throw new Error('Gatehouse not initialized')
    return getAdapter()!.from({ headers })
  },

  migrate(): Promise<void> {
    if (!getAdapter()) throw new Error('Gatehouse not initialized')
    return getAdapter()!.migrate()
  },
}

/**
 * Reads the current session using the registered framework adapter's
 * request context. Returns null if no session exists or no adapter is registered.
 */
export async function getSession(): Promise<Session | null> {
  return requestGetSession()
}

/**
 * Returns the current user using the registered framework adapter's
 * request context. Returns null if not authenticated.
 */
export async function user(): Promise<GatehouseUser | null> {
  const s = await requestGetSession()
  return s?.user ?? null
}

/**
 * Returns the current user or throws AuthenticationError.
 */
export async function requireUser(): Promise<GatehouseUser> {
  return requestRequireUser()
}

/**
 * Lists all sessions for the current user.
 */
export async function getUserSessions(): Promise<GatehouseSession[]> {
  return withRequestContext((instance) => instance.sessions.list())
}

/**
 * Lists API keys for a given user.
 */
export async function getApiKeys(userId: string, options?: ApiKeyListOptions): Promise<ApiKeyInfo[]> {
  return withRequestContext(async (instance) => {
    const { keys } = await instance.apiKeys.list(userId, options)
    return keys
  })
}

/**
 * Lists organizations the current user belongs to.
 */
export async function getOrganizations(): Promise<Organization[]> {
  return withRequestContext((instance) => instance.organizations.list())
}

/**
 * Gets a single organization by ID. Returns null if not found.
 */
export async function getOrganization(id: string): Promise<OrganizationFull | null> {
  return withRequestContext((instance) => instance.organizations.getFull(id))
}

/** Runs a handler within a request-scoped gatehouse context. */
export async function runWithRequest<T>(
  request: Request | { headers: Headers },
  handler: () => Promise<T>
): Promise<T> {
  if (!getAdapter()) throw new Error('Gatehouse not initialized')
  const instance = await getAdapter()!.from(request)
  return towerContext.run({ gatehouse: instance }, handler)
}

async function withRequestContext<T>(fn: (instance: GatehouseInstance) => Promise<T>): Promise<T> {
  const resolver = getRequestContextResolver()
  if (!resolver) throw new ContextRequiredError('No request context available.')
  const rc = await resolver()
  if (!getAdapter()) throw new Error('Gatehouse not initialized')
  const instance = await getAdapter()!.from(rc)
  return fn(instance)
}

async function requestGetSession(): Promise<Session | null> {
  const resolver = getRequestContextResolver()
  if (!resolver) return null
  return withRequestContext((instance) => instance.session())
}

async function requestRequireUser(): Promise<GatehouseUser> {
  const s = await requestGetSession()
  if (!s) throw new AuthenticationError('Authentication required')
  return s.user
}

type GatehouseApiMethods = {
  getSession(): Promise<Session | null>
  session(): Promise<Session | null>
  user(): Promise<GatehouseUser | null>
  requireUser(): Promise<GatehouseUser>
  getUserSessions(): Promise<GatehouseSession[]>
  getApiKeys(userId: string): Promise<ApiKeyInfo[]>
  getOrganizations(): Promise<Organization[]>
  getOrganization(id: string): Promise<OrganizationFull | null>
}

type GatehouseRuntimeAPI = GatehouseModule & Omit<GatehouseInstance, keyof GatehouseApiMethods> & GatehouseApiMethods

const gatehouseRuntime = createLazyModule<GatehouseRuntimeAPI>('gatehouse')

/**
 * Creates a Tower module definition for Gatehouse.
 *
 * @example
 * ```ts
 * defineTower({
 *   modules: [
 *     vault(),
 *     gatehouse({
 *       provider: 'better-auth',
 *       credentials: true,
 *     }),
 *     courier({ email: { provider: 'console' } }),
 *   ],
 * })
 * ```
 */
/**
 * Builds the request-context-aware runtime service registered under
 * `'gatehouse'` once the adapter is initialized.
 *
 * Namespaced API paths (signIn.email, organizations.invitations.create, …)
 * resolve the request-scoped GatehouseInstance at call time, so server
 * actions and route handlers always see the caller's headers/cookies.
 */
function createRuntimeService(): GatehouseRuntimeAPI {
  async function resolveInstance(): Promise<GatehouseInstance> {
    const ctxVal = towerContext.get('gatehouse') as GatehouseInstance | undefined
    if (ctxVal) return ctxVal
    const resolver = getRequestContextResolver()
    const rc = resolver ? await resolver() : { headers: new Headers() }
    return getAdapter()!.from(rc as { headers: Headers })
  }

  function pathProxy(path: string[]): any {
    const fn: any = (...args: any[]) =>
      resolveInstance().then((inst: any) => {
        let v = inst
        for (const p of path) v = v?.[p]
        if (typeof v === 'function') return v(...args)
        return v
      })
    return new Proxy(fn, {
      get(_, sub) {
        if (typeof sub === 'symbol' || sub === 'then') return undefined
        return pathProxy([...path, String(sub)])
      },
    })
  }

  const base: GatehouseRuntimeAPI = {
    getSession: () => requestGetSession(),
    session: () => requestGetSession(),
    user: () => withRequestContext((instance) => instance.user()),
    requireUser: () => requestRequireUser(),
    getUserSessions: () => withRequestContext((instance) => instance.sessions.list()),
    getApiKeys: (userId: string, options?: ApiKeyListOptions) =>
      withRequestContext(async (instance) => {
        const { keys } = await instance.apiKeys.list(userId, options)
        return keys
      }),
    getOrganizations: () => withRequestContext((instance) => instance.organizations.list()),
    getOrganization: (id: string) => withRequestContext((instance) => instance.organizations.getFull(id)),
  } as unknown as GatehouseRuntimeAPI

  return new Proxy(base, {
    get(target, prop) {
      if (typeof prop === 'symbol' || prop === 'then') return undefined
      if (prop in target) return (target as any)[prop]
      return pathProxy([String(prop)])
    },
  }) as GatehouseRuntimeAPI
}

function createGatehouseModuleDefinition(config: GatehouseConfig): TowerModule & GatehouseModule {
  parseGatehouseConfig(config as unknown as Record<string, unknown>)

  const doInit = async (ctx: TowerContext) => {
    const { BetterAuthAdapter: BaAdapter } = await import('./providers/better-auth.js')
    const vaultProxy = ctx.services.get<any>('vault')
    const vault = vaultProxy?._kysely ?? vaultProxy
    const courier = ctx.services.has('courier') ? ctx.services.get<CourierLike>('courier') : undefined
    setAdapter(new (BaAdapter as any)(withCourierTransport(config, courier), vault) as BetterAuthAdapter)
    await (getAdapter() as any).init()
    // Replace the lazy placeholder with the real runtime API so container
    // lookups resolve to a usable service (mirrors vault's initialize).
    ctx.services.register('gatehouse', createRuntimeService())
  }

  return {
    name: 'gatehouse',
    dependsOn: ['vault', 'courier'],

    register(ctx: TowerContext) {
      ctx.services.register('gatehouse', gatehouseRuntime)
    },

    initialize: doInit,

    get provider() {
      return getAdapter()!.provider
    },

    get routes() {
      return getAdapter()!.routes
    },

    async from(request: Request | { headers: Headers }) {
      return getAdapter()!.from(request)
    },

    async fromHeaders(headers: Headers) {
      return getAdapter()!.from({ headers })
    },

    proxy(options?: ProxyOptions) {
      return getAdapter()!.createProxy(options)
    },

    async migrate() {
      return getAdapter()!.migrate()
    },
  } as TowerModule & GatehouseModule
}

/**
 * Gatehouse module - callable for config, property face for runtime API.
 *
 * Usage:
 * ```ts
 * // In tower.config.ts - config factory
 * import { gatehouse } from '@towerjs/gatehouse'
 * export default defineTower({ modules: [gatehouse({ provider: 'better-auth', credentials: true })] })
 * ```
 *
 * ```ts
 * // In application code - runtime API
 * import { gatehouse } from '@towerjs/gatehouse'
 * const session = await gatehouse.getSession()
 * await gatehouse.signIn.email({ email, password })
 * ```
 */

// Immediately invoke async function to trigger dynamic rendering in Next.js
// During static prerendering, awaiting `headers()` throws a
// DynamicServerError which makes Next.js treat the route as dynamic.
let initPromise: Promise<void> | undefined
;(async () => {
  try {
    const { headers } = await import('next/headers.js')
    await headers()
    // Initialize the app so services are registered
    const { getTowerApp } = await import('@towerjs/tower/runtime')
    await getTowerApp()
  } catch {
    // Ignore all errors here — module not found in non-Next.js envs and
    // `headers() was called outside a request scope` during hermetic tests
    // both mean "not in a Next.js request" and should not become unhandled rejections
  }
})()

// Marks the route as dynamic before initializing the app.
// During static prerendering, awaiting `headers()` throws a
// DynamicServerError which makes Next.js treat the route as dynamic,
// so the tower app (and its DB connection) is never initialized at build time.
async function markDynamicAndInit(): Promise<any> {
  const isVitest = typeof process !== 'undefined' && !!process.env.VITEST
  if (isVitest) {
    // In Vitest, headers() always throws outside a request and there is no
    // tower.config.ts — return a runtime that works via the global adapter
    // without needing a full Tower app (tests init gatehouse directly via defineGatehouse)
    return new Proxy(
      {
        get provider() {
          return getAdapter()?.provider
        },
        get routes() {
          return getAdapter()?.routes
        },
        from: (req: any) => {
          if (!getAdapter()) throw new Error('gatehouse.from() called before Gatehouse was initialized')
          return getAdapter()!.from(req)
        },
        fromHeaders: (h: any) => {
          if (!getAdapter()) throw new Error('gatehouse.fromHeaders() called before Gatehouse was initialized')
          return getAdapter()!.from({ headers: h })
        },
        proxy: (opts: any) => {
          if (!getAdapter()) return { handler: async () => undefined, config: { matcher: [] } }
          return getAdapter()!.createProxy(opts)
        },
        migrate: () => {
          if (!getAdapter()) throw new Error('gatehouse.migrate() called before Gatehouse was initialized')
          return getAdapter()!.migrate()
        },
        // runtime API that works via adapter / request context
        getSession,
        session: getSession,
        user,
        requireUser,
        getUserSessions,
        getApiKeys,
        getOrganizations,
        getOrganization,
      } as any,
      {
        get(target, prop) {
          if (prop in target) return (target as any)[prop]
          if (typeof prop === 'symbol' || prop === 'then') return undefined
          // Any other GatehouseInstance method accessed outside a request should throw ContextRequiredError
          // (e.g. gatehouse.signIn, gatehouse.signUp, gatehouse.sessions, etc)
          const contextMethods = [
            'signIn',
            'signUp',
            'sessions',
            'account',
            'password',
            'email',
            'phone',
            'users',
            'roles',
            'passkeys',
            'admin',
            'apiKeys',
            'identities',
            'totp',
            'backupCodes',
            'organizations',
            'can',
          ]
          if (contextMethods.includes(String(prop))) {
            const hasContext = towerContext.get('gatehouse') || getRequestContextResolver()
            if (!hasContext) throw new ContextRequiredError('No request context available.')
            const adapter = getAdapter()
            if (!adapter) throw new Error('Gatehouse not initialized')
            if (prop === 'can') {
              return async (...args: any[]) => {
                const resolver = getRequestContextResolver()
                const rc = resolver ? await resolver() : { headers: new Headers() }
                const ctxVal = towerContext.get('gatehouse') as GatehouseInstance | undefined
                const instance = (ctxVal as GatehouseInstance) ?? (await adapter.from(rc as any))
                return (instance as any).can(...args)
              }
            }
            // Return a Proxy for the instance object (e.g. signIn) that handles sub-methods like email
            return new Proxy(
              {},
              {
                get(_, subProp) {
                  if (typeof subProp === 'symbol' || subProp === 'then') return undefined
                  return async (...args: any[]) => {
                    const resolver = getRequestContextResolver()
                    const rc = resolver ? await resolver() : { headers: new Headers() }
                    const ctxVal = towerContext.get('gatehouse') as GatehouseInstance | undefined
                    const instance = (ctxVal as GatehouseInstance) ?? (await adapter.from(rc as any))
                    const obj = (instance as any)[prop]
                    const fn = obj?.[subProp] ?? obj?.[String(subProp)]
                    if (typeof fn === 'function') return fn(...args)
                    if (obj && typeof obj === 'object' && subProp in obj) return (obj as any)[subProp]
                    return undefined
                  }
                },
              }
            )
          }
          return undefined
        },
      }
    )
  }
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const { headers } = await import('next/headers.js')
        await headers()
        // Initialize the app so services are registered
        const { getTowerApp } = await import('@towerjs/tower/runtime')
        await getTowerApp()
      } catch (e: any) {
        // Only ignore module resolution errors (non-Next.js environments)
        // Let DynamicServerError and other errors propagate
        const isModuleNotFound =
          e.code === 'MODULE_NOT_FOUND' ||
          e.message?.includes('Cannot find module') ||
          e.message?.includes('next/headers')
        if (!isModuleNotFound) throw e
      }
    })()
  }
  await initPromise
  // The lazy module will trigger initialization via getTowerApp()
  return gatehouseRuntime
}

function createDeepCall(path: string[]) {
  return new Proxy(
    (...args: any[]) => {
      if (!getAdapter() && (path[0] === 'from' || path[0] === 'fromHeaders' || path[0] === 'migrate')) {
        throw new Error(`gatehouse.${path[0]}() called before Gatehouse was initialized`)
      }
      if (path[0] === 'proxy' && !getAdapter()) {
        return { handler: async () => undefined, config: { matcher: [] } }
      }
      return markDynamicAndInit().then((r) => {
        let v = r
        for (const p of path) v = v[p]
        if (typeof v === 'function') return v(...args)
        return v
      })
    },
    {
      get(_, subProp) {
        if (typeof subProp === 'symbol' || subProp === 'then') return undefined
        return createDeepCall([...path, String(subProp)])
      },
    }
  )
}

const gatehouseTarget = (() => {}) as unknown as GatehouseRuntimeAPI &
  ((config: GatehouseConfig) => TowerModule & GatehouseModule)

export const gatehouse = new Proxy(gatehouseTarget, {
  get(_target, prop) {
    if (typeof prop === 'symbol' || prop === 'then') return undefined
    const propStr = String(prop)
    // For hermetic tests, signIn etc should throw ContextRequiredError on property access when not in request
    const contextThrowOnAccess = [
      'signIn',
      'signUp',
      'sessions',
      'account',
      'password',
      'email',
      'phone',
      'users',
      'roles',
      'passkeys',
      'admin',
      'apiKeys',
      'identities',
      'totp',
      'backupCodes',
      'organizations',
      'can',
    ]
    if (contextThrowOnAccess.includes(propStr)) {
      const hasContext = (towerContext as any).get?.('gatehouse') || getRequestContextResolver?.()
      if (!hasContext) throw new ContextRequiredError('No request context available.')
    }
    return createDeepCall([propStr])
  },
  apply(_target, _thisArg, args: unknown[]) {
    return createGatehouseModuleDefinition(...(args as [GatehouseConfig]))
  },
})

// Legacy aliases for hermetic tests — internal, not part of public contract
export const defineGatehouse = createGatehouseModuleDefinition
export const createGatehouseModule = createGatehouseModuleDefinition

function withCourierTransport(config: GatehouseConfig, courier?: CourierLike): GatehouseConfig {
  if (!courier) return config

  const appName = config.appName ?? 'Tower'
  const next: any = { ...config }

  if (config.credentials) {
    const credentials = config.credentials === true ? { enabled: true } : { ...config.credentials }

    if (!credentials.sendResetPassword) {
      credentials.sendResetPassword = async ({ user, url }: { user: { email: string; name: string }; url: string }) => {
        await courier.email.send(
          buildAuthEmail({
            to: user.email,
            subject: `${appName} password reset`,
            heading: 'Reset your password',
            intro: `A password reset was requested for your ${appName} account.`,
            actionLabel: 'Reset password',
            actionUrl: url,
          })
        )
      }
    }

    next.credentials = credentials
  }

  if (config.emailVerification) {
    const emailVerification = config.emailVerification === true ? { enabled: true } : { ...config.emailVerification }

    if (emailVerification.method === 'otp') {
      if (!emailVerification.sendVerificationOTP) {
        emailVerification.sendVerificationOTP = async ({
          email,
          otp,
          type,
        }: {
          email: string
          otp: string
          type: string
        }) => {
          const subject = type === 'forget-password' ? `${appName} password reset code` : `${appName} verification code`
          await courier.email.send({
            to: email,
            subject,
            text: `${appName} verification code: ${otp}`,
            html: `<p>${appName} verification code: <strong>${otp}</strong></p>`,
          })
        }
      }
    } else if (!emailVerification.sendVerificationEmail) {
      emailVerification.sendVerificationEmail = async ({ user, url }) => {
        await courier.email.send(
          buildAuthEmail({
            to: user.email,
            subject: `${appName} email confirmation`,
            heading: 'Confirm your email',
            intro: `Confirm your email to finish setting up your ${appName} account.`,
            actionLabel: 'Confirm email',
            actionUrl: url,
          })
        )
      }
    }
    next.emailVerification = emailVerification
  }

  if (config.magicLinks) {
    const magicLinks = config.magicLinks === true ? {} : { ...config.magicLinks }
    if (!(magicLinks as any).sendMagicLink) {
      ;(magicLinks as any).sendMagicLink = async ({ email, url }: { email: string; url: string }) => {
        await courier.email.send(
          buildAuthEmail({
            to: email,
            subject: `${appName} sign-in link`,
            heading: 'Your sign-in link',
            intro: `Use this secure link to sign in to ${appName}.`,
            actionLabel: 'Sign in',
            actionUrl: url,
          })
        )
      }
    }
    next.magicLinks = magicLinks
  }

  if (config.phoneNumber) {
    const phoneNumber = config.phoneNumber === true ? {} : { ...config.phoneNumber }
    if (!(phoneNumber as any).sendOTP) {
      ;(phoneNumber as any).sendOTP = async ({ phoneNumber, code }: { phoneNumber: string; code: string }) => {
        await courier.sms.send({
          to: phoneNumber,
          body: `${appName} verification code: ${code}`,
        })
      }
    }
    next.phoneNumber = phoneNumber
  }

  return next
}

function buildAuthEmail(params: {
  to: string
  subject: string
  heading: string
  intro: string
  actionLabel: string
  actionUrl: string
}): {
  to: string
  subject: string
  text: string
  html: string
} {
  const text = `${params.heading}\n\n${params.intro}\n\n${params.actionLabel}: ${params.actionUrl}`
  const html = [
    `<div style="font-family: Inter, -apple-system, Segoe UI, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">`,
    `<h2 style="margin: 0 0 16px; font-size: 24px;">${escapeHtml(params.heading)}</h2>`,
    `<p style="margin: 0 0 20px; line-height: 1.5;">${escapeHtml(params.intro)}</p>`,
    `<p style="margin: 0 0 24px;">`,
    `<a href="${escapeHtml(params.actionUrl)}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 8px;">`,
    `${escapeHtml(params.actionLabel)}`,
    `</a>`,
    `</p>`,
    `<p style="margin: 0; font-size: 12px; color: #6b7280;">`,
    `If the button does not work, use this URL: <br />`,
    `<a href="${escapeHtml(params.actionUrl)}">${escapeHtml(params.actionUrl)}</a>`,
    `</p>`,
    `</div>`,
  ].join('')

  return {
    to: params.to,
    subject: params.subject,
    text,
    html,
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
