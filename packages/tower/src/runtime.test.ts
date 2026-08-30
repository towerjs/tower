import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getTowerApp, initTower, registerTowerConfigProvider } from './runtime.js'

const mocks = vi.hoisted(() => ({
  mockResolveConfig: vi.fn(),
  mockCreateTowerApp: vi.fn(),
}))

vi.mock('./foundation/app.js', async (importOriginal) => {
  const actual = (await importOriginal()) as any
  return {
    ...actual,
    createTowerApp: mocks.mockCreateTowerApp,
  }
})

describe('getTowerApp / initTower caching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete (globalThis as any).___tower_default_application___
    registerTowerConfigProvider(mocks.mockResolveConfig)
  })

  afterEach(() => {
    delete (globalThis as any).___tower_default_application___
  })

  function makeApp(modules: unknown[] = []) {
    const config = { modules } as any
    const container = {
      has: vi.fn(() => false),
      get: vi.fn((key: string) => (key === 'tower.config' ? config : undefined)),
    }
    return { config, container, runtime: { name: 'node-server' } }
  }

  it('caches the resolved app promise', async () => {
    mocks.mockResolveConfig.mockResolvedValue({ modules: [] })
    mocks.mockCreateTowerApp.mockResolvedValue(makeApp())

    const app1 = await getTowerApp()
    const app2 = await getTowerApp()

    expect(app1).toBe(app2)
    expect(mocks.mockResolveConfig).toHaveBeenCalledTimes(1)
  })

  it('does not cache a rejected promise — allows retry (Fixes #17)', async () => {
    mocks.mockResolveConfig.mockRejectedValueOnce(new Error('config discovery failed'))
    mocks.mockResolveConfig.mockResolvedValueOnce({ modules: [] })
    mocks.mockCreateTowerApp.mockResolvedValue(makeApp())

    await expect(getTowerApp()).rejects.toThrow('config discovery failed')
    // Second call should retry instead of returning the cached rejection.
    const app = await getTowerApp()
    expect(app).toBeDefined()
    expect(mocks.mockResolveConfig).toHaveBeenCalledTimes(2)
  })

  it('initTower caches its promise', async () => {
    mocks.mockResolveConfig.mockResolvedValue({ modules: [] })
    mocks.mockCreateTowerApp.mockResolvedValue(makeApp())

    const app1 = await initTower()
    const app2 = await initTower()

    expect(app1).toBe(app2)
    expect(mocks.mockCreateTowerApp).toHaveBeenCalledTimes(1)
  })
})
