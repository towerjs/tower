import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it, vi } from 'vitest'

import { resolveDependencyOrder } from './dependency-graph.js'
import type { TowerContext, TowerModule } from './types.js'

const __filename = fileURLToPath(import.meta.url)
const { createTowerApp } = await import(resolve(dirname(__filename), './app.ts'))

function makeMod(name: string, deps?: string[]): TowerModule {
  return {
    name,
    dependsOn: deps,
    register: vi.fn(),
    initialize: vi.fn(),
    shutdown: vi.fn(),
  }
}

describe('module metadata validity', () => {
  it('requires every module to have a name', async () => {
    const unnamedFactory = () => ({}) as TowerModule
    await expect(createTowerApp({ modules: { vault: {} } }, () => unnamedFactory)).rejects.toThrow('without a name')
  })

  it('requires module names to be unique', () => {
    const result = resolveDependencyOrder([makeMod('dup'), makeMod('dup')])
    expect(result.valid).toBe(false)
    expect(result.errors[0].type).toBe('self-reference')
  })
})

describe('lifecycle ordering', () => {
  it('runs register before initialize', async () => {
    const order: string[] = []
    const modA: TowerModule = {
      name: 'a',
      register() {
        order.push('register.a')
      },
      async initialize() {
        order.push('initialize.a')
      },
    }
    const modB: TowerModule = {
      name: 'b',
      register() {
        order.push('register.b')
      },
      async initialize() {
        order.push('initialize.b')
      },
    }
    const factoryMap: Record<string, () => TowerModule> = {
      a: () => modA,
      b: () => modB,
    }

    await createTowerApp({ modules: { a: {}, b: {} } }, (name) => factoryMap[name])

    expect(order).toEqual(['register.a', 'register.b', 'initialize.a', 'initialize.b'])
  })

  it('runs dependent modules after their dependencies in register phase', async () => {
    const order: string[] = []
    const vault: TowerModule = {
      name: 'vault',
      register() {
        order.push('register.vault')
      },
      async initialize() {
        order.push('initialize.vault')
      },
    }
    const gatehouse: TowerModule = {
      name: 'gatehouse',
      dependsOn: ['vault'],
      register() {
        order.push('register.gatehouse')
      },
      async initialize() {
        order.push('initialize.gatehouse')
      },
    }
    const factoryMap: Record<string, () => TowerModule> = {
      vault: () => vault,
      gatehouse: () => gatehouse,
    }

    await createTowerApp({ modules: { vault: {}, gatehouse: {} } }, (name) => factoryMap[name])

    const vaultIdx = order.indexOf('register.vault')
    const ghIdx = order.indexOf('register.gatehouse')
    expect(vaultIdx).toBeLessThan(ghIdx)
  })

  it('runs shutdown in reverse order', async () => {
    const order: string[] = []
    const modA: TowerModule = {
      name: 'a',
      shutdown() {
        order.push('shutdown.a')
      },
    }
    const modB: TowerModule = {
      name: 'b',
      dependsOn: ['a'],
      shutdown() {
        order.push('shutdown.b')
      },
    }
    const factoryMap: Record<string, () => TowerModule> = {
      a: () => modA,
      b: () => modB,
    }

    const app = await createTowerApp({ modules: { a: {}, b: {} } }, (name) => factoryMap[name])
    await app.shutdown()

    expect(order).toEqual(['shutdown.b', 'shutdown.a'])
  })
})

describe('dependency resolution', () => {
  it('resolves modules in topological order', () => {
    const result = resolveDependencyOrder([
      makeMod('gatehouse', ['vault', 'courier']),
      makeMod('vault'),
      makeMod('courier'),
    ])

    expect(result.valid).toBe(true)
    const idx = (name: string) => result.order.indexOf(name)
    expect(idx('vault')).toBeLessThan(idx('gatehouse'))
    expect(idx('courier')).toBeLessThan(idx('gatehouse'))
  })

  it('handles modules with no dependencies', () => {
    const result = resolveDependencyOrder([makeMod('a'), makeMod('b')])
    expect(result.valid).toBe(true)
  })

  it('handles a single module', () => {
    const result = resolveDependencyOrder([makeMod('solo')])
    expect(result.valid).toBe(true)
    expect(result.order).toEqual(['solo'])
  })

  it('handles empty module list', () => {
    const result = resolveDependencyOrder([])
    expect(result.valid).toBe(true)
    expect(result.order).toEqual([])
  })

  it('handles deep dependency chains', () => {
    const result = resolveDependencyOrder([makeMod('d', ['c']), makeMod('c', ['b']), makeMod('b', ['a']), makeMod('a')])
    expect(result.valid).toBe(true)
    const idx = (name: string) => result.order.indexOf(name)
    expect(idx('a')).toBeLessThan(idx('b'))
    expect(idx('b')).toBeLessThan(idx('c'))
    expect(idx('c')).toBeLessThan(idx('d'))
  })

  it('handles diamond dependencies (same dep used by multiple)', () => {
    const result = resolveDependencyOrder([
      makeMod('bottom'),
      makeMod('left', ['bottom']),
      makeMod('right', ['bottom']),
      makeMod('top', ['left', 'right']),
    ])
    expect(result.valid).toBe(true)
    const idx = (name: string) => result.order.indexOf(name)
    expect(idx('bottom')).toBeLessThan(idx('left'))
    expect(idx('bottom')).toBeLessThan(idx('right'))
    expect(idx('left')).toBeLessThan(idx('top'))
    expect(idx('right')).toBeLessThan(idx('top'))
  })
})

