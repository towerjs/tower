import { describe, it, expect, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => {
  const alsStore: Record<string, any> = {}
  const mockCookiesSet = vi.fn()
  const mockCookiesGet = vi.fn()
  const mockCookiesToString = vi.fn(() => "")
  const mockSignInEmail = vi.fn()
  const mockSignUpEmail = vi.fn()
  const mockSignOut = vi.fn()
  const mockSession = vi.fn()
  const mockGatehouseFrom = vi.fn()
  const mockTowerContextRun = vi.fn(async (ctx: any, handler: () => any) => {
    const prev = { ...alsStore }
    Object.assign(alsStore, ctx)
    try { return await handler() }
    finally { Object.assign(alsStore, prev) }
  })
  const mockGetAuth = vi.fn()
  const mockGetRoutes = vi.fn()
  const mockRunWithRequest = vi.fn()

  return {
    alsStore,
    mockCookies: vi.fn(() => ({
      set: mockCookiesSet,
      get: mockCookiesGet,
      toString: mockCookiesToString,
    })),
    mockHeaders: vi.fn(() => new Headers()),
    mockTowerContextRun,
    mockSignInEmail, mockSignUpEmail, mockSignOut, mockSession,
    mockGatehouseFrom, mockCookiesSet, mockCookiesGet, mockCookiesToString,
    mockGetAuth, mockGetRoutes, mockRunWithRequest,
  }
})

vi.mock("next/headers", () => ({
  cookies: mocks.mockCookies,
  headers: mocks.mockHeaders,
}))

vi.mock("@towerjs/blueprint", () => ({
  towerContext: {
    get: vi.fn((key: string) => mocks.alsStore[key]),
    run: mocks.mockTowerContextRun,
  },
}))

vi.mock("../index.js", () => ({
  runWithRequest: mocks.mockRunWithRequest,
  getAuth: mocks.mockGetAuth,
  getRoutes: mocks.mockGetRoutes,
  Gatehouse: { from: mocks.mockGatehouseFrom },
}))

describe("action", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function mockGatehouseInstance() {
    return {
      signIn: { email: mocks.mockSignInEmail },
      signUp: { email: mocks.mockSignUpEmail },
      sessions: { signOut: mocks.mockSignOut },
      session: mocks.mockSession,
    }
  }

  it("wraps handler and runs it via towerContext.run", async () => {
    mocks.mockGatehouseFrom.mockResolvedValue(mockGatehouseInstance())

    const { action } = await import("./next-js.js")
    const handler = vi.fn().mockResolvedValue(undefined)
    const wrapped = action(handler)

    await wrapped()

    expect(mocks.mockTowerContextRun).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledOnce()
  })

  it("does not set cookie when no auth change occurs", async () => {
    mocks.mockGatehouseFrom.mockResolvedValue(mockGatehouseInstance())

    const { action } = await import("./next-js.js")
    const handler = vi.fn().mockResolvedValue(undefined)
    const wrapped = action(handler)

    await wrapped()

    expect(mocks.mockCookiesSet).not.toHaveBeenCalled()
  })

  it("sets session cookie after signIn.email", async () => {
    mocks.mockGatehouseFrom.mockResolvedValue(mockGatehouseInstance())
    mocks.mockSignInEmail.mockResolvedValue({
      user: { id: "u1", name: "Alice", email: "a@b.com" },
      session: { id: "s1", token: "tok123" },
    })

    const { action } = await import("./next-js.js")
    const handler = vi.fn(async () => {
      const gh = mocks.alsStore.gatehouse
      await gh.signIn.email({ email: "a@b.com", password: "pw" })
    })
    const wrapped = action(handler)

    await wrapped()

    expect(mocks.mockCookiesSet).toHaveBeenCalledWith(
      "better-auth.session_token", "tok123",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", maxAge: 604800 }),
    )
  })

  it("sets session cookie after signUp.email", async () => {
    mocks.mockGatehouseFrom.mockResolvedValue(mockGatehouseInstance())
    mocks.mockSignUpEmail.mockResolvedValue({
      user: { id: "u2", name: "Bob", email: "b@b.com" },
      session: { id: "s2", token: "tok456" },
    })

    const { action } = await import("./next-js.js")
    const handler = vi.fn(async () => {
      const gh = mocks.alsStore.gatehouse
      await gh.signUp.email({ name: "Bob", email: "b@b.com", password: "pw" })
    })
    const wrapped = action(handler)

    await wrapped()

    expect(mocks.mockCookiesSet).toHaveBeenCalledWith(
      "better-auth.session_token", "tok456",
      expect.objectContaining({ httpOnly: true, sameSite: "lax" }),
    )
  })

  it("clears session cookie after signOut", async () => {
    mocks.mockGatehouseFrom.mockResolvedValue(mockGatehouseInstance())

    const { action } = await import("./next-js.js")
    const handler = vi.fn(async () => {
      const gh = mocks.alsStore.gatehouse
      await gh.sessions.signOut()
    })
    const wrapped = action(handler)

    await wrapped()

    expect(mocks.mockCookiesSet).toHaveBeenCalledWith(
      "better-auth.session_token", "",
      expect.objectContaining({ maxAge: 0 }),
    )
  })

  it("uses custom session cookie name from config", async () => {
    mocks.mockGatehouseFrom.mockResolvedValue(mockGatehouseInstance())
    mocks.mockSignInEmail.mockResolvedValue({
      user: { id: "u1", name: "Alice", email: "a@b.com" },
      session: { id: "s1", token: "tok789" },
    })

    const { action } = await import("./next-js.js")
    const handler = vi.fn(async () => {
      const gh = mocks.alsStore.gatehouse
      await gh.signIn.email({ email: "a@b.com", password: "pw" })
    })
    const wrapped = action(handler, { sessionCookie: "my_app.session" })

    await wrapped()

    expect(mocks.mockCookiesSet).toHaveBeenCalledWith(
      "my_app.session", "tok789",
      expect.any(Object),
    )
  })

  it("passes handler arguments through", async () => {
    mocks.mockGatehouseFrom.mockResolvedValue(mockGatehouseInstance())

    const { action } = await import("./next-js.js")
    const handler = vi.fn().mockResolvedValue(undefined)
    const wrapped = action(handler)

    await wrapped("arg1", "arg2")

    expect(handler).toHaveBeenCalledWith("arg1", "arg2")
  })
})

