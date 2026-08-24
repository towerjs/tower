import { describe, expect, it } from 'vitest'

import type { TowerModule } from '../foundation/types.js'
import { defineTower, env } from './index.js'

describe('defineTower', () => {
  it('returns the config as-is', () => {
    const mod: TowerModule = { name: 'vault', dependsOn: [] }
    const config = defineTower({ modules: [mod] })

    expect(config).toEqual({ modules: [mod] })
  })

  it('accepts an empty modules array', () => {
    const config = defineTower({
      modules: [],
    })

    expect(config.modules).toEqual([])
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
