import { describe, expect, it, vi } from 'vitest'

import { createTowerApp } from './app.js'
import { resolveDependencyOrder } from './dependency-graph.js'
import type { TowerContext, TowerModule } from './types.js'

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
    const unnamed = {} as TowerModule
    await expect(createTowerApp({ modules: [unnamed] })).rejects.toThrow('missing name')
  })

  it('requires module names to be unique', () => {
    const result = resolveDependencyOrder([makeMod('dup'), makeMod('dup')])
    expect(result.valid).toBe(false)
    expect(result.errors[0].type).toBe('self-reference')
  })

  it('rejects a legacy object-form modules config', async () => {
    await expect(createTowerApp({ modules: { vault: {} } } as unknown as { modules: TowerModule[] })).rejects.toThrow(
      'modules must be an array of module definitions'
    )
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

    await createTowerApp({ modules: [modA, modB] })

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

    // gatehouse listed first — dependency order must still win
    await createTowerApp({ modules: [gatehouse, vault] })

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

    const app = await createTowerApp({ modules: [modA, modB] })
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

    await expect(createTowerApp({ modules: [missingDep] })).rejects.toThrow(
      'depends on "nonexistent" which is not in the modules array'
    )
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
  it('creates an app with no modules', async () => {
    const app = await createTowerApp({ modules: [] })
    expect(app.config).toEqual({ modules: [] })
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

    await createTowerApp({ modules: [mod] })

    expect(received).toHaveLength(2)
    for (const ctx of received) {
      expect(ctx.services).toBeDefined()
      expect(ctx.config).toBeDefined()
      expect(ctx.appConfig).toBeDefined()
      expect(ctx.runtime).toBeDefined()
    }
  })

  it('lets modules carry their own options via closures', async () => {
    // In the explicit-registration architecture, options are captured by the
    // module's callable export (e.g. vault({ connectionString })) rather than
    // passed through a per-name config map.
    function configurableModule(options: { key: string }): TowerModule {
      return {
        name: 'configurable',
        dependsOn: [],
        register(ctx) {
          ctx.services.register('configurable-options', options)
        },
      }
    }

    const app = await createTowerApp({ modules: [configurableModule({ key: 'val' })] })
    expect(app.container.get('configurable-options')).toEqual({ key: 'val' })
    await app.shutdown()
  })

  it('isolates service registration between different app instances', async () => {
    const buildModule = (): TowerModule => ({
      name: 'test',
      register(ctx) {
        ctx.services.register('secret', { value: 42 })
      },
    })

    const app1 = await createTowerApp({ modules: [buildModule()] })
    const app2 = await createTowerApp({ modules: [buildModule()] })

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

    const srcDir = new URL('.', import.meta.url).pathname

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
