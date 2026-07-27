import { describe, it, expect, vi } from 'vitest'

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

vi.mock('../runtime', () => ({
  getTowerApp: mockGetTowerApp,
}))

vi.mock('@towerjs/gatehouse', () => ({
  Gatehouse: { from: mockGatehouseFrom },
}))

describe('signIn', () => {
  it('redirects to /dashboard on success', async () => {
    const { signIn } = await import('./actions')

    mockGetTowerApp.mockResolvedValue(undefined)
    mockHeaders.mockResolvedValue(new Headers())
    mockCookies.mockResolvedValue({ set: vi.fn() })
    mockGatehouseFrom.mockResolvedValue({
      signIn: { email: vi.fn().mockResolvedValue({ session: { token: 'abc' } }) },
    })

    const fd = new FormData()
    fd.set('email', 'a@b.com')
    fd.set('password', 'secret')

    await signIn(fd)

    expect(mockRedirect).toHaveBeenCalledWith('/dashboard')
  })

  it('formData redirectTo overrides default', async () => {
    const { signIn } = await import('./actions')

    mockGetTowerApp.mockResolvedValue(undefined)
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

  it('sets session cookie on successful sign in', async () => {
    const { signIn } = await import('./actions')

    mockGetTowerApp.mockResolvedValue(undefined)
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
  it('clears session cookie and redirects to /sign-in', async () => {
    const { signOut } = await import('./actions')

    mockGetTowerApp.mockResolvedValue(undefined)
    const cookieSet = vi.fn()
    mockHeaders.mockResolvedValue(new Headers())
    mockCookies.mockResolvedValue({ set: cookieSet })
    mockGatehouseFrom.mockResolvedValue({
      sessions: { signOut: vi.fn().mockResolvedValue(undefined) },
    })

    await signOut()

    expect(cookieSet).toHaveBeenCalledWith('better-auth.session_token', '', expect.objectContaining({ maxAge: 0 }))
    expect(mockRedirect).toHaveBeenCalledWith('/sign-in')
  })
})
