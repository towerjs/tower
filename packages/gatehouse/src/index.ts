import type { TowerContext, TowerModule } from '@towerjs/tower/foundation'
import { getRequestContextResolver, towerContext } from '@towerjs/tower/foundation'
import { getTowerService } from '@towerjs/tower/runtime'

import { ContextRequiredError } from './context.js'
import { PolicyRegistry } from './policies.js'
import type { GatehouseProvider } from './provider.js'
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

// Provider contract (S6): Tower-owned provider interface, capabilities, and
// the reusable contract suite every curated provider must pass.
export type {
  AuthContext,
  GatehouseProvider,
  GatehouseProviderCapabilities,
  GatehouseProviderInitOptions,
  GatehouseProviderRoutes,
  ProviderAuthenticationCapabilities,
  ProviderRuntimeCapabilities,
  ProviderSessionCapabilities,
} from './provider.js'
export { UnsupportedCapabilityError, requireCapability } from './provider.js'
export { TestProvider } from './providers/test-provider.js'

// Policies (S7): provider-independent application authorization.
export { definePolicy, definePolicyRegistration, PolicyRegistry } from './policies.js'
export type { Policy, PolicyDecision, PolicyRegistration } from './policies.js'

// Social identity (S7): provider-independent OAuth/OIDC contract.
export { SocialProviderError, SocialStateMismatchError, mergeScopes } from './social.js'
export type {
  SocialCallbackParams,
  SocialEmail,
  SocialIdentity,
  SocialIdentityTokens,
  SocialProvider,
  SocialProviderCapabilities,
  SocialRedirect,
  SocialRedirectOptions,
} from './social.js'
export { TestSocialProvider } from './providers/social/test-social-provider.js'
export type { TestSocialProviderOptions } from './providers/social/test-social-provider.js'

// Social identity lifecycle (#83): Gatehouse-owned user/session linking.
export {
  SocialIdentityAlreadyLinkedError,
  SocialIdentityLifecycle,
  type LinkResult,
  type SocialSignInResult,
} from './social-lifecycle.js'
export { KyselySocialIdentityStore, SocialEmailTakenError } from './social-kysely-store.js'
export { SocialIdentityConflictError, type SocialIdentityRecord, type SocialIdentityStore } from './social-store.js'

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

function runtimeService(): GatehouseRuntimeAPI {
  return getTowerService<GatehouseRuntimeAPI>('gatehouse')
}

/** Returns the configured Tower Gatehouse provider. */
export function getProvider(): GatehouseProvider {
  return runtimeService().provider
}

/** Returns the adapter's route handlers for the auth API. */
export function getRoutes(): { GET: (req: Request) => Promise<Response>; POST: (req: Request) => Promise<Response> } {
  const provider = getProvider()
  if (!provider.routes) throw new Error(`The "${provider.name}" Gatehouse provider does not expose auth routes.`)
  return provider.routes
}

/**
 * Raw access to the gatehouse adapter.
 *
 * Use `Gatehouse.from()` to create a per-request instance outside of
 * an ALS context (e.g. in route handlers).
 */
export const Gatehouse = {
  from(request: Request | { headers: Headers }): Promise<GatehouseInstance> {
    return runtimeService().from(request)
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
    return runtimeService().fromHeaders(headers)
  },

  migrate(): Promise<void> {
    return runtimeService().migrate()
  },
}

/**
 * Reads the current session using the registered framework adapter's
 * request context. Returns null if no session exists or no adapter is registered.
 */
export async function getSession(): Promise<Session | null> {
  return runtimeService().getSession()
}

/**
 * Returns the current user using the registered framework adapter's
 * request context. Returns null if not authenticated.
 */
export async function user(): Promise<GatehouseUser | null> {
  return runtimeService().user()
}

/**
 * Returns the current user or throws AuthenticationError.
 */
export async function requireUser(): Promise<GatehouseUser> {
  return runtimeService().requireUser()
}

/**
 * Evaluates a policy action for the current user against a resource.
 * Returns false when unauthenticated; throws only when no policy is
 * registered. See {@link policies} for registration.
 */
export async function can(resource: object | string, action: string, ...args: unknown[]): Promise<boolean> {
  return runtimeService().can(resource, action, ...args)
}

/**
 * Evaluates a policy action and enforces it: unauthenticated requests throw
 * AuthenticationError, denied requests throw AuthorizationError.
 */
