import { describe, it, expect, vi, beforeAll } from 'vitest'

const mockHeaders = vi.fn()
const mockCookies = vi.fn()
const mockRedirect = vi.fn()
const mockGatehouseFrom = vi.fn()
const mockGetTowerApp = vi.fn()

vi.mock('next/headers', () => ({
  headers: mockHeaders,
  cookies: mockCookies,
}))

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}))

vi.mock('@towerjs/gatehouse', () => ({
  Gatehouse: { from: mockGatehouseFrom },
}))

vi.mock('../runtime', () => ({
  getTowerApp: mockGetTowerApp,
}))

const mockConfig = (redirects?: Record<string, string>) => ({
  config: {
    modules: {
      gatehouse: redirects ? { redirects } : {},
    },
  },
})

beforeAll(() => {
  mockGetTowerApp.mockResolvedValue(mockConfig())
})

describe('signIn', () => {
  it('redirects to Blueprint-configured afterSignIn path', async () => {
    mockGetTowerApp.mockResolvedValue(mockConfig({ afterSignIn: '/app', afterSignUp: '/welcome', afterSignOut: '/' }))

    const { signIn } = await import('./actions')

    mockHeaders.mockResolvedValue(new Headers())
    mockCookies.mockResolvedValue({ set: vi.fn() })
    mockGatehouseFrom.mockResolvedValue({
      signIn: { email: vi.fn().mockResolvedValue({ session: { token: 'abc' } }) },
    })

    const fd = new FormData()
    fd.set('email', 'a@b.com')
    fd.set('password', 'secret')

    await signIn(fd)

    expect(mockRedirect).toHaveBeenCalledWith('/app')
  })

  it('formData redirectTo overrides Blueprint config', async () => {
    mockGetTowerApp.mockResolvedValue(mockConfig({ afterSignIn: '/app' }))

    const { signIn } = await import('./actions')

    mockHeaders.mockResolvedValue(new Headers())
    mockCookies.mockResolvedValue({ set: vi.fn() })
    mockGatehouseFrom.mockResolvedValue({
      signIn: { email: vi.fn().mockResolvedValue({}) },
    })

    const fd = new FormData()
    fd.set('email', 'a@b.com')
    fd.set('password', 'secret')
    fd.set('redirectTo', '/custom')

    await signIn(fd)

    expect(mockRedirect).toHaveBeenCalledWith('/custom')
  })

  it('falls back to /dashboard when no config or formData', async () => {
    mockGetTowerApp.mockResolvedValue(mockConfig())

    const { signIn } = await import('./actions')

    mockHeaders.mockResolvedValue(new Headers())
    mockCookies.mockResolvedValue({ set: vi.fn() })
    mockGatehouseFrom.mockResolvedValue({
      signIn: { email: vi.fn().mockResolvedValue({}) },
    })

    const fd = new FormData()
    fd.set('email', 'a@b.com')
    fd.set('password', 'secret')

    await signIn(fd)

    expect(mockRedirect).toHaveBeenCalledWith('/dashboard')
  })

  it('sets session cookie on successful sign in', async () => {
    mockGetTowerApp.mockResolvedValue(mockConfig())

    const { signIn } = await import('./actions')

    const cookieSet = vi.fn()
    mockHeaders.mockResolvedValue(new Headers())
    mockCookies.mockResolvedValue({ set: cookieSet })
    mockGatehouseFrom.mockResolvedValue({
      signIn: { email: vi.fn().mockResolvedValue({ session: { token: 'xyz789' } }) },
    })

    const fd = new FormData()
    fd.set('email', 'a@b.com')
    fd.set('password', 'secret')

    await signIn(fd)

    expect(cookieSet).toHaveBeenCalledWith(
      'better-auth.session_token',
      'xyz789',
      expect.objectContaining({ httpOnly: true, path: '/' })
    )
  })
})

describe('signOut', () => {
  it('clears session cookie and redirects to afterSignOut', async () => {
    mockGetTowerApp.mockResolvedValue(mockConfig({ afterSignOut: '/' }))

    const { signOut } = await import('./actions')

    const cookieSet = vi.fn()
    mockHeaders.mockResolvedValue(new Headers())
    mockCookies.mockResolvedValue({ set: cookieSet })
    mockGatehouseFrom.mockResolvedValue({
      sessions: { signOut: vi.fn().mockResolvedValue(undefined) },
    })

    await signOut()

    expect(cookieSet).toHaveBeenCalledWith('better-auth.session_token', '', expect.objectContaining({ maxAge: 0 }))
    expect(mockRedirect).toHaveBeenCalledWith('/')
  })
})
