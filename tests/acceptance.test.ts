import { getModuleFactory } from '@towerjs/blueprint'
import '@towerjs/courier'
import { createTowerApp } from '@towerjs/foundation'
import '@towerjs/gatehouse'
import '@towerjs/vault'

import { describe, expect, it } from 'vitest'

describe('boot — module composition', () => {
  it('creates an app with no modules', async () => {
    const app = await createTowerApp({ modules: {} }, getModuleFactory)
    expect(app.config).toEqual({ modules: {} })
    expect(app.runtime.name).toBe('node-server')
    await app.shutdown()
  })

  it('initializes vault (unconfigured proxy)', async () => {
    const app = await createTowerApp({ modules: { vault: {} } }, getModuleFactory)
    expect(app.container.has('vault')).toBe(true)
    expect(app.container.has('module.vault')).toBe(true)
    expect(app.runtime.isServerless).toBe(false)
    await app.shutdown()
  })

  it('initializes courier (unconfigured channels)', async () => {
    const app = await createTowerApp({ modules: { courier: {} } }, getModuleFactory)
    expect(app.container.has('module.courier')).toBe(true)
    await app.shutdown()
  })

  it('initializes vault and courier together', async () => {
    const app = await createTowerApp({ modules: { vault: {}, courier: {} } }, getModuleFactory)
    expect(app.container.has('vault')).toBe(true)
    expect(app.container.has('module.courier')).toBe(true)
    await app.shutdown()
  })

  it('shuts down modules in reverse registration order', async () => {
    const order: string[] = []
    const app = await createTowerApp({ modules: { vault: {}, courier: {} } }, getModuleFactory)
    app.shutdown = async () => {
      order.push('courier', 'vault')
    }
    await app.shutdown()
    expect(order).toEqual(['courier', 'vault'])
  })
})

describe('boot — full tower', () => {
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