export async function authorize(resource: object | string, action: string, ...args: unknown[]): Promise<void> {
  await runtimeService().authorize(resource, action, ...args)
}

/**
 * Lists all sessions for the current user.
 */
export async function getUserSessions(): Promise<GatehouseSession[]> {
  return runtimeService().getUserSessions()
}

/**
 * Lists API keys for a given user.
 */
export async function getApiKeys(userId: string, options?: ApiKeyListOptions): Promise<ApiKeyInfo[]> {
  return runtimeService().getApiKeys(userId, options)
}

/**
 * Lists organizations the current user belongs to.
 */
export async function getOrganizations(): Promise<Organization[]> {
  return runtimeService().getOrganizations()
}

/**
 * Gets a single organization by ID. Returns null if not found.
 */
export async function getOrganization(id: string): Promise<OrganizationFull | null> {
  return runtimeService().getOrganization(id)
}

/** Runs a handler within a request-scoped gatehouse context. */
export async function runWithRequest<T>(
  request: Request | { headers: Headers },
  handler: () => Promise<T>
): Promise<T> {
  const instance = await getProvider().from(request)
  return towerContext.run({ gatehouse: instance }, handler)
}

async function withRequestContext<T>(fn: (instance: GatehouseInstance) => Promise<T>): Promise<T> {
  const resolver = getRequestContextResolver()
  if (!resolver) throw new ContextRequiredError('No request context available.')
  const rc = await resolver()
  const instance = await getProvider().from(rc)
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
  can(resource: object | string, action: string, ...args: unknown[]): Promise<boolean>
  authorize(resource: object | string, action: string, ...args: unknown[]): Promise<void>
  getUserSessions(): Promise<GatehouseSession[]>
  getApiKeys(userId: string, options?: ApiKeyListOptions): Promise<ApiKeyInfo[]>
  getOrganizations(): Promise<Organization[]>
  getOrganization(id: string): Promise<OrganizationFull | null>
}

type GatehouseRuntimeAPI = GatehouseModule & Omit<GatehouseInstance, keyof GatehouseApiMethods> & GatehouseApiMethods

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
function createRuntimeService(
  provider: GatehouseProvider,
  policyRegistry: PolicyRegistry,
  social: GatehouseModule['social']
): GatehouseRuntimeAPI {
  async function resolveInstance(): Promise<GatehouseInstance> {
    const ctxVal = towerContext.get('gatehouse') as GatehouseInstance | undefined
    if (ctxVal) return ctxVal
    const resolver = getRequestContextResolver()
    if (!resolver) throw new ContextRequiredError('No request context available.')
    return provider.from(await resolver())
  }

  async function resolveSession(): Promise<Session | null> {
    const contextInstance = towerContext.get('gatehouse') as GatehouseInstance | undefined
    if (contextInstance) return contextInstance.session()
    const resolver = getRequestContextResolver()
    if (!resolver) return null
    return (await resolveInstance()).session()
  }

  async function resolveUser(): Promise<GatehouseUser | null> {
    return (await resolveSession())?.user ?? null
  }

  async function resolveRequiredUser(): Promise<GatehouseUser> {
    const current = await resolveUser()
    if (!current) throw new AuthenticationError('Authentication required')
    return current
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
    provider,
    capabilities: provider.capabilities,
    get routes() {
      if (!provider.routes) throw new Error(`The "${provider.name}" Gatehouse provider does not expose auth routes.`)
      return provider.routes
    },
    from: (request: Request | { headers: Headers }) => provider.from(request),
    fromHeaders: (headers: Headers) => provider.from({ headers }),
    proxy: (options?: ProxyOptions) => {
      if (!provider.createProxy) {
        throw new Error(`The "${provider.name}" Gatehouse provider does not support route proxying.`)
      }
      return provider.createProxy(options)
    },
    migrate: () => provider.migrate(),
    social,
    getSession: resolveSession,
    session: resolveSession,
    user: resolveUser,
    requireUser: resolveRequiredUser,
    can: async (resource: object | string, action: string, ...args: unknown[]) =>
      policyRegistry.can(await resolveUser(), resource, action, ...args),
    authorize: async (resource: object | string, action: string, ...args: unknown[]) =>
      policyRegistry.authorize(await resolveUser(), resource, action, ...args),
    getUserSessions: () => resolveInstance().then((instance) => instance.sessions.list()),
    getApiKeys: (userId: string, options?: ApiKeyListOptions) =>
      resolveInstance().then(async (instance) => {
        const { keys } = await instance.apiKeys.list(userId, options)
        return keys
      }),
    getOrganizations: () => resolveInstance().then((instance) => instance.organizations.list()),
    getOrganization: (id: string) => resolveInstance().then((instance) => instance.organizations.getFull(id)),
  } as unknown as GatehouseRuntimeAPI

  return new Proxy(base, {
    get(target, prop) {
      if (typeof prop === 'symbol' || prop === 'then') return undefined
      if (prop in target) return (target as any)[prop]
      return pathProxy([String(prop)])
    },
  }) as GatehouseRuntimeAPI
}

