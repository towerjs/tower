import { describe, expect, it } from 'vitest'

describe('entrypoint re-exports', () => {
  it('re-exports defineTower from blueprint', async () => {
    const mod = await import('./blueprint/index.js')
    expect(typeof mod.defineTower).toBe('function')
  })

  it('re-exports createTowerApp from foundation', async () => {
    const mod = await import('./foundation/app.js')
    expect(typeof mod.createTowerApp).toBe('function')
  })

  it('re-exports createTower from foundation', async () => {
    const mod = await import('./foundation/app.js')
    expect(typeof mod.createTower).toBe('function')
  })

  it('re-exports towerContext from foundation', async () => {
    const mod = await import('./foundation/context/index.js')
    expect(mod.towerContext).toBeDefined()
    expect(typeof mod.towerContext.get).toBe('function')
    expect(typeof mod.towerContext.run).toBe('function')
  })
})

describe('runtime', () => {
  it('exposes getTowerApp and initTower', async () => {
    const mod = await import('./runtime.js')
    expect(typeof mod.getTowerApp).toBe('function')
    expect(typeof mod.initTower).toBe('function')
  })

  it('re-exports createLazyModule', async () => {
    const mod = await import('./runtime.js')
    expect(typeof mod.createLazyModule).toBe('function')
  })
})
