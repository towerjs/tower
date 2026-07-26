import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

const mockHeaders = vi.fn()
const mockGatehouseFrom = vi.fn()
const mockTowerContextRun = vi.fn()
const mockGetTowerApp = vi.fn()

vi.mock('next/headers', () => ({
  headers: mockHeaders,
}))

vi.mock('@towerjs/gatehouse', () => ({
  Gatehouse: { from: mockGatehouseFrom },
}))

vi.mock('@towerjs/blueprint', () => ({
  towerContext: {
    run: mockTowerContextRun,
    get: vi.fn(),
  },
}))

vi.mock('./runtime', () => ({
  getTowerApp: mockGetTowerApp,
}))

beforeAll(() => {
  mockGetTowerApp.mockResolvedValue(undefined)
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('action wrapper', () => {
  it('normalizes FormData to a plain object', async () => {
    const { action } = await import('./next')
    const handler = vi.fn()
    const wrapped = action(handler)

    mockHeaders.mockResolvedValue(new Headers())
    mockGatehouseFrom.mockResolvedValue({})
    mockTowerContextRun.mockImplementation((_data: any, fn: () => any) => fn())

    const fd = new FormData()
    fd.set('email', 'a@b.com')
    fd.set('name', 'Alice')

    await wrapped(fd)

    expect(handler).toHaveBeenCalledWith({ email: 'a@b.com', name: 'Alice' })
  })

  it('passes non-FormData args through unchanged', async () => {
    const { action } = await import('./next')

    const handler = vi.fn()
    const wrapped = action(handler)

    mockHeaders.mockResolvedValue(new Headers())
    mockGatehouseFrom.mockResolvedValue({})
    mockTowerContextRun.mockImplementation((_data: any, fn: () => any) => fn())

    await wrapped({ userId: 42, role: 'admin' })

    expect(handler).toHaveBeenCalledWith({ userId: 42, role: 'admin' })
  })

  it('handles empty FormData gracefully', async () => {
    const { action } = await import('./next')

    const handler = vi.fn()
    const wrapped = action(handler)

    mockHeaders.mockResolvedValue(new Headers())
    mockGatehouseFrom.mockResolvedValue({})
    mockTowerContextRun.mockImplementation((_data: any, fn: () => any) => fn())

    const fd = new FormData()
    await wrapped(fd)

    expect(handler).toHaveBeenCalledWith({})
  })

  it('passes gatehouse instance into tower context', async () => {
    const { action } = await import('./next')

    const handler = vi.fn()
    const wrapped = action(handler)

    const mockGh = { test: true }
    mockHeaders.mockResolvedValue(new Headers())
    mockGatehouseFrom.mockResolvedValue(mockGh)
    mockTowerContextRun.mockImplementation((_data: any, fn: () => any) => fn())

    await wrapped({ key: 'val' })

    expect(mockGatehouseFrom).toHaveBeenCalled()
    expect(mockTowerContextRun).toHaveBeenCalled()
    const contextData = mockTowerContextRun.mock.calls[0][0]
    expect(contextData.gatehouse).toBe(mockGh)
  })
})
