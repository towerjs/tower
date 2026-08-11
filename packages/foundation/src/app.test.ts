import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { registerModule, getModuleFactory } from '@towerjs/blueprint'
import { resetModuleFactories } from '@towerjs/blueprint/internal'
import { createTowerApp, createTower } from './app.js'
import { ServiceContainer } from './container.js'

beforeAll(() => {
  registerModule('mock', () => ({
    name: 'mock',
    async init(ctx) {
      ctx.container.register('mock', { value: 42 })
    },
  }))
})

afterAll(() => {
  resetModuleFactories()
})

function modules(m: Record<string, unknown>) {
  return { modules: m }
}

describe('createTowerApp', () => {
  it('initializes configured modules', async () => {
    const app = await createTowerApp(modules({ mock: {} }), getModuleFactory)
    expect(app.container.get('mock')).toEqual({ value: 42 })
  })

  it('exposes the config on the app', async () => {
    const app = await createTowerApp(modules({ mock: {} }), getModuleFactory)
    expect(app.config).toEqual(modules({ mock: {} }))
  })

  it('calls shutdown in reverse order', async () => {
    const order: number[] = []

    registerModule('alpha', () => ({
      name: 'alpha',
      async shutdown() {
        order.push(1)
      },
    }))

    registerModule('beta', () => ({
      name: 'beta',
      async shutdown() {
        order.push(2)
      },
    }))

    const app = await createTowerApp(modules({ alpha: {}, beta: {}, mock: {} }), getModuleFactory)
    await app.shutdown()
    expect(order).toEqual([2, 1])
  })

  it('throws for an unknown module', async () => {
    await expect(createTowerApp(modules({ nonexistent: {} }), getModuleFactory)).rejects.toThrow(
      'Unknown module "nonexistent"'
    )
  })

  it('detects and exposes the runtime', async () => {
    const app = await createTowerApp(modules({ mock: {} }), getModuleFactory)
    expect(app.runtime.name).toBe('node-server')
    expect(app.runtime.isServerless).toBe(false)
  })

  it('propagates init errors', async () => {
    registerModule('exploder', () => ({
      name: 'exploder',
      async init() {
        throw new Error('init failed')
      },
    }))

    await expect(createTowerApp(modules({ exploder: {} }), getModuleFactory)).rejects.toThrow('init failed')
  })

  it('registers all services before initializing any module', async () => {
    const seen: string[] = []

    registerModule('first', () => ({
      name: 'first',
      register() {
        seen.push('register:first')
      },
      async initialize() {
        seen.push('init:first')
      },
    }))

    registerModule('second', () => ({
      name: 'second',
      register() {
        seen.push('register:second')
      },
      async initialize() {
        // Both modules must be registered before the first initialize runs.
        if (seen.includes('register:first')) seen.push('init:second')
        else seen.push('init:second:no-first')
      },
    }))

    const app = await createTowerApp(modules({ first: {}, second: {}, mock: {} }), getModuleFactory)
    await app.shutdown()

    expect(seen).toEqual(['register:first', 'register:second', 'init:first', 'init:second'])
  })

  it('shutdown handles modules without shutdown hook', async () => {
    registerModule('quiet', () => ({
      name: 'quiet',
      async init() {},
    }))

    const app = await createTowerApp(modules({ quiet: {}, mock: {} }), getModuleFactory)
    await expect(app.shutdown()).resolves.toBeUndefined()
  })
})

describe('createTower', () => {
  it('returns a real TowerApp with config, container, runtime, shutdown', async () => {
    const app = await createTower(modules({ mock: {} }), getModuleFactory)
    expect(app.config).toEqual(modules({ mock: {} }))
    expect(app.container).toBeInstanceOf(ServiceContainer)
    expect(app.runtime).toBeDefined()
    expect(typeof app.shutdown).toBe('function')
  })

  it('attaches module services by name', async () => {
    const app = await createTower(modules({ mock: {} }), getModuleFactory)
    expect((app as any).mock).toEqual({ value: 42 })
  })

  it('exposes shutdown that runs module shutdown hooks in reverse', async () => {
    const order: number[] = []
    registerModule('first', () => ({
      name: 'first',
      async shutdown() {
        order.push(1)
      },
    }))
    registerModule('second', () => ({
      name: 'second',
      async shutdown() {
        order.push(2)
      },
    }))

    const app = await createTower(modules({ first: {}, second: {}, mock: {} }), getModuleFactory)
    await app.shutdown()
    expect(order).toEqual([2, 1])
  })
})
