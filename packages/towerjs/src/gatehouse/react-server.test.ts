import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const headers = vi.fn()
  const resolver = vi.fn()
  const getTowerApp = vi.fn()
  const importModule = vi.fn()
  return { headers, resolver, getTowerApp, importModule }
})

vi.mock('next/headers', () => ({
  headers: mocks.headers,
}))

vi.mock('@towerjs/foundation', () => ({
  setRequestContextResolver: mocks.resolver,
}))

vi.mock('../runtime', () => ({
  getTowerApp: mocks.getTowerApp,
  importModule: mocks.importModule,
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

describe('towerjs/gatehouse react-server variant', () => {
  it('registers a request context resolver at module load', async () => {
    await import('./react-server')
    expect(mocks.resolver).toHaveBeenCalledTimes(1)
    expect(typeof mocks.resolver.mock.calls[0][0]).toBe('function')
  })

  it('resolves headers from next/headers through the resolver', async () => {
    const fakeHeaders = new Headers({ cookie: 'session=abc' })
    mocks.headers.mockResolvedValue(fakeHeaders)

    await import('./react-server')
    const resolver = mocks.resolver.mock.calls[0][0]
    const result = await resolver()

    expect(result.headers).toBe(fakeHeaders)
  })

  it('marks the route dynamic and initializes the app before delegating', async () => {
    const fakeHeaders = new Headers({ cookie: 'session=abc' })
    mocks.headers.mockResolvedValue(fakeHeaders)
    mocks.getTowerApp.mockResolvedValue(undefined)
    const getSession = vi.fn().mockResolvedValue({ user: { id: 'u1' }, session: {} })
    mocks.importModule.mockResolvedValue({ gatehouse: { getSession } })

    const { gatehouse } = await import('./react-server')
    const session = await gatehouse.getSession()

    expect(mocks.headers).toHaveBeenCalled()
    expect(mocks.getTowerApp).toHaveBeenCalled()
    expect(session).toEqual({ user: { id: 'u1' }, session: {} })
  })
})
