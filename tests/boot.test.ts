import { describe, expect, it } from 'vitest'

describe('Tower boot', () => {
  it('all module packages are importable', async () => {
    await expect(import('@towerjs/tower')).resolves.toBeDefined()
    await expect(import('@towerjs/tower/blueprint')).resolves.toBeDefined()
    await expect(import('@towerjs/tower/foundation')).resolves.toBeDefined()
    await expect(import('@towerjs/vault')).resolves.toBeDefined()
    await expect(import('@towerjs/gatehouse')).resolves.toBeDefined()
    await expect(import('@towerjs/courier')).resolves.toBeDefined()
  })

  it('vault, gatehouse, courier are callable module definitions', async () => {
    const { vault } = await import('@towerjs/vault')
    const { gatehouse } = await import('@towerjs/gatehouse')
    const { courier } = await import('@towerjs/courier')
    expect(typeof vault).toBe('function')
    expect(vault().name).toBe('vault')
    expect(typeof gatehouse).toBe('function')
    expect(gatehouse({ provider: 'better-auth' } as any).name).toBe('gatehouse')
    expect(typeof courier).toBe('function')
    expect(courier().name).toBe('courier')
  })

  it('module dependency graph is correct', async () => {
    const { vault } = await import('@towerjs/vault')
    const { gatehouse } = await import('@towerjs/gatehouse')
    const { courier } = await import('@towerjs/courier')

    expect(vault().dependsOn).toEqual([])
    expect(gatehouse({ provider: 'better-auth' } as any).dependsOn).toEqual(['vault'])
    expect(courier().dependsOn).toEqual([])
  })

  it('runtimes are detectable', async () => {
    const { detectRuntime } = await import('@towerjs/tower/foundation')
    const runtime = detectRuntime()
    expect(['node', 'node-server', 'browser', 'edge', 'workerd']).toContain(runtime.name)
  })
})
