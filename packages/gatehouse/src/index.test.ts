import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Hoisted shared state ───────────────────────────────────────

const mocks = vi.hoisted(() => {
  let alsStore: Record<string, any> = {}
  const mockBetterAuth = vi.fn()
  const mockToNextJsHandler = vi.fn()
  const mockRegisterModule = vi.fn()
  const mockSignInEmail = vi.fn()
  const mockSignUpEmail = vi.fn()
  const mockSignOut = vi.fn()
  const mockGetSession = vi.fn()
  const mockListSessions = vi.fn()
  const mockCreateOrganization = vi.fn()
  const mockListOrganizations = vi.fn()

  function reset() {
    alsStore = {}
    vi.clearAllMocks()
  }

  return {
    alsStore,
    mockBetterAuth,
    mockToNextJsHandler,
    mockRegisterModule,
    mockSignInEmail,
    mockSignUpEmail,
    mockSignOut,
    mockGetSession,
    mockListSessions,
    mockCreateOrganization,
    mockListOrganizations,
    mockGetMigrations: vi.fn(() => ({
      runMigrations: vi.fn().mockResolvedValue(undefined),
    })),
    reset,
  }
})

// ─── Module mocks ───────────────────────────────────────────────

vi.mock('better-auth', () => ({
  betterAuth: mocks.mockBetterAuth,
}))

vi.mock('better-auth/next-js', () => ({
  toNextJsHandler: mocks.mockToNextJsHandler,
}))

vi.mock('better-auth/plugins', () => ({
  magicLink: vi.fn((opts) => ({ id: 'magic-link', ...opts })),
  emailOTP: vi.fn((opts) => ({ id: 'email-otp', ...opts })),
  twoFactor: vi.fn(() => ({ id: 'two-factor' })),
  organization: vi.fn(() => ({ id: 'organization' })),
  admin: vi.fn(() => ({ id: 'admin' })),
  phoneNumber: vi.fn((opts) => ({ id: 'phone-number', ...opts })),
}))

vi.mock('@better-auth/passkey', () => ({
  passkey: vi.fn((opts) => ({ id: 'passkey', ...opts })),
}))

vi.mock('@better-auth/api-key', () => ({
  apiKey: vi.fn((opts) => ({ id: 'api-key', ...opts })),
}))

vi.mock('better-auth/db/migration', () => ({
  getMigrations: mocks.mockGetMigrations,
}))



const mockTowerContext = {
  get: vi.fn((key: string) => mocks.alsStore[key]),
  run: vi.fn(async (ctx: any, handler: () => any) => {
    const prev = { ...mocks.alsStore }
    Object.assign(mocks.alsStore, ctx)
    try {
      return await handler()
    } finally {
      Object.assign(mocks.alsStore, prev)
    }
  }),
}

vi.mock('@towerjs/foundation', () => ({
  towerContext: mockTowerContext,
  getRequestContextResolver: vi.fn().mockReturnValue(undefined),
}))

vi.mock('@towerjs/blueprint', () => ({
  towerContext: mockTowerContext,
  registerModule: mocks.mockRegisterModule,
}))

// ─── Helpers ────────────────────────────────────────────────────

function setupBetterAuthApi() {
  const api = {
    getSession: mocks.mockGetSession,
    signInEmail: mocks.mockSignInEmail,
    signUpEmail: mocks.mockSignUpEmail,
    signOut: mocks.mockSignOut,
    listSessions: mocks.mockListSessions,
    createOrganization: mocks.mockCreateOrganization,
    listOrganizations: mocks.mockListOrganizations,
  }
  mocks.mockBetterAuth.mockReturnValue({ api, options: {} })
  mocks.mockToNextJsHandler.mockReturnValue({
    GET: vi.fn().mockResolvedValue(new Response()),
    POST: vi.fn().mockResolvedValue(new Response()),
  })
}

const mockServices = () => {
  const db = { selectFrom: vi.fn() }
  return {
    get: vi.fn((_key: string) => ({ db })) as any,
    register: vi.fn(),
    registerFactory: vi.fn(),
    has: vi.fn(),
  }
}

const mockCtx = (overrides = {}): any => ({
  services: mockServices(),
  config: { modules: {} },
  runtime: { name: 'node-server' as const, isServerless: false },
  ...overrides,
})

