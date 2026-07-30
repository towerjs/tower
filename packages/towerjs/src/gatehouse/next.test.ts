import { describe, it, expect, vi } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}))

vi.mock('../runtime', () => ({
  getTowerApp: vi.fn(),
}))

describe('gatehouse/next exports', () => {
  it('exports expected symbols', async () => {
    const mod = await import('./next')
    expect(typeof mod.action).toBe('function')
    expect(typeof mod.withGatehouse).toBe('function')
    expect(typeof mod.GET).toBe('function')
    expect(typeof mod.POST).toBe('function')
  })
})
