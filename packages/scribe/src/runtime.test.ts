import { describe, expect, it } from 'vitest'
import { getModuleFactory } from './runtime.js'

describe('Scribe module runtime', () => {
  it('only requires configured module dependencies', () => {
    const factory = getModuleFactory('gatehouse', new Set(['gatehouse', 'vault']))
    const module = factory?.({})

    expect(module?.dependsOn).toEqual(['vault'])
  })
})