beforeEach(() => {
  mocks.reset()
  setupBetterAuthApi()
})

// ─── Context # just the Error class ──────────────────────────

describe('ContextRequiredError', () => {
  it('is an Error with correct name', async () => {
    const { ContextRequiredError } = await import('./context.js')
    const err = new ContextRequiredError()
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('ContextRequiredError')
  })

  it('accepts custom message', async () => {
    const { ContextRequiredError } = await import('./context.js')
    const err = new ContextRequiredError('custom')
    expect(err.message).toBe('custom')
  })
})

describe('getCurrentGatehouse', () => {
  it('returns undefined when no context', async () => {
    const { getCurrentGatehouse } = await import('./context.js')
    expect(getCurrentGatehouse()).toBeUndefined()
  })

  it('returns instance when context is set', async () => {
    const { towerContext } = await import('@towerjs/blueprint')
    const { getCurrentGatehouse } = await import('./context.js')

    const fake = { provider: {} }
    await (towerContext as any).run({ gatehouse: fake }, async () => {
      expect(getCurrentGatehouse()).toBe(fake)
    })
  })
})

// ─── facade-builder ─────────────────────────────────────────

describe('buildProxiedApi', () => {
  it('wraps method to inject headers', async () => {
    const { buildProxiedApi } = await import('./facade-builder.js')
    const headers = new Headers({ authorization: 'Bearer x' })
    const inner = vi.fn().mockResolvedValue('ok')
    const api = { someMethod: inner }
    const proxied = buildProxiedApi(api, headers)

    await proxied.someMethod({ email: 'a@b.com' })
    expect(inner).toHaveBeenCalledWith(expect.objectContaining({ headers, body: { email: 'a@b.com' } }))
  })

  it('passes GET-method params as query', async () => {
    const { buildProxiedApi } = await import('./facade-builder.js')
    const headers = new Headers()
    const inner = vi.fn().mockResolvedValue([])
    const api = { listSessions: inner }
    const proxied = buildProxiedApi(api, headers)

    await proxied.listSessions({ userId: '1' })
    expect(inner).toHaveBeenCalledWith(expect.objectContaining({ query: { userId: '1' } }))
  })

  it('allows raw params via body/query/headers keys', async () => {
    const { buildProxiedApi } = await import('./facade-builder.js')
    const headers = new Headers()
    const inner = vi.fn().mockResolvedValue('ok')
    const api = { someMethod: inner }
    const proxied = buildProxiedApi(api, headers)

    await proxied.someMethod({ body: { raw: true }, headers: new Headers() })
    expect(inner).toHaveBeenCalledWith(expect.objectContaining({ body: { raw: true } }))
  })

  it('passes non-function properties through', async () => {
    const { buildProxiedApi } = await import('./facade-builder.js')
    const api = { staticVal: 42 }
    const proxied = buildProxiedApi(api, new Headers())
    expect(proxied.staticVal).toBe(42)
  })
})

describe('buildFacade', () => {
  it('maps API methods to nested paths', async () => {
    const { buildFacade } = await import('./facade-builder.js')
    const api = {
      signInEmail: vi.fn(),
      signOut: vi.fn(),
      listSessions: vi.fn(),
      createOrganization: vi.fn(),
    }

    const facade = buildFacade(api as any)
    expect(typeof facade.signIn?.email).toBe('function')
    expect(typeof facade.sessions?.signOut).toBe('function')
    expect(typeof facade.sessions?.list).toBe('function')
    expect(typeof facade.organizations?.create).toBe('function')
  })

  it('collects unmapped methods in api passthrough', async () => {
    const { buildFacade } = await import('./facade-builder.js')
    const api = { customPlugin: vi.fn(), signInEmail: vi.fn() }
    const facade = buildFacade(api as any)
    expect(typeof facade.api?.customPlugin).toBe('function')
  })

  it('excludes SKIP_INTERNAL from passthrough', async () => {
    const { buildFacade } = await import('./facade-builder.js')
    const api = { getSession: vi.fn(), callbackOAuth: vi.fn(), randomFn: vi.fn() }
    const facade = buildFacade(api as any)
    expect(facade.api?.getSession).toBeUndefined()
    expect(facade.api?.callbackOAuth).toBeUndefined()
    expect(typeof facade.api?.randomFn).toBe('function')
  })

  it('calls original function with same args', async () => {
    const { buildFacade } = await import('./facade-builder.js')
    const inner = vi.fn().mockResolvedValue('ok')
    const api = { signInEmail: inner }
    const facade = buildFacade(api as any)

    const result = await facade.signIn.email('a', 'b')
    expect(result).toBe('ok')
    expect(inner).toHaveBeenCalledWith('a', 'b')
  })

  it('skips mappings for undefined methods', async () => {
    const { buildFacade } = await import('./facade-builder.js')
    const api = { signInEmail: undefined }
    const facade = buildFacade(api as any)
    expect(facade.signIn).toBeUndefined()
  })
})

