import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getModuleFactory, registerModule } from '../blueprint/index.js'
import { resetModuleFactories } from '../blueprint/internal.js'
import { createTower } from './app.js'

const mocks = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('node:fs')
  return { ...actual, existsSync: mocks.mockExistsSync }
})

describe('createTower with auto-discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    resetModuleFactories()
  })

  it('throws when no tower.config found', async () => {
    mocks.mockExistsSync.mockReturnValue(false)

    await expect(createTower()).rejects.toThrow('Could not find tower.config')
  })

  it('accepts explicit config and skips discovery', async () => {
    registerModule('test', () => ({
      name: 'test',
      async init() {},
    }))

    const result = await createTower({ modules: { test: {} } }, getModuleFactory)

    expect(result).toBeDefined()
    expect(mocks.mockExistsSync).not.toHaveBeenCalled()
  })

  it('returns TowerApp with runtime and container', async () => {
    registerModule('alpha', () => ({
      name: 'alpha',
      async init(ctx: any) {
        ctx.container.register('alpha', { val: 1 })
      },
    }))

    const result = await createTower({ modules: { alpha: {} } }, getModuleFactory)

    expect(result.runtime).toEqual({ name: 'node-server', isServerless: false })
    expect(result.alpha).toEqual({ val: 1 })
  })
})
