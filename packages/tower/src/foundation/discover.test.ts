import { describe, expect, it } from 'vitest'

import { createTower } from './app.js'
import type { TowerModule } from './types.js'

describe('createTower', () => {
  it('accepts explicit config', async () => {
    const mod: TowerModule = { name: 'test', dependsOn: [], initialize: async () => {} }

    const result = await createTower({ modules: [mod] })

    expect(result).toBeDefined()
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