// ─── Adapter ──────────────────────────────────────────────────

describe('BetterAuthAdapter', () => {
  it('creates better-auth with database and plugins', async () => {
    const { BetterAuthAdapter } = await import('./providers/better-auth.js')
    const db = { selectFrom: vi.fn() } as any
    const adapter = new BetterAuthAdapter({ provider: 'better-auth' } as any, db)
    await (adapter as any).init()

    expect(mocks.mockBetterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        database: { db, type: 'postgres' },
      })
    )
  })

  it('sets plugins based on config', async () => {
    const { BetterAuthAdapter } = await import('./providers/better-auth.js')
    const db = {} as any
    const adapter = new BetterAuthAdapter(
      {
        provider: 'better-auth',
        magicLinks: { sendMagicLink: vi.fn() },
        emailOtp: { sendVerificationOTP: vi.fn() },
        phoneNumber: { sendOTP: vi.fn() },
        passkeys: true,
        apiKey: true,
        admin: true,
        twoFactor: true,
        organization: true,
      } as any,
      db
    )
    await (adapter as any).init()

    const opts = mocks.mockBetterAuth.mock.calls[0][0]
    expect(opts.plugins.length).toBeGreaterThanOrEqual(6)
    expect(opts.plugins.find((p: any) => p.id === 'magic-link')).toBeDefined()
    expect(opts.plugins.find((p: any) => p.id === 'email-otp')).toBeDefined()
    expect(opts.plugins.find((p: any) => p.id === 'phone-number')).toBeDefined()
    expect(opts.plugins.find((p: any) => p.id === 'passkey')).toBeDefined()
    expect(opts.plugins.find((p: any) => p.id === 'api-key')).toBeDefined()
    expect(opts.plugins.find((p: any) => p.id === 'admin')).toBeDefined()
    expect(opts.plugins.find((p: any) => p.id === 'two-factor')).toBeDefined()
    expect(opts.plugins.find((p: any) => p.id === 'organization')).toBeDefined()
  })

  it('exposes provider (better-auth instance)', async () => {
    const { BetterAuthAdapter } = await import('./providers/better-auth.js')
    const adapter = new (BetterAuthAdapter as any)({ provider: 'better-auth' }, {})
    await (adapter as any).init()
    expect(adapter.provider).toBeDefined()
    expect(mocks.mockBetterAuth).toHaveBeenCalled()
  })

  it('exposes routes from toNextJsHandler', async () => {
    const { BetterAuthAdapter } = await import('./providers/better-auth.js')
    const adapter = new (BetterAuthAdapter as any)({ provider: 'better-auth' }, {})
    await (adapter as any).init()
    const routes = adapter.routes
    expect(mocks.mockToNextJsHandler).toHaveBeenCalled()
    expect(typeof routes.GET).toBe('function')
    expect(typeof routes.POST).toBe('function')
  })

  it('getSession calls api.getSession and maps result', async () => {
    const { BetterAuthAdapter } = await import('./providers/better-auth.js')
    const headers = new Headers()
    mocks.mockGetSession.mockResolvedValueOnce({
      user: {
        id: 'u1',
        name: 'Alice',
        email: 'a@b.com',
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: { id: 's1', userId: 'u1', expiresAt: new Date(), token: 'tok' },
    })

    const adapter = new (BetterAuthAdapter as any)({ provider: 'better-auth' }, {})
    await (adapter as any).init()
    const result = await adapter.getSession({ headers })
    expect(result).not.toBeNull()
    expect(result.user.name).toBe('Alice')
    expect(result.session.token).toBe('tok')
  })

  it('getSession returns null for no session', async () => {
    const { BetterAuthAdapter } = await import('./providers/better-auth.js')
    mocks.mockGetSession.mockResolvedValueOnce(null)

    const adapter = new (BetterAuthAdapter as any)({ provider: 'better-auth' }, {})
    await (adapter as any).init()
    const result = await adapter.getSession({ headers: new Headers() })
    expect(result).toBeNull()
  })

  it('from creates GatehouseInstance with methods', async () => {
    const { BetterAuthAdapter } = await import('./providers/better-auth.js')
    mocks.mockGetSession.mockResolvedValue(null)

    const adapter = new (BetterAuthAdapter as any)({ provider: 'better-auth' }, {})
    await (adapter as any).init()
    const instance = await adapter.from({ headers: new Headers() })
    expect(typeof instance.session).toBe('function')
    expect(typeof instance.signIn?.email).toBe('function')
    expect(typeof instance.sessions?.signOut).toBe('function')
    expect(typeof instance.requireUser).toBe('function')
  })

  it('proxy creates handler with redirect logic', async () => {
    const { BetterAuthAdapter } = await import('./providers/better-auth.js')
    mocks.mockGetSession.mockResolvedValue(null)

    const adapter = new (BetterAuthAdapter as any)({ provider: 'better-auth' }, {})
    await (adapter as any).init()
    const result = adapter.createProxy({ public: ['/about'] })
    expect(typeof result.handler).toBe('function')
    expect(result.config.matcher).toEqual(['/about'])

    const req = new Request('https://example.com/protected')
    const resp = await result.handler(req)
    expect(resp?.status).toBe(302)
    expect(resp?.headers.get('location')).toBe('https://example.com/sign-in')
  })

  it('proxy allows authenticated users through', async () => {
    const { BetterAuthAdapter } = await import('./providers/better-auth.js')
    mocks.mockGetSession.mockResolvedValue({
      user: {
        id: 'u1',
        name: 'A',
        email: 'a@b.com',
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: { id: 's1', userId: 'u1', expiresAt: new Date(), token: 'tok' },
    })

    const adapter = new (BetterAuthAdapter as any)({ provider: 'better-auth' }, {})
    await (adapter as any).init()
    const result = adapter.createProxy({ redirectIfAuthenticated: ['/sign-in'] })

    const req = new Request('https://example.com/sign-in')
    const resp = await result.handler(req)
    expect(resp?.status).toBe(302)
    expect(resp?.headers.get('location')).toBe('https://example.com/')
  })

  it('proxy redirects unauthenticated users to sign-in', async () => {
    const { BetterAuthAdapter } = await import('./providers/better-auth.js')
    mocks.mockGetSession.mockResolvedValue(null)

    const adapter = new (BetterAuthAdapter as any)({ provider: 'better-auth' }, {})
    await (adapter as any).init()
    const result = adapter.createProxy({ redirectTo: '/custom-sign-in' })

    const req = new Request('https://example.com/dashboard')
    const resp = await result.handler(req)
    expect(resp?.status).toBe(302)
    expect(resp?.headers.get('location')).toBe('https://example.com/custom-sign-in')
  })

  it('proxy passes through public paths', async () => {
    const { BetterAuthAdapter } = await import('./providers/better-auth.js')
    mocks.mockGetSession.mockResolvedValue(null)

    const adapter = new (BetterAuthAdapter as any)({ provider: 'better-auth' }, {})
    await (adapter as any).init()
    const result = adapter.createProxy({ public: ['/api/webhook'] })

    const req = new Request('https://example.com/api/webhook')
    const resp = await result.handler(req)
    expect(resp).toBeUndefined()
  })
})

