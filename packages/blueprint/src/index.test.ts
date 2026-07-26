import { describe, expect, it, afterEach } from 'vitest'
import { defineTower, registerModule, getModuleFactory, resetModuleFactories } from './index.js'

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
