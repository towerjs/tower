import { describe, expect, it } from 'vitest'

import { createTower, createTowerApp } from './app.js'
import { ServiceContainer } from './container.js'
import type { TowerModule } from './types.js'

function mockModule(name: string, hooks: Partial<TowerModule> = {}): TowerModule {
  return { name, dependsOn: [], ...hooks } as TowerModule
}

describe('createTowerApp', () => {
  it('initializes configured modules', async () => {
    const mock = mockModule('mock', {
      initialize(ctx) {
        ctx.services.register('mock', { value: 42 })
      },
    })
    const app = await createTowerApp({ modules: [mock] })
    expect(app.container.get('mock')).toEqual({ value: 42 })
  })

  it('exposes the config on the app', async () => {
    const config = { modules: [mockModule('mock')] }
    const app = await createTowerApp(config)
    expect(app.config).toEqual(config)
  })

  it('rejects a legacy object-form modules config with an actionable error', async () => {
    await expect(createTowerApp({ modules: { mock: {} } } as unknown as { modules: TowerModule[] })).rejects.toThrow(
      'modules must be an array of module definitions'
    )
  })

  it('throws when a module definition is missing a name', async () => {
    const nameless = { dependsOn: [] } as TowerModule
    await expect(createTowerApp({ modules: [nameless] })).rejects.toThrow('Module definition missing name')
  })

  it('calls shutdown in reverse order', async () => {
    const order: number[] = []

    const alpha = mockModule('alpha', {
      async shutdown() {
        order.push(1)
      },
    })
    const beta = mockModule('beta', {
      async shutdown() {
        order.push(2)
      },
    })

    const app = await createTowerApp({ modules: [alpha, beta] })
    await app.shutdown()
    expect(order).toEqual([2, 1])
  })

  it('throws an actionable error for a missing declared dependency', async () => {
    const gatehouse = mockModule('gatehouse', { dependsOn: ['vault'] })
    await expect(createTowerApp({ modules: [gatehouse] })).rejects.toThrow('Add vault() to your modules array')
  })

  it('detects and exposes the runtime', async () => {
    const app = await createTowerApp({ modules: [mockModule('mock')] })
    expect(app.runtime.name).toBe('node-server')
    expect(app.runtime.isServerless).toBe(false)
  })

  it('propagates init errors', async () => {
    const exploder = mockModule('exploder', {
      async initialize() {
        throw new Error('init failed')
      },
    })

    await expect(createTowerApp({ modules: [exploder] })).rejects.toThrow('init failed')
  })

  it('registers all services before initializing any module', async () => {
    const seen: string[] = []

    const first = mockModule('first', {
      register() {
        seen.push('register:first')
      },
      async initialize() {
        seen.push('init:first')
      },
    })

    const second = mockModule('second', {
      register() {
        seen.push('register:second')
      },
      async initialize() {
        // Both modules must be registered before the first initialize runs.
        if (seen.includes('register:first')) seen.push('init:second')
        else seen.push('init:second:no-first')
      },
    })

    const app = await createTowerApp({ modules: [first, second] })
    await app.shutdown()

    expect(seen).toEqual(['register:first', 'register:second', 'init:first', 'init:second'])
  })

  it('resolves initialization order from declared dependencies', async () => {
    const order: string[] = []

    const vault = mockModule('vault', {
      async initialize() {
        order.push('vault')
      },
    })
    const gatehouse = mockModule('gatehouse', {
      dependsOn: ['vault'],
      async initialize() {
        order.push('gatehouse')
      },
    })

    // gatehouse listed first — dependency order must still win
    const app = await createTowerApp({ modules: [gatehouse, vault] })
    await app.shutdown()

    expect(order).toEqual(['vault', 'gatehouse'])
  })

  it('shutdown handles modules without shutdown hook', async () => {
    const quiet = mockModule('quiet', {
      async initialize() {},
    })

    const app = await createTowerApp({ modules: [quiet] })
    await expect(app.shutdown()).resolves.toBeUndefined()
  })
})

describe('createTower', () => {
  it('returns a real TowerApp with config, container, runtime, shutdown', async () => {
    const mock = mockModule('mock')
    const app = await createTower({ modules: [mock] })
    expect(app.config).toEqual({ modules: [mock] })
    expect(app.container).toBeInstanceOf(ServiceContainer)
    expect(app.runtime).toBeDefined()
    expect(typeof app.shutdown).toBe('function')
  })

  it('attaches module services by name', async () => {
    const mock = mockModule('mock', {
      initialize(ctx) {
        ctx.services.register('mock', { value: 42 })
      },
    })
    const app = await createTower({ modules: [mock] })
    expect((app as any).mock).toEqual({ value: 42 })
  })

  it('exposes shutdown that runs module shutdown hooks in reverse', async () => {
    const order: number[] = []
    const first = mockModule('first', {
      async shutdown() {
        order.push(1)
      },
    })
    const second = mockModule('second', {
      async shutdown() {
        order.push(2)
      },
    })

    const app = await createTower({ modules: [first, second] })
    await app.shutdown()
    expect(order).toEqual([2, 1])
  })
})