// ─── Combined proxy (gatehouse singleton) ──────────────────────

describe('gatehouse combined proxy', () => {
  beforeEach(() => {
    vi.resetModules()
    setupBetterAuthApi()
  })

  async function initModule() {
    const { defineGatehouse } = await import('./index.js')
    await defineGatehouse({ provider: 'better-auth' } as any).init!(mockCtx())
  }

  it('throws ContextRequiredError for context methods when not in request', async () => {
    await initModule()
    const { gatehouse, ContextRequiredError } = await import('./index.js')
    await expect((gatehouse as any).session()).resolves.toBeNull()
    expect(() => (gatehouse as any).signIn).toThrow(ContextRequiredError)
    expect(() => (gatehouse as any).signUp).toThrow(ContextRequiredError)
  })

  it('exposes module-level methods without request context', async () => {
    await initModule()
    const { gatehouse } = await import('./index.js')
    expect(typeof (gatehouse as any).from).toBe('function')
    expect(typeof (gatehouse as any).migrate).toBe('function')
    expect(typeof (gatehouse as any).proxy).toBe('function')
  })

  it('delegates from() to adapter', async () => {
    await initModule()
    const { gatehouse } = await import('./index.js')
    const headers = new Headers()
    await (gatehouse as any).from({ headers })
    expect(mocks.mockGetSession).toHaveBeenCalled()
  })

  it('delegates migrate() to adapter', async () => {
    await initModule()
    const { gatehouse } = await import('./index.js')
    const result = await (gatehouse as any).migrate()
    expect(result).toBeUndefined()
  })

  it('delegates proxy() to adapter', async () => {
    await initModule()
    const { gatehouse } = await import('./index.js')
    const result = await (gatehouse as any).proxy({ public: ['/'] })
    expect(result.config).toBeDefined()
  })

  it('returns provider and routes from adapter', async () => {
    await initModule()
    const { gatehouse } = await import('./index.js')
    expect((gatehouse as any).provider).toBeDefined()
    expect((gatehouse as any).routes).toBeDefined()
  })

  it('uses ALS context when available', async () => {
    await initModule()
    const { gatehouse, runWithRequest } = await import('./index.js')

    const result = await runWithRequest({ headers: new Headers() }, async () => {
      await (gatehouse as any).signIn.email({ email: 'a@b.com', password: 'pw' })
      return 'done'
    })
    expect(result).toBe('done')
    expect(mocks.mockSignInEmail).toHaveBeenCalled()
  })

  it('throws when uninitialized', async () => {
    const { gatehouse, ContextRequiredError } = await import('./index.js')
    expect(() => (gatehouse as any).from).toThrow(ContextRequiredError)
    expect(() => (gatehouse as any).migrate).toThrow(ContextRequiredError)
    expect(typeof (gatehouse as any).proxy).toBe('function')
    const result = (gatehouse as any).proxy()
    expect(result).toHaveProperty('handler')
    expect(typeof result.handler).toBe('function')
  })
})

