import { createTowerApp } from '@towerjs/tower/foundation'
import { vault } from '@towerjs/vault'

import { describe, expect, it } from 'vitest'

describe('Tower boot (live database)', () => {
  it('createTowerApp initializes with a minimal vault-only config', { skip: !process.env.DATABASE_URL }, async () => {
    const app = await createTowerApp({
      modules: [vault({ connectionString: process.env.DATABASE_URL })],
    })
    expect(app).toBeDefined()
    expect(app.container.has('vault')).toBe(true)

    const vaultSvc = app.container.get<{ selectFrom: unknown }>('vault')
    expect(vaultSvc.selectFrom).toBeDefined()
    await app.shutdown()
  })
})
