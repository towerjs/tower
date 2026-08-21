import { getRegisteredModules } from '@towerjs/tower/blueprint'

import { describe, expect, it } from 'vitest'

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

  it('runtimes are detectable', async () => {
    const { detectRuntime } = await import('@towerjs/foundation')
    const runtime = detectRuntime()
    expect(['node', 'node-server', 'browser', 'edge', 'workerd']).toContain(runtime.name)
  })
})