// ─── Module lifecycle ─────────────────────────────────────────

describe('defineGatehouse', () => {
  beforeEach(() => {
    vi.resetModules()
    setupBetterAuthApi()
  })

  it('returns TowerModule with name gatehouse', async () => {
    const { defineGatehouse } = await import('./index.js')
    const mod = defineGatehouse({ provider: 'better-auth' } as any)
    expect(mod.name).toBe('gatehouse')
    expect(typeof mod.init).toBe('function')
  })

  it('init creates adapter and registers module', async () => {
    const { defineGatehouse } = await import('./index.js')
    const ctx = mockCtx()
    await defineGatehouse({ provider: 'better-auth' } as any).init!(ctx)
    expect(ctx.services.get).toHaveBeenCalledWith('vault')
    expect(mocks.mockBetterAuth).toHaveBeenCalled()
  })

  it('auto-wires auth messaging through courier when callbacks are omitted', async () => {
    const { defineGatehouse } = await import('./index.js')
    const emailSend = vi.fn().mockResolvedValue(undefined)
    const smsSend = vi.fn().mockResolvedValue(undefined)
    const ctx = mockCtx({
      services: {
        register: vi.fn(),
        registerFactory: vi.fn(),
        has: vi.fn((name: string) => name === 'courier'),
        get: vi.fn((name: string) => {
          if (name === 'vault') return { db: { selectFrom: vi.fn() } }
          if (name === 'courier') return { email: { send: emailSend }, sms: { send: smsSend } }
          return undefined
        }),
      },
    })

    await defineGatehouse({
      provider: 'better-auth',
      appName: 'Tower App',
      credentials: true,
      magicLinks: true,
      emailOtp: true,
      phoneNumber: true,
      emailVerification: { sendOnSignUp: true },
    } as any).init!(ctx)

    const opts = mocks.mockBetterAuth.mock.calls[0][0]
    await opts.emailAndPassword.sendResetPassword({
      user: { email: 'a@example.com', name: 'A' },
      url: 'https://app.example.com/reset',
      token: 'token',
    })
    await opts.emailVerification.sendVerificationEmail({
      user: { email: 'b@example.com', name: 'B' },
      url: 'https://app.example.com/verify',
      token: 'token',
    })

    const magicPlugin = opts.plugins.find((p: any) => p.id === 'magic-link')
    const emailOtpPlugin = opts.plugins.find((p: any) => p.id === 'email-otp')
    const phonePlugin = opts.plugins.find((p: any) => p.id === 'phone-number')
    await magicPlugin.sendMagicLink({ email: 'c@example.com', url: 'https://app.example.com/magic' })
    await emailOtpPlugin.sendVerificationOTP({ email: 'd@example.com', otp: '123456', type: 'sign-in' })
    await phonePlugin.sendOTP({ phoneNumber: '+15551234567', code: '654321' })

    expect(emailSend).toHaveBeenCalledTimes(4)
    expect(smsSend).toHaveBeenCalledTimes(1)
  })

  it('does not override explicit auth messaging callbacks', async () => {
    const { defineGatehouse } = await import('./index.js')
    const reset = vi.fn().mockResolvedValue(undefined)
    const magic = vi.fn().mockResolvedValue(undefined)
    const emailOtp = vi.fn().mockResolvedValue(undefined)
    const phoneOtp = vi.fn().mockResolvedValue(undefined)
    const verify = vi.fn().mockResolvedValue(undefined)

    const ctx = mockCtx({
      services: {
        register: vi.fn(),
        registerFactory: vi.fn(),
        has: vi.fn((name: string) => name === 'courier'),
        get: vi.fn((name: string) => {
          if (name === 'vault') return { db: { selectFrom: vi.fn() } }
          if (name === 'courier') return { email: { send: vi.fn() }, sms: { send: vi.fn() } }
          return undefined
        }),
      },
    })

    await defineGatehouse({
      provider: 'better-auth',
      credentials: { sendResetPassword: reset },
      magicLinks: { sendMagicLink: magic },
      emailOtp: { sendVerificationOTP: emailOtp },
      phoneNumber: { sendOTP: phoneOtp },
      emailVerification: { sendVerificationEmail: verify, sendOnSignUp: true },
    } as any).init!(ctx)

    const opts = mocks.mockBetterAuth.mock.calls[0][0]
    expect(opts.emailAndPassword.sendResetPassword).toBe(reset)
    expect(opts.emailVerification.sendVerificationEmail).toBe(verify)
    expect(opts.plugins.find((p: any) => p.id === 'magic-link').sendMagicLink).toBe(magic)
    expect(opts.plugins.find((p: any) => p.id === 'email-otp').sendVerificationOTP).toBe(emailOtp)
    expect(opts.plugins.find((p: any) => p.id === 'phone-number').sendOTP).toBe(phoneOtp)
  })
})

