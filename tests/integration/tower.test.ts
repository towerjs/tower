import '@towerjs/courier'
import '@towerjs/gatehouse'
import { getModuleFactory } from '@towerjs/tower/blueprint'
import { createTowerApp } from '@towerjs/tower/foundation'
import '@towerjs/vault'

import { describe, expect, it } from 'vitest'

describe('boot — full tower (live database)', () => {
  it('initializes vault, gatehouse, and courier', async ({ skip }) => {
    if (!process.env.DATABASE_URL) skip()
    const app = await createTowerApp(
      {
        modules: {
          vault: { connectionString: process.env.DATABASE_URL },
          gatehouse: {
            provider: 'better-auth',
            appName: 'Tower Acceptance Test',
            baseURL: 'http://localhost:3000',
            secret: process.env.GATEHOUSE_SECRET ?? process.env.BETTER_AUTH_SECRET ?? 'test-secret-32-chars-minimum!!',
            credentials: { enabled: true },
          },
          courier: {},
        },
      },
      getModuleFactory
    )

    expect(app.container.has('vault')).toBe(true)
    expect(app.container.has('module.gatehouse')).toBe(true)
    expect(app.container.has('module.courier')).toBe(true)
    await app.shutdown()
  })

  it('vault validates connection on init', async ({ skip }) => {
    if (!process.env.DATABASE_URL) skip()
    await expect(
      createTowerApp(
        { modules: { vault: { connectionString: 'postgres://localhost:65432/nonexistent' } } },
        getModuleFactory
      )
    ).rejects.toThrow('Could not connect to database')
  })

  it('full tower shutdown releases database pool', async ({ skip }) => {
    if (!process.env.DATABASE_URL) skip()
    const app = await createTowerApp(
      {
        modules: {
          vault: { connectionString: process.env.DATABASE_URL },
          gatehouse: {
            provider: 'better-auth',
            baseURL: 'http://localhost:3000',
            secret: 'test-secret-32-chars-minimum!!',
            credentials: { enabled: true },
          },
          courier: {},
        },
      },
      getModuleFactory
    )

    await app.shutdown()

    const vault = app.container.get<any>('vault')
    await expect(vault.close()).resolves.toBeUndefined()
  })
})
