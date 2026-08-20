import { afterEach, describe, expect, it } from 'vitest'

import { defineTower, env, getModuleFactory, registerModule } from './index.js'
import { resetModuleFactories } from './internal.js'

describe('defineTower', () => {
  it('returns the config as-is', () => {
    const config = defineTower({
      modules: { vault: { provider: 'neon' } },
    })

    expect(config).toEqual({
      modules: { vault: { provider: 'neon' } },
    })
  })

  it('accepts an empty modules object', () => {
    const config = defineTower({
      modules: {},
    })

    expect(config.modules).toEqual({})
  })
})

describe('env', () => {
  it('reads strings and optional values lazily', () => {
    process.env.TOWER_TEST_NAME = 'Tower'
    expect(env.string('TOWER_TEST_NAME')).toBe('Tower')
    expect(env.optional('TOWER_TEST_MISSING')).toBeUndefined()
    delete process.env.TOWER_TEST_NAME
  })

  it('validates URLs, booleans, and numbers', () => {
    process.env.TOWER_TEST_URL = 'http://localhost:3000'
    process.env.TOWER_TEST_BOOL = 'true'
    process.env.TOWER_TEST_NUMBER = '42'
    expect(env.url('TOWER_TEST_URL')).toBe('http://localhost:3000')
    expect(env.boolean('TOWER_TEST_BOOL')).toBe(true)
    expect(env.number('TOWER_TEST_NUMBER')).toBe(42)
    delete process.env.TOWER_TEST_URL
    delete process.env.TOWER_TEST_BOOL
    delete process.env.TOWER_TEST_NUMBER
  })

  it('reports invalid and missing values clearly', () => {
    expect(() => env.string('TOWER_TEST_MISSING')).toThrow('TOWER_TEST_MISSING is required')
    process.env.TOWER_TEST_URL = 'localhost:3000'
    expect(() => env.url('TOWER_TEST_URL')).toThrow('TOWER_TEST_URL must be a valid URL')
    delete process.env.TOWER_TEST_URL
  })
})

describe('module registry', () => {
  afterEach(() => {
    resetModuleFactories()
  })

  it('stores and retrieves a module factory', () => {
    const factory = () => ({ name: 'test', init: async () => {} })
    registerModule('test', factory)

    expect(getModuleFactory('test')).toBe(factory)
  })

  it('returns undefined for an unregistered module', () => {
    expect(getModuleFactory('nonexistent')).toBeUndefined()
  })

  it('overwrites a factory when registered twice', () => {
    const factory1 = () => ({ name: 'test', init: async () => {} })
    const factory2 = () => ({ name: 'test', init: async () => {} })
    registerModule('test', factory1)
    registerModule('test', factory2)

    expect(getModuleFactory('test')).toBe(factory2)
  })

  it('handles empty string module name', () => {
    const factory = () => ({ name: '', init: async () => {} })
    registerModule('', factory)
    expect(getModuleFactory('')).toBe(factory)
  })

  it('stores factory that throws', () => {
    const factory = () => {
      throw new Error('factory error')
    }
    registerModule('broken', factory)
    const retrieved = getModuleFactory('broken')
    expect(typeof retrieved).toBe('function')
  })
})