// ─── getAuth / getRoutes ──────────────────────────────────────

describe('getAuth / getRoutes', () => {
  beforeEach(() => {
    vi.resetModules()
    setupBetterAuthApi()
  })

  it('getAuth throws when uninitialized', async () => {
    const { getAuth } = await import('./index.js')
    expect(() => getAuth()).toThrow('Gatehouse not initialized')
  })

  it('getAuth returns adapter when initialized', async () => {
    const { defineGatehouse, getAuth } = await import('./index.js')
    await defineGatehouse({ provider: 'better-auth' } as any).init!(mockCtx())
    const auth = getAuth()
    expect(typeof auth.getSession).toBe('function')
  })

  it('getRoutes throws when uninitialized', async () => {
    const { getRoutes } = await import('./index.js')
    expect(() => getRoutes()).toThrow('Gatehouse not initialized')
  })

  it('getRoutes returns adapter routes when initialized', async () => {
    const { defineGatehouse, getRoutes } = await import('./index.js')
    await defineGatehouse({ provider: 'better-auth' } as any).init!(mockCtx())
    const routes = getRoutes()
    expect(typeof routes.GET).toBe('function')
    expect(typeof routes.POST).toBe('function')
  })
})

// ─── runWithRequest ───────────────────────────────────────────

describe('runWithRequest', () => {
  beforeEach(() => {
    vi.resetModules()
    setupBetterAuthApi()
  })

  it('throws when uninitialized', async () => {
    const { runWithRequest } = await import('./index.js')
    await expect(runWithRequest({ headers: new Headers() }, vi.fn())).rejects.toThrow('Gatehouse not initialized')
  })

  it('runs handler with ALS context', async () => {
    const { defineGatehouse, runWithRequest } = await import('./index.js')
    await defineGatehouse({ provider: 'better-auth' } as any).init!(mockCtx())

    const result = await runWithRequest({ headers: new Headers() }, async () => {
      const { gatehouse } = await import('./index.js')
      await (gatehouse as any).signIn.email({ email: 'a@b.com', password: 'pw' })
      return 'done'
    })
    expect(result).toBe('done')
  })
})

