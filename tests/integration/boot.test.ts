import '@towerjs/vault'

import { describe, expect, it } from 'vitest'

describe('Tower boot (live database)', () => {
  it('createTowerApp initializes with a minimal vault-only config', { skip: !process.env.DATABASE_URL }, async () => {
    const { createTowerApp } = await import('@towerjs/foundation')
    const { getModuleFactory } = await import('@towerjs/blueprint')

    const app = await createTowerApp(
      { modules: { vault: { connectionString: process.env.DATABASE_URL } } },
      getModuleFactory
    )
    expect(app).toBeDefined()
    expect(app.container.has('vault')).toBe(true)

    const vault = app.container.get<{ selectFrom: unknown }>('vault')
    expect(vault.selectFrom).toBeDefined()
    await app.shutdown()
  })
})
