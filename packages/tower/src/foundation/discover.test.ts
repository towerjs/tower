import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTower } from './app.js'
import type { TowerModule } from './types.js'

const mocks = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('node:fs')
  return { ...actual, existsSync: mocks.mockExistsSync }
})

describe('createTower with auto-discovery', () => {
  const oldCwd = process.cwd()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.chdir(oldCwd)
  })

  it('throws when no tower.config found', async () => {
    mocks.mockExistsSync.mockReturnValue(false)
    process.chdir('/')

    await expect(createTower()).rejects.toThrow('Could not find tower.config')
  })

  it('accepts explicit config and skips discovery', async () => {
    const mod: TowerModule = { name: 'test', dependsOn: [], initialize: async () => {} }

    const result = await createTower({ modules: [mod] })

    expect(result).toBeDefined()
    expect(mocks.mockExistsSync).not.toHaveBeenCalled()
  })

  it('returns TowerApp with runtime and container', async () => {
    const alpha: TowerModule = {
      name: 'alpha',
      dependsOn: [],
      async initialize(ctx) {
        ctx.services.register('alpha', { val: 1 })
      },
    }

    const result = await createTower({ modules: [alpha] })

    expect(result.runtime).toEqual({ name: 'node-server', isServerless: false })
    expect(result.alpha).toEqual({ val: 1 })
  })
})