// ─── Gatehouse module-level exports ───────────────────────────

describe('Gatehouse module-level exports', () => {
  beforeEach(() => {
    vi.resetModules()
    setupBetterAuthApi()
  })

  it('Gatehouse.from throws when uninitialized', async () => {
    const mod = await import('./index.js')
    expect(() => mod.Gatehouse.from({ headers: new Headers() })).toThrow('Gatehouse not initialized')
  })

  it('Gatehouse.migrate throws when uninitialized', async () => {
    const mod = await import('./index.js')
    expect(() => mod.Gatehouse.migrate()).toThrow('Gatehouse not initialized')
  })

  it('Gatehouse.from delegates to adapter when initialized', async () => {
    const { defineGatehouse, Gatehouse } = await import('./index.js')
    await defineGatehouse({ provider: 'better-auth' } as any).init!(mockCtx())
    const instance = await Gatehouse.from({ headers: new Headers() })
    expect(typeof instance.session).toBe('function')
  })
})

// ─── Social provider expansion ────────────────────────────────

describe('social provider expansion', () => {
  beforeEach(() => {
    vi.resetModules()
    setupBetterAuthApi()
  })

  it('accepts array of provider names', async () => {
    const { BetterAuthAdapter } = await import('./providers/better-auth.js')
    process.env.GITHUB_CLIENT_ID = 'ghi'
    process.env.GITHUB_CLIENT_SECRET = 'ghs'
    const adapter = new (BetterAuthAdapter as any)(
      {
        provider: 'better-auth',
        social: ['github'],
      } as any,
      {}
    )
    await (adapter as any).init()

    const opts = mocks.mockBetterAuth.mock.calls[0][0]
    expect(opts.socialProviders.github).toBeDefined()
    expect(opts.socialProviders.github.clientId).toBe('ghi')
  })

  it('reads GATEHOUSE_, AUTH_ and BETTER_AUTH_ prefixed env vars', async () => {
    const { BetterAuthAdapter } = await import('./providers/better-auth.js')
    process.env.AUTH_GOOGLE_CLIENT_ID = 'g-id'
    process.env.GATEHOUSE_GOOGLE_CLIENT_SECRET = 'g-secret'
    const adapter = new (BetterAuthAdapter as any)(
      {
        provider: 'better-auth',
        social: ['google'],
      } as any,
      {}
    )
    await (adapter as any).init()

    const opts = mocks.mockBetterAuth.mock.calls[0][0]
    expect(opts.socialProviders.google.clientId).toBe('g-id')
    expect(opts.socialProviders.google.clientSecret).toBe('g-secret')
  })

  it('throws for missing provider credentials', async () => {
    const { BetterAuthAdapter } = await import('./providers/better-auth.js')
    await expect(
      (async () => {
        const adapter = new (BetterAuthAdapter as any)(
          {
            provider: 'better-auth',
            social: ['github'],
          } as any,
          {}
        )
        await (adapter as any).init()
      })()
    ).rejects.toThrow('Missing credentials')
  })

  afterEach(() => {
    delete process.env.GITHUB_CLIENT_ID
    delete process.env.GITHUB_CLIENT_SECRET
    delete process.env.AUTH_GOOGLE_CLIENT_ID
    delete process.env.GATEHOUSE_GOOGLE_CLIENT_SECRET
  })
})