function proxyConfig(options?: ProxyOptions): ProxyResult['config'] {
  const configuredPaths = [...(options?.public ?? []), ...(options?.redirectIfAuthenticated ?? [])].filter(
    (path) => path !== '/'
  )
  return {
    matcher: configuredPaths.length > 0 ? configuredPaths : ['/((?!_next/static|favicon.ico).*)'],
  }
}

/**
 * Creates a cold-start-safe proxy handler.
 *
 * Next.js evaluates proxy modules before Tower has initialized. Capturing a
 * no-op handler at module evaluation time would permanently fail open, so the
 * returned handler resolves the default Tower application on its first
 * request and only then delegates to the configured Gatehouse provider.
 */
function createDeferredProxy(options?: ProxyOptions): ProxyResult {
  return {
    config: proxyConfig(options),
    async handler(request) {
      const { getTowerApp } = await import('@towerjs/tower/runtime')
      await getTowerApp()
      const adapter = getProvider()

      if (!adapter.createProxy) {
        throw new Error(`The "${adapter.name}" Gatehouse provider does not support route proxying.`)
      }

      const providerProxy = adapter.createProxy(options)
      return providerProxy.handler(request)
    },
  }
}

function createGatehouseModuleDefinition(config: GatehouseConfig): TowerModule & GatehouseModule {
  parseGatehouseConfig(config as unknown as Record<string, unknown>)
  let provider: GatehouseProvider | undefined
  const policyRegistry = new PolicyRegistry()
  const socialState: SocialRuntimeState = {}
  const social = createSocialService(socialState)

  for (const registration of config.policies ?? []) {
    policyRegistry.register(registration.target, registration.policy)
  }

  const doInit = async (ctx: TowerContext) => {
    const vaultProxy = ctx.services.get<any>('vault')
    const vault = vaultProxy?._kysely ?? vaultProxy
    const courier = ctx.services.has('courier') ? ctx.services.get<CourierLike>('courier') : undefined

    if (typeof config.provider === 'object' && config.provider !== null) {
      // A GatehouseProvider instance — curated custom or test providers.
      provider = config.provider
    } else {
      const { BetterAuthAdapter: BaAdapter } = await import('./providers/better-auth.js')
      provider = new (BaAdapter as any)(withCourierTransport(config, courier), vault) as GatehouseProvider
    }

    if (ctx.runtime.name === 'edge' && !provider.capabilities.runtime.edge) {
      throw new Error(
        `The "${provider.name}" provider does not support Edge runtimes ` +
          `(runtime.edge is not declared in its capabilities). ` +
          `Run Gatehouse on Node.js with this provider, or choose an edge-capable provider.`
      )
    }

    await provider.init({ db: vault })

    // Social lifecycle (#83): wired when social providers are configured.
    const socialProviders = config.socialProviders ?? []
    if (socialProviders.length > 0) {
      if (!vault) throw new Error('Gatehouse social sign-in requires the Vault module for identity storage.')
      if (typeof provider.createSessionForUser !== 'function') {
        throw new Error(
          `The "${provider.name}" provider does not support session issuance ` +
            `(createSessionForUser), which Gatehouse social sign-in requires.`
        )
      }
      const { KyselySocialIdentityStore } = await import('./social-kysely-store.js')
      const store = new KyselySocialIdentityStore(vault)
      await store.ensureSchema()
      const { SocialIdentityLifecycle } = await import('./social-lifecycle.js')
      socialState.lifecycle = new SocialIdentityLifecycle(store, {
        issueSession: (userId) => provider!.createSessionForUser!(userId),
        resolveByEmail: false,
      })
      socialState.providers = new Map(socialProviders.map((socialProvider) => [socialProvider.id, socialProvider]))
    }

    ctx.services.register('gatehouse', createRuntimeService(provider, policyRegistry, social))
  }

  return {
    name: 'gatehouse',
    dependsOn: ['vault'],

    initialize: doInit,

    get provider() {
      if (!provider) throw new Error('Gatehouse not initialized')
      return provider
    },

    get capabilities() {
      if (!provider) throw new Error('Gatehouse not initialized')
      return provider.capabilities
    },

    get routes() {
      if (!provider) throw new Error('Gatehouse not initialized')
      if (!provider.routes) throw new Error(`The "${provider.name}" Gatehouse provider does not expose auth routes.`)
      return provider.routes
    },

    async from(request: Request | { headers: Headers }) {
      if (!provider) throw new Error('Gatehouse not initialized')
      return provider.from(request)
    },

    async fromHeaders(headers: Headers) {
      if (!provider) throw new Error('Gatehouse not initialized')
      return provider.from({ headers })
    },

    proxy(options?: ProxyOptions) {
      if (!provider) throw new Error('Gatehouse not initialized')
      if (!provider.createProxy) {
        throw new Error(`The "${provider.name}" Gatehouse provider does not support route proxying.`)
      }
      return provider.createProxy(options)
    },

    async migrate() {
      if (!provider) throw new Error('Gatehouse not initialized')
      return provider.migrate()
    },

    social,
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

interface SocialRuntimeState {
  lifecycle?: import('./social-lifecycle.js').SocialIdentityLifecycle
  providers?: Map<string, import('./social.js').SocialProvider>
}

/**
 * The Tower-owned social sign-in / linking API (#83).
 *
 * Applications configure social providers in tower.config.ts. Better Auth
 * remains the production social path (`gatehouse.signIn.social`); the
 * SocialProvider contract exists so curated adapters can implement the same
 * semantics — e.g. a future Clerk adapter, or TestSocialProvider in tests:
 *
 * ```ts
 * gatehouse({
 *   provider: 'better-auth',
 *   credentials: true,
 *   socialProviders: [myProvider()],
 * })
 * ```
 *
 * Then the flow is:
 *
 * ```ts
 * // 1. redirect the browser
 * const { url } = await gatehouse.social.redirect('acme')
 *
 * // 2. in the callback route: exchange + resolve/link + issue session
 * const result = await gatehouse.social.authenticate({ provider: 'acme', code })
 * ```
 */
function createSocialService(state: SocialRuntimeState): GatehouseModule['social'] {
  return {
    async redirect(providerId, options) {
      const provider = state.providers?.get(providerId)
      if (!provider) throw new Error(`Unknown social provider "${providerId}". Is it configured in socialProviders?`)
      return provider.redirect(options)
    },

    async authenticate(params) {
      if (!state.lifecycle || !state.providers) {
        throw new Error('Gatehouse social sign-in is not configured. Add socialProviders to your gatehouse config.')
      }
      const provider = state.providers.get(params.provider)
      if (!provider) throw new Error(`Unknown social provider "${params.provider}".`)
      return state.lifecycle.signIn(await provider.callback({ code: params.code }))
    },

    async linkCurrent(params) {
      if (!state.lifecycle || !state.providers) {
        throw new Error('Gatehouse social linking is not configured. Add socialProviders to your gatehouse config.')
      }
      const currentUser = await runtimeService().requireUser()
      const provider = state.providers.get(params.provider)
      if (!provider) throw new Error(`Unknown social provider "${params.provider}".`)
      return state.lifecycle.link(currentUser.id, await provider.callback({ code: params.code }))
    },
  }
}

function createDeepCall(path: string[]) {
  return new Proxy(
    async (...args: any[]) => {
      const { resolveTowerService } = await import('@towerjs/tower/runtime')
      let value: any = await resolveTowerService<GatehouseRuntimeAPI>('gatehouse')
      for (const segment of path) value = value[segment]
      if (typeof value === 'function') return value(...args)
      return value
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
    if (propStr === 'proxy') return (options?: ProxyOptions) => createDeferredProxy(options)
    if (propStr === 'provider' || propStr === 'capabilities' || propStr === 'routes') {
      return (runtimeService() as any)[propStr]
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
