import { describe, it, expect, vi } from 'vitest'

// The alias in vitest.config.ts maps @towerjs/gatehouse/next to
// packages/gatehouse/src/frameworks/next.ts, which imports from
// next/headers. Mock next/headers so the module graph resolves.
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}))

vi.mock('../runtime', () => ({
  getTowerApp: vi.fn(),
}))

describe('gatehouse/next re-exports', () => {
  it('re-exports expected symbols', async () => {
    const mod = await import('./next')
    expect(typeof mod.action).toBe('function')
    expect(typeof mod.withGatehouse).toBe('function')
    expect(typeof mod.GET).toBe('function')
    expect(typeof mod.POST).toBe('function')
    expect(typeof mod.signIn).toBe('function')
    expect(typeof mod.signUp).toBe('function')
    expect(typeof mod.signOut).toBe('function')
  })
})