describe("getSession", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns session from cookie", async () => {
    mocks.mockCookiesToString.mockReturnValue("better-auth.session_token=abc123")
    mocks.mockSession.mockResolvedValue({
      user: { id: "u1", name: "Alice", email: "a@b.com" },
      session: { id: "s1", token: "abc123" },
    })

    const { getSession } = await import("./next-js.js")
    const session = await getSession()

    expect(session).not.toBeNull()
    expect(session!.user.name).toBe("Alice")
    expect(session!.session.token).toBe("abc123")
  })

  it("returns null when no session", async () => {
    mocks.mockCookiesToString.mockReturnValue("")
    mocks.mockSession.mockResolvedValue(null)

    const { getSession } = await import("./next-js.js")
    const session = await getSession()

    expect(session).toBeNull()
  })
})

describe("withGatehouse", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("sets Set-Cookie header when a new session is created", async () => {
    const mockGetSession = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        user: { id: "u1", name: "Alice", email: "a@b.com", emailVerified: true, image: null, createdAt: new Date(), updatedAt: new Date() },
        session: { id: "s1", userId: "u1", expiresAt: new Date(), token: "tok123" },
      })
    mocks.mockGetAuth.mockReturnValue({ getSession: mockGetSession })
    mocks.mockRunWithRequest.mockImplementation(async (_req, handler) => handler())

    const { withGatehouse } = await import("./next-js.js")
    const handler = vi.fn().mockResolvedValue(new Response())
    const wrapped = withGatehouse(handler)
    const req = new Request("https://example.com/api/auth/sign-in")
    const resp = await wrapped(req, { params: Promise.resolve({}) })

    expect(resp.headers.get("Set-Cookie")).toContain("tok123")
    expect(resp.headers.get("Set-Cookie")).toContain("HttpOnly")
    expect(resp.headers.get("Set-Cookie")).toContain("SameSite=Lax")
    expect(resp.headers.get("Set-Cookie")).toContain("Path=/")
  })

  it("clears Set-Cookie when session ends", async () => {
    const mockGetSession = vi.fn()
      .mockResolvedValueOnce({
        user: { id: "u1", name: "Alice", email: "a@b.com", emailVerified: true, image: null, createdAt: new Date(), updatedAt: new Date() },
        session: { id: "s1", userId: "u1", expiresAt: new Date(), token: "tok123" },
      })
      .mockResolvedValueOnce(null)
    mocks.mockGetAuth.mockReturnValue({ getSession: mockGetSession })
    mocks.mockRunWithRequest.mockImplementation(async (_req, handler) => handler())

    const { withGatehouse } = await import("./next-js.js")
    const handler = vi.fn().mockResolvedValue(new Response())
    const wrapped = withGatehouse(handler)
    const req = new Request("https://example.com/api/auth/sign-out")
    const resp = await wrapped(req, { params: Promise.resolve({}) })

    expect(resp.headers.get("Set-Cookie")).toContain("better-auth.session_token=")
    expect(resp.headers.get("Set-Cookie")).toContain("Max-Age=0")
  })

  it("does not set Set-Cookie when session is unchanged", async () => {
    const session = {
      user: { id: "u1", name: "Alice", email: "a@b.com", emailVerified: true, image: null, createdAt: new Date(), updatedAt: new Date() },
      session: { id: "s1", userId: "u1", expiresAt: new Date(), token: "tok123" },
    }
    const mockGetSession = vi.fn()
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce(session)
    mocks.mockGetAuth.mockReturnValue({ getSession: mockGetSession })
    mocks.mockRunWithRequest.mockImplementation(async (_req, handler) => handler())

    const { withGatehouse } = await import("./next-js.js")
    const handler = vi.fn().mockResolvedValue(new Response())
    const wrapped = withGatehouse(handler)
    const req = new Request("https://example.com/api/protected")
    const resp = await wrapped(req, { params: Promise.resolve({}) })

    expect(resp.headers.get("Set-Cookie")).toBeNull()
  })

  it("wraps handler with runWithRequest", async () => {
    const mockGetSession = vi.fn().mockResolvedValue(null)
    mocks.mockGetAuth.mockReturnValue({ getSession: mockGetSession })
    mocks.mockRunWithRequest.mockImplementation(async (_req, handler) => handler())

    const { withGatehouse } = await import("./next-js.js")
    const handler = vi.fn().mockResolvedValue(new Response())
    const wrapped = withGatehouse(handler)
    const req = new Request("https://example.com/")
    await wrapped(req, { params: Promise.resolve({}) })

    expect(mocks.mockRunWithRequest).toHaveBeenCalledWith(req, expect.any(Function))
  })

  it("uses custom cookie name in Set-Cookie", async () => {
    const mockGetSession = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        user: { id: "u1", name: "Alice", email: "a@b.com", emailVerified: true, image: null, createdAt: new Date(), updatedAt: new Date() },
        session: { id: "s1", userId: "u1", expiresAt: new Date(), token: "tok999" },
      })
    mocks.mockGetAuth.mockReturnValue({ getSession: mockGetSession })
    mocks.mockRunWithRequest.mockImplementation(async (_req, handler) => handler())

    const { withGatehouse } = await import("./next-js.js")
    const handler = vi.fn().mockResolvedValue(new Response())
    const wrapped = withGatehouse(handler, { sessionCookie: "my_custom.session" })
    const req = new Request("https://example.com/")
    const resp = await wrapped(req, { params: Promise.resolve({}) })

    expect(resp.headers.get("Set-Cookie")).toContain("my_custom.session=tok999")
  })
})

describe("GET / POST route handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("GET delegates to routes.GET", async () => {
    const mockGet = vi.fn().mockResolvedValue(new Response())
    mocks.mockGetRoutes.mockReturnValue({ GET: mockGet, POST: vi.fn() })

    const { GET } = await import("./next-js.js")
    const req = new Request("https://example.com/api/auth/user")
    await GET(req)

    expect(mockGet).toHaveBeenCalledWith(req)
  })

  it("POST delegates to routes.POST", async () => {
    const mockPost = vi.fn().mockResolvedValue(new Response())
    mocks.mockGetRoutes.mockReturnValue({ GET: vi.fn(), POST: mockPost })

    const { POST } = await import("./next-js.js")
    const req = new Request("https://example.com/api/auth/sign-in", { method: "POST" })
    await POST(req)

    expect(mockPost).toHaveBeenCalledWith(req)
  })
})
