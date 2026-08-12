import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  mockRegisterService: vi.fn(),
  mockResolveConfig: vi.fn(),
  mockCreateTowerApp: vi.fn(),
}))

vi.mock('@towerjs/foundation', () => ({
  resolveConfig: mocks.mockResolveConfig,
  createTowerApp: mocks.mockCreateTowerApp,
  registerService: mocks.mockRegisterService,
  registerConfigProvider: vi.fn(),
}))

import { getTowerApp, initTower } from './runtime.js'

describe('getTowerApp / initTower caching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the cached app promise between tests.
    const APP_PROMISE_KEY = '___tower_app_promise___'
    delete (globalThis as any)[APP_PROMISE_KEY]
  })

  afterEach(() => {
    const APP_PROMISE_KEY = '___tower_app_promise___'
    delete (globalThis as any)[APP_PROMISE_KEY]
  })

  function makeApp(modules: Record<string, unknown> = {}) {
    const config = { modules }
    const container = {
      has: vi.fn(() => false),
      get: vi.fn((key: string) => (key === 'tower.config' ? config : undefined)),
    }
    return { config, container, runtime: { name: 'node-server' } }
  }

  it('caches the resolved app promise', async () => {
    mocks.mockResolveConfig.mockResolvedValue({ modules: {} })
    mocks.mockCreateTowerApp.mockResolvedValue(makeApp())

    const app1 = await getTowerApp()
    const app2 = await getTowerApp()

    expect(app1).toBe(app2)
    expect(mocks.mockResolveConfig).toHaveBeenCalledTimes(1)
  })

  it('does not cache a rejected promise — allows retry (Fixes #17)', async () => {
    mocks.mockResolveConfig.mockRejectedValueOnce(new Error('config discovery failed'))
    mocks.mockResolveConfig.mockResolvedValueOnce({ modules: {} })
    mocks.mockCreateTowerApp.mockResolvedValue(makeApp())

    await expect(getTowerApp()).rejects.toThrow('config discovery failed')
    // Second call should retry instead of returning the cached rejection.
    const app = await getTowerApp()
    expect(app).toBeDefined()
    expect(mocks.mockResolveConfig).toHaveBeenCalledTimes(2)
  })

  it('initTower caches its promise', async () => {
    mocks.mockResolveConfig.mockResolvedValue({ modules: {} })
    mocks.mockCreateTowerApp.mockResolvedValue(makeApp())

    const app1 = await initTower()
    const app2 = await initTower()

    expect(app1).toBe(app2)
    expect(mocks.mockCreateTowerApp).toHaveBeenCalledTimes(1)
  })
})
