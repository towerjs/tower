import { describe, it, expect } from 'vitest'
import { getRegisteredModules } from '@towerjs/blueprint'

describe('Tower boot', () => {
  it('all module registrations are importable', async () => {
    await expect(import('@towerjs/foundation')).resolves.toBeDefined()
    await expect(import('@towerjs/blueprint')).resolves.toBeDefined()
    await expect(import('@towerjs/vault')).resolves.toBeDefined()
    await expect(import('@towerjs/gatehouse')).resolves.toBeDefined()
    await expect(import('@towerjs/courier')).resolves.toBeDefined()
  })

  it('all core modules register factories on import', async () => {
    await import('@towerjs/vault')
    await import('@towerjs/gatehouse')
    await import('@towerjs/courier')
    const registered = getRegisteredModules()
    expect(registered).toContain('vault')
    expect(registered).toContain('gatehouse')
    expect(registered).toContain('courier')
  })

  it('module dependency graph is correct', async () => {
    const { getModuleDependencies } = await import('@towerjs/blueprint')
    const vaultDeps = getModuleDependencies('vault')
    const gatehouseDeps = getModuleDependencies('gatehouse')
    const courierDeps = getModuleDependencies('courier')

    expect(vaultDeps).toEqual([])
    expect(gatehouseDeps).toEqual(['vault'])
    expect(courierDeps).toEqual([])
  })

  it('createTowerApp initializes with a minimal vault-only config', { skip: !process.env.DATABASE_URL }, async () => {
    const { createTowerApp } = await import('@towerjs/foundation')
    const { getModuleFactory } = await import('@towerjs/blueprint')

    const app = await createTowerApp(
      { modules: { vault: { connectionString: process.env.DATABASE_URL } } },
      getModuleFactory
    )
    expect(app).toBeDefined()
    expect(app.container.has('vault')).toBe(true)

    const vault = app.container.get<{ db: unknown }>('vault')
    expect(vault.db).toBeDefined()
    await app.shutdown()
  })

  it('runtimes are detectable', async () => {
    const { detectRuntime } = await import('@towerjs/foundation')
    const runtime = detectRuntime()
    expect(['node', 'node-server', 'browser', 'edge', 'workerd']).toContain(runtime.name)
  })
})
