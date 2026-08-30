import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const alsStore: Record<string, any> = {}
  const mockGatehouseFrom = vi.fn()
  const mockTowerContextRun = vi.fn(async (ctx: any, handler: () => any) => {
    const prev = { ...alsStore }
    Object.assign(alsStore, ctx)
    try {
      return await handler()
    } finally {
      Object.assign(alsStore, prev)
    }
  })
  const mockGetRoutes = vi.fn()

  return {
    alsStore,
    mockHeaders: vi.fn(() => new Headers()),
    mockTowerContextRun,
    mockGatehouseFrom,
    mockGetRoutes,
  }
})

vi.mock('next/headers', () => ({
  headers: mocks.mockHeaders,
}))

vi.mock('@towerjs/foundation', () => ({
  towerContext: {
    get: vi.fn((key: string) => mocks.alsStore[key]),
    run: mocks.mockTowerContextRun,
  },
  setRequestContextResolver: vi.fn(),
}))

vi.mock('@towerjs/tower/foundation', () => ({
  towerContext: {
    get: vi.fn((key: string) => mocks.alsStore[key]),
    run: mocks.mockTowerContextRun,
  },
  setRequestContextResolver: vi.fn(),
}))

vi.mock('@towerjs/tower/runtime', () => ({
  getTowerApp: vi.fn().mockResolvedValue({}),
  initTower: vi.fn().mockResolvedValue({}),
}))

vi.mock('@towerjs/tower/runtime/node', () => ({
  installNodeContext: vi.fn(),
}))

vi.mock('next/headers.js', () => ({
  headers: vi.fn(() => new Headers()),
}))

vi.mock('../index.js', () => ({
  getRoutes: mocks.mockGetRoutes,
  Gatehouse: { from: mocks.mockGatehouseFrom },
}))

function mockGatehouseInstance() {
  return {
    signIn: { email: vi.fn() },
    signUp: { email: vi.fn() },
    sessions: { signOut: vi.fn() },
    session: vi.fn(),
  }
}

describe('action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('wraps handler and runs it via towerContext.run', async () => {
    mocks.mockGatehouseFrom.mockResolvedValue(mockGatehouseInstance())

    const { action } = await import('./next.js')
    const handler = vi.fn().mockResolvedValue(undefined)
    const wrapped = action(handler)

    await wrapped()

    expect(mocks.mockTowerContextRun).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledOnce()
  })

  it('exposes gatehouse instance via ALS context', async () => {
    const instance = mockGatehouseInstance()
    mocks.mockGatehouseFrom.mockResolvedValue(instance)

    const { action } = await import('./next.js')
    let captured: any
    const handler = vi.fn(async () => {
      captured = mocks.alsStore.gatehouse
    })
    const wrapped = action(handler)

    await wrapped()

    expect(captured).toBe(instance)
  })

  it('passes handler arguments through', async () => {
    mocks.mockGatehouseFrom.mockResolvedValue(mockGatehouseInstance())

    const { action } = await import('./next.js')
    const handler = vi.fn().mockResolvedValue(undefined)
    const wrapped = action(handler)

    await wrapped('arg1', 'arg2')

    expect(handler).toHaveBeenCalledWith('arg1', 'arg2')
  })
})

describe('action.form', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('extracts FormData and passes as object to handler', async () => {
    mocks.mockGatehouseFrom.mockResolvedValue(mockGatehouseInstance())

    const { action } = await import('./next.js')
    const handler = vi.fn().mockResolvedValue(undefined)
    const wrapped = action.form(handler)

    const formData = new FormData()
    formData.append('email', 'a@b.com')
    formData.append('password', 'secret123')
    const result = await wrapped(undefined, formData)

    expect(handler).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret123' })
    expect(result).toEqual({ ok: true })
  })

  it('sets up gatehouse context via ALS', async () => {
    const instance = mockGatehouseInstance()
    mocks.mockGatehouseFrom.mockResolvedValue(instance)

    const { action } = await import('./next.js')
    let captured: any
    const wrapped = action.form(async (_data) => {
      captured = mocks.alsStore.gatehouse
    })

    const formData = new FormData()
    await wrapped(undefined, formData)

    expect(captured).toBe(instance)
  })

  it('catches handler errors and returns error result', async () => {
    mocks.mockGatehouseFrom.mockResolvedValue(mockGatehouseInstance())

    const { action } = await import('./next.js')
    const wrapped = action.form(async () => {
      throw new Error('Email already taken')
    })

    const formData = new FormData()
    const result = await wrapped(undefined, formData)

    expect(result).toEqual({ error: 'Email already taken' })
  })

  it('only includes string values from FormData', async () => {
    mocks.mockGatehouseFrom.mockResolvedValue(mockGatehouseInstance())

    const { action } = await import('./next.js')
    const handler = vi.fn()
    const wrapped = action.form(handler)

    const formData = new FormData()
    formData.append('name', 'Jane')
    formData.append('file', new Blob(['data']), 'test.txt')
    await wrapped(undefined, formData)

    expect(handler).toHaveBeenCalledWith({ name: 'Jane' })
  })
})

describe('withGatehouse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('wraps handler and runs it via towerContext.run', async () => {
    mocks.mockGatehouseFrom.mockResolvedValue({
      signIn: { email: vi.fn() },
      signUp: { email: vi.fn() },
      sessions: { signOut: vi.fn() },
      session: vi.fn(),
    })

    const { withGatehouse } = await import('./next.js')
    const handler = vi.fn().mockResolvedValue(new Response())
    const wrapped = withGatehouse(handler)
    const req = new Request('https://example.com/')
    await wrapped(req, { params: Promise.resolve({}) })

    expect(mocks.mockTowerContextRun).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledOnce()
  })

  it('creates gatehouse from request headers', async () => {
    const instance = {
      signIn: { email: vi.fn() },
      signUp: { email: vi.fn() },
      sessions: { signOut: vi.fn() },
      session: vi.fn(),
    }
    mocks.mockGatehouseFrom.mockResolvedValue(instance)

    const { withGatehouse } = await import('./next.js')
    const handler = vi.fn().mockResolvedValue(new Response())
    const wrapped = withGatehouse(handler)
    const req = new Request('https://example.com/')
    await wrapped(req, { params: Promise.resolve({}) })

    expect(mocks.mockGatehouseFrom).toHaveBeenCalledWith({ headers: req.headers })
  })
})

describe('GET / POST route handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET delegates to routes.GET', async () => {
    const mockGet = vi.fn().mockResolvedValue(new Response())
    mocks.mockGetRoutes.mockReturnValue({ GET: mockGet, POST: vi.fn() })

    const { GET } = await import('./next.js')
    const req = new Request('https://example.com/api/auth/user')
    await GET(req)

    expect(mockGet).toHaveBeenCalledWith(req)
  })

  it('POST delegates to routes.POST', async () => {
    const mockPost = vi.fn().mockResolvedValue(new Response())
    mocks.mockGetRoutes.mockReturnValue({ GET: vi.fn(), POST: mockPost })

    const { POST } = await import('./next.js')
    const req = new Request('https://example.com/api/auth/sign-in', { method: 'POST' })
    await POST(req)

    expect(mockPost).toHaveBeenCalledWith(req)
  })
})