describe('missing dependency failures', () => {
  it('throws when a module has a missing dependency declared', async () => {
    const missingDep: TowerModule = {
      name: 'needs-x',
      dependsOn: ['nonexistent'],
      register: vi.fn(),
    }

    await expect(
      createTowerApp({ modules: { 'needs-x': {} } }, (name) => (name === 'needs-x' ? () => missingDep : undefined))
    ).rejects.toThrow('depends on "nonexistent" which is not in the modules array')
  })

  it('fails validation when a declared dependency is not in the module list', () => {
    const result = resolveDependencyOrder([makeMod('a', ['missing'])])
    expect(result.valid).toBe(false)
    expect(result.errors[0].type).toBe('missing')
  })
})

describe('circular dependency failures', () => {
  it('detects direct circular dependency', () => {
    const result = resolveDependencyOrder([makeMod('a', ['b']), makeMod('b', ['a'])])
    expect(result.valid).toBe(false)
    expect(result.errors[0].type).toBe('circular')
  })

  it('detects indirect circular dependency', () => {
    const result = resolveDependencyOrder([makeMod('a', ['b']), makeMod('b', ['c']), makeMod('c', ['a'])])
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(1)
    expect(result.errors[0].type).toBe('circular')
  })

  it('detects self-referencing dependency', () => {
    const result = resolveDependencyOrder([makeMod('a', ['a'])])
    expect(result.valid).toBe(false)
    expect(result.errors[0].type).toBe('circular')
  })
})

describe('configuration validation', () => {
  it('throws for unknown modules', async () => {
    await expect(createTowerApp({ modules: { unknown: {} } }, () => undefined)).rejects.toThrow('Unknown module')
  })

  it('creates an app with no modules', async () => {
    const app = await createTowerApp({ modules: {} }, () => undefined)
    expect(app.config).toEqual({ modules: {} })
    await app.shutdown()
  })
})

describe('context isolation', () => {
  it('provides services, config, appConfig, and runtime to hooks', async () => {
    const received: TowerContext[] = []

    const mod: TowerModule = {
      name: 'test',
      register(ctx) {
        received.push(ctx)
      },
      async initialize(ctx) {
        received.push(ctx)
      },
    }

    await createTowerApp({ modules: { test: { key: 'val' } } }, () => () => mod)

    expect(received).toHaveLength(2)
    for (const ctx of received) {
      expect(ctx.services).toBeDefined()
      expect(ctx.config).toBeDefined()
      expect(ctx.appConfig).toBeDefined()
      expect(ctx.runtime).toBeDefined()
    }
  })

  it('passes correct module config to each module', async () => {
    const contexts: TowerContext[] = []

    const modA: TowerModule = {
      name: 'a',
      register(ctx) {
        contexts.push(ctx)
      },
    }
    const modB: TowerModule = {
      name: 'b',
      dependsOn: ['a'],
      register(ctx) {
        contexts.push(ctx)
      },
    }

    await createTowerApp({ modules: { a: { x: 1 }, b: { y: 2 } } }, (name) => (name === 'a' ? () => modA : () => modB))

    expect(contexts[0].config).toEqual({ x: 1 })
    expect(contexts[1].config).toEqual({ y: 2 })
  })

  it('isolates service registration between different app instances', async () => {
    const mod: TowerModule = {
      name: 'test',
      register(ctx) {
        ctx.services.register('secret', { value: 42 })
      },
    }

    const factory = () => mod

    const app1 = await createTowerApp({ modules: { test: {} } }, () => factory)
    const app2 = await createTowerApp({ modules: { test: {} } }, () => factory)

    expect(app1.container.has('secret')).toBe(true)
    expect(app2.container.has('secret')).toBe(true)

    const val1 = app1.container.get<{ value: number }>('secret')
    const val2 = app2.container.get<{ value: number }>('secret')
    expect(val1).not.toBe(val2)

    await app1.shutdown()
    await app2.shutdown()
  })
})

describe('dependency direction', () => {
  it('foundation does not import feature modules', () => {
    const fs = require('node:fs') as typeof import('node:fs')
    const path = require('node:path') as typeof import('node:path')
    const srcDir = path.join(__dirname)

    const files = fs
      .readdirSync(srcDir)
      .filter((f: string) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'architecture.test.ts')

    for (const file of files) {
      const content = fs.readFileSync(path.join(srcDir, file), 'utf-8')
      const matches = content.match(
        /from\s+['"]@towerjs\/(vault|gatehouse|courier|archive|beacon|crane|treasury|observatory|watchtower)['"]/g
      )
      if (matches) {
        throw new Error(`Foundation imports from feature module: ${file} has ${matches.join(', ')}`)
      }
    }
  })
})
