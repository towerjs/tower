import { describe, it, expect, vi, afterEach } from 'vitest'

const mockDefineTower = vi.fn((c: any) => c)
const mockCreateTowerApp = vi.fn()

const mockRegisterModule = vi.fn()
const mockGetModuleFactory = vi.fn()

vi.mock('@towerjs/blueprint', () => ({
  defineTower: mockDefineTower,
  registerModule: mockRegisterModule,
  getModuleFactory: mockGetModuleFactory,
  TowerBlueprint: class {},
}))

vi.mock('@towerjs/foundation', () => ({
  createTowerApp: mockCreateTowerApp,
  createTower: vi.fn(),
  TowerApp: class {},
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('entrypoint re-exports', () => {
  it('re-exports defineTower from blueprint', async () => {
    const mod = await import('./blueprint.js')
    expect(typeof mod.defineTower).toBe('function')
  })

  it('re-exports createTowerApp from foundation', async () => {
    const mod = await import('./foundation.js')
    expect(mod.createTowerApp).toBe(mockCreateTowerApp)
  })

  it('re-exports createTower from foundation', async () => {
    const mod = await import('./foundation.js')
    expect(typeof mod.createTower).toBe('function')
  })
})

describe('gatehouseClient', () => {
  it('re-exports gatehouseClient from @towerjs/gatehouse/client', async () => {
    const mod = await import('./gatehouse/client.js')
    expect(mod.gatehouseClient).toBeDefined()
    expect(typeof mod.gatehouseClient.signIn).toBe('function')
    expect(typeof mod.gatehouseClient.signUp).toBe('function')
    expect(typeof mod.gatehouseClient.signOut).toBe('function')
  })
})

describe('runtime module factories', () => {
  it('orders gatehouse after courier when both are configured', async () => {
    const { getModuleFactoryForConfig } = await import('./runtime.js')
    const config = { modules: { vault: {}, gatehouse: {}, courier: {} } }
    const factory = getModuleFactoryForConfig(config as any)

    const gatehouse = factory('gatehouse')!({})
    const courier = factory('courier')!({})
    const vault = factory('vault')!({})

    expect(gatehouse.name).toBe('gatehouse')
    expect(courier.name).toBe('courier')
    expect(vault.name).toBe('vault')
    expect(gatehouse.dependsOn).toContain('courier')
    expect(gatehouse.dependsOn).toContain('vault')
    expect(courier.dependsOn).toEqual([])
  })

  it('does not require courier when only gatehouse is configured', async () => {
    const { getModuleFactoryForConfig } = await import('./runtime.js')
    const config = { modules: { vault: {}, gatehouse: {} } }
    const factory = getModuleFactoryForConfig(config as any)

    const gatehouse = factory('gatehouse')!({})
    expect(gatehouse.dependsOn).toEqual(['vault'])
  })
})
