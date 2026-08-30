import { gatehouse } from '@towerjs/gatehouse'
import { vault } from '@towerjs/vault'

import { describe, expect, it } from 'vitest'

import { createModuleDefinitions } from './runtime.js'

describe('Scribe module runtime', () => {
  it('gatehouse requires vault while courier remains optional', async () => {
    const defs = await createModuleDefinitions([vault(), gatehouse({ provider: 'better-auth' } as any)])
    const gatehouseMod = defs.find((m) => m.name === 'gatehouse')

    expect(gatehouseMod?.dependsOn).toEqual(['vault'])
  })

  it('returns array modules as-is', async () => {
    const defs = await createModuleDefinitions([vault()])
    expect(defs).toHaveLength(1)
    expect(defs[0].name).toBe('vault')
  })
})
